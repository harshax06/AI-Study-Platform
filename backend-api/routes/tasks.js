const express = require('express');
const crypto = require('crypto');

const { auth, teacherOnly } = require('../middleware/auth');
const {
    validateTaskCreate,
    validateTaskSchedule,
    validateTaskIdParam
} = require('../middleware/validation');

const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const Quiz = require('../models/Quiz');
const { logAudit } = require('../services/auditLogger');
const { normalizeYear } = require('../utils/years');

const router = express.Router();

async function notifyStudents(io, studentIds, payload, notificationType) {
    if (studentIds.length > 0) {
        await Notification.insertMany(
            studentIds.map((studentId) => ({
                userId: studentId,
                type: notificationType,
                title: payload.title,
                message: payload.message,
                taskId: payload.taskId
            }))
        );
    }

    if (io) {
        studentIds.forEach((studentId) => {
            io.to(studentId.toString()).emit('new-task', payload);
        });
    }
}

router.get('/analytics/overview', auth, teacherOnly, async (req, res) => {
    try {
        const tasks = await Task.find({ teacherId: req.userId }).populate('assignedStudents', 'name studentYear');

        const analytics = await Promise.all(tasks.map(async (task) => {
            const quiz = await Quiz.findOne({ taskId: task._id });
            const attendanceCount = await Attendance.countDocuments({ taskId: task._id });
            const avgQuizScore = quiz && quiz.completions.length > 0
                ? Math.round(quiz.completions.reduce((sum, completion) => sum + completion.percentage, 0) / quiz.completions.length)
                : null;

            return {
                taskId: task._id,
                title: task.title,
                type: task.type,
                targetYear: task.targetYear,
                status: task.status,
                assignedCount: task.assignedStudents.length,
                attendanceCount,
                quizGenerated: !!quiz,
                quizCompletions: quiz ? quiz.completions.length : 0,
                avgQuizScore
            };
        }));

        return res.json({ analytics });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/users/students', auth, teacherOnly, async (req, res) => {
    try {
        const teacher = await User.findById(req.userId).select('teachingYears');
        const years = teacher?.teachingYears || [];

        const students = await User.find({
            role: 'student',
            studentYear: { $in: years }
        }).select('name email studentYear');

        return res.json({ students });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/teacher', auth, teacherOnly, async (req, res) => {
    try {
        const tasks = await Task.find({ teacherId: req.userId })
            .populate('assignedStudents', 'name email studentYear')
            .sort({ createdAt: -1 });

        return res.json({ tasks });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/student', auth, async (req, res) => {
    try {
        const student = await User.findById(req.userId).select('studentYear role');
        if (!student || student.role !== 'student') {
            return res.status(403).json({ error: 'Students only' });
        }

        const tasks = await Task.find({
            assignedStudents: req.userId,
            targetYear: student.studentYear,
            status: { $in: ['scheduled', 'active', 'completed'] }
        })
            .populate('teacherId', 'name email')
            .sort({ startTime: 1 });

        const enriched = tasks.map((taskDoc) => {
            const task = taskDoc.toObject();
            task.canJoinNow = typeof taskDoc.canStartNow === 'function' ? taskDoc.canStartNow() : false;
            task.hasPassed = typeof taskDoc.hasMeetingPassed === 'function' ? taskDoc.hasMeetingPassed() : false;
            return task;
        });

        return res.json({ tasks: enriched });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/room/:roomId', auth, async (req, res) => {
    try {
        const task = await Task.findOne({ roomId: req.params.roomId }).populate('teacherId', 'name');
        if (!task) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        return res.json({
            task: {
                id: task._id,
                title: task.title,
                agenda: task.agenda,
                teacherName: task.teacherId?.name,
                teacherId: task.teacherId?._id,
                startTime: task.startTime,
                endTime: task.endTime,
                status: task.status
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/students/:year', auth, teacherOnly, async (req, res) => {
    try {
        const { year } = req.params;
        const normalizedYear = normalizeYear(year);
        const teacher = await User.findById(req.userId).select('teachingYears');

        if (!normalizedYear || !teacher?.teachingYears?.includes(normalizedYear)) {
            return res.status(403).json({ error: `You are not assigned to teach ${year}` });
        }

        const students = await User.find({ role: 'student', studentYear: normalizedYear }).select('name email studentYear');
        return res.json({ students });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/', auth, teacherOnly, validateTaskCreate, async (req, res) => {
    try {
        const io = req.app.get('io');

        const {
            title,
            agenda,
            type,
            description,
            keywords,
            targetYear,
            duration,
            dueDate,
            startTime,
            endTime
        } = req.body;
        const normalizedTargetYear = normalizeYear(targetYear);

        const teacher = await User.findById(req.userId).select('teachingYears');
        if (!normalizedTargetYear || !teacher?.teachingYears?.includes(normalizedTargetYear)) {
            return res.status(403).json({ error: `You are not assigned to teach ${targetYear}` });
        }

        const studentsInYear = await User.find({ role: 'student', studentYear: normalizedTargetYear }).select('_id');
        const studentIds = studentsInYear.map((student) => student._id);

        const taskData = {
            title,
            agenda,
            type: type || 'class',
            description,
            keywords: Array.isArray(keywords) ? keywords : [],
            teacherId: req.userId,
            targetYear: normalizedTargetYear,
            assignedStudents: studentIds,
            duration: duration || 60,
            dueDate: type === 'assignment' ? dueDate : null,
            status: 'draft'
        };

        if (taskData.type === 'class') {
            taskData.roomId = crypto.randomBytes(6).toString('hex');
            taskData.meetingLink = `/meet/${taskData.roomId}`;
        }

        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            if (start > new Date() && end > start) {
                taskData.startTime = start;
                taskData.endTime = end;
                taskData.scheduledAt = new Date();
                taskData.status = 'scheduled';
            }
        }

        const task = await Task.create(taskData);

        if (task.status === 'scheduled' && studentIds.length > 0) {
            await notifyStudents(
                io,
                studentIds,
                {
                    type: task.type === 'class' ? 'new_class' : 'new_assignment',
                    title: `New ${task.type}: ${task.title}`,
                    message: `Assigned for ${task.targetYear}.`,
                    taskId: task._id
                },
                task.type === 'class' ? 'new_class' : 'new_assignment'
            );

            task.notificationSent = true;
            await task.save();
        }

        logAudit('tasks.create.success', {
            correlationId: req.correlationId,
            userId: req.userId.toString(),
            taskId: task._id.toString(),
            targetYear: task.targetYear,
            assignedCount: studentIds.length,
            status: task.status
        });

        return res.status(201).json({
            message: `Task created for ${targetYear} (${studentIds.length} students)`,
            task
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/schedule', auth, teacherOnly, validateTaskSchedule, async (req, res) => {
    try {
        const io = req.app.get('io');
        const { startTime, endTime } = req.body;

        const task = await Task.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        const now = new Date();

        if (start <= now) {
            return res.status(400).json({ error: 'Start time must be in the future' });
        }

        if (end <= start) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        task.startTime = start;
        task.endTime = end;
        task.scheduledAt = start;
        task.status = 'scheduled';
        await task.save();

        if (task.assignedStudents.length > 0) {
            await notifyStudents(
                io,
                task.assignedStudents,
                {
                    type: task.type === 'class' ? 'new_class' : 'new_assignment',
                    title: `Scheduled ${task.type}: ${task.title}`,
                    message: `Starts ${start.toLocaleString()}`,
                    taskId: task._id
                },
                task.type === 'class' ? 'new_class' : 'new_assignment'
            );

            task.notificationSent = true;
            await task.save();
        }

        logAudit('tasks.schedule.success', {
            correlationId: req.correlationId,
            userId: req.userId.toString(),
            taskId: task._id.toString(),
            startTime: task.startTime,
            endTime: task.endTime
        });

        return res.json({
            message: `Task scheduled. ${task.assignedStudents.length} students notified.`,
            task
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', auth, teacherOnly, validateTaskIdParam, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const { title, agenda, description, keywords, startTime, endTime, dueDate, targetYear } = req.body;

        if (title !== undefined) task.title = title;
        if (agenda !== undefined) task.agenda = agenda;
        if (description !== undefined) task.description = description;
        if (keywords !== undefined) task.keywords = keywords;
        if (startTime !== undefined) task.startTime = startTime;
        if (endTime !== undefined) task.endTime = endTime;
        if (dueDate !== undefined) task.dueDate = dueDate;
        if (targetYear !== undefined) {
            const normalizedTargetYear = normalizeYear(targetYear);
            if (!normalizedTargetYear) {
                return res.status(400).json({ error: 'Invalid targetYear' });
            }
            task.targetYear = normalizedTargetYear;
        }

        await task.save();

        logAudit('tasks.update.success', {
            correlationId: req.correlationId,
            userId: req.userId.toString(),
            taskId: task._id.toString()
        });

        return res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', auth, teacherOnly, validateTaskIdParam, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await Notification.deleteMany({ taskId: task._id });

        if (task.status === 'scheduled' && task.assignedStudents.length > 0) {
            await Notification.insertMany(task.assignedStudents.map((studentId) => ({
                userId: studentId,
                type: 'task_cancelled',
                title: `${task.type} cancelled: ${task.title}`,
                message: `"${task.title}" has been cancelled.`,
                taskId: task._id
            })));
        }

        await Attendance.deleteMany({ taskId: task._id });
        await Quiz.deleteOne({ taskId: task._id });
        await Task.findByIdAndDelete(task._id);

        logAudit('tasks.delete.success', {
            correlationId: req.correlationId,
            userId: req.userId.toString(),
            taskId: task._id.toString(),
            title: task.title
        });

        return res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/attend', auth, validateTaskIdParam, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await Attendance.findOneAndUpdate(
            { taskId: task._id, studentId: req.userId },
            {
                $setOnInsert: { taskId: task._id, studentId: req.userId },
                joinedAt: new Date()
            },
            { upsert: true, new: true }
        );

        logAudit('attendance.recorded', {
            correlationId: req.correlationId,
            userId: req.userId.toString(),
            taskId: task._id.toString()
        });

        return res.json({ message: 'Attendance recorded' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/attendees', auth, validateTaskIdParam, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id).select('teacherId');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const isOwner = task.teacherId.toString() === req.userId.toString();
        if (!isOwner) {
            return res.status(403).json({ error: 'Only task owner can view attendees' });
        }

        const attendees = await Attendance.find({ taskId: task._id })
            .populate('studentId', 'name email studentYear')
            .sort({ joinedAt: -1 });

        return res.json({ attendees });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', auth, validateTaskIdParam, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('teacherId', 'name email')
            .populate('assignedStudents', 'name email studentYear');

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        return res.json({ task });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
