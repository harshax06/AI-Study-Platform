const cron = require('node-cron');

const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { generateQuizForTask } = require('../routes/ai');

let ioRef = null;
let schedulerRunning = false;
let highPrecisionTimer = null;

async function activateMeetings() {
    const now = new Date();

    const tasksToActivate = await Task.find({
        type: 'class',
        status: 'scheduled',
        startTime: { $lte: now },
        endTime: { $gt: now }
    });

    for (const task of tasksToActivate) {
        task.status = 'active';
        await task.save();

        if (task.assignedStudents.length > 0) {
            await Notification.insertMany(
                task.assignedStudents.map((studentId) => ({
                    userId: studentId,
                    type: 'meeting_started',
                    title: `Class started: ${task.title}`,
                    message: `"${task.title}" is live now.`,
                    taskId: task._id
                }))
            );
        }

        if (ioRef) {
            const payload = {
                taskId: task._id,
                title: task.title,
                roomId: task.roomId,
                startTime: task.startTime,
                endTime: task.endTime
            };

            task.assignedStudents.forEach((studentId) => ioRef.to(studentId.toString()).emit('meeting-started', payload));
            ioRef.to(task.teacherId.toString()).emit('meeting-started', payload);

            const aiPayload = {
                taskId: task._id,
                roomId: task.roomId,
                name: 'AI Moderator',
                joinedAt: new Date().toISOString(),
                message: 'AI moderator joined the meeting'
            };

            if (task.roomId) {
                ioRef.to(task.roomId).emit('ai-joined', aiPayload);
            }
            task.assignedStudents.forEach((studentId) => ioRef.to(studentId.toString()).emit('ai-joined', aiPayload));
            ioRef.to(task.teacherId.toString()).emit('ai-joined', aiPayload);
        }
    }

    return tasksToActivate.length;
}

async function closeMeetingByTask(task) {
    if (task.status === 'completed' || task.status === 'cancelled') {
        return null;
    }

    task.status = 'completed';
    await task.save();

    const quiz = await generateQuizForTask(task._id);

    if (task.assignedStudents.length > 0) {
        await Notification.insertMany(
            task.assignedStudents.map((studentId) => ({
                userId: studentId,
                type: 'quiz_available',
                title: `Quiz available: ${task.title}`,
                message: `Post-meeting quiz is ready for "${task.title}".`,
                taskId: task._id
            }))
        );
    }

    if (ioRef) {
        const meetingEndedPayload = {
            taskId: task._id,
            title: task.title,
            message: `Meeting "${task.title}" has ended.`
        };

        task.assignedStudents.forEach((studentId) => ioRef.to(studentId.toString()).emit('meeting-ended', meetingEndedPayload));
        ioRef.to(task.teacherId.toString()).emit('meeting-ended', meetingEndedPayload);

        const quizReadyPayload = {
            taskId: task._id,
            quizId: quiz._id,
            title: task.title,
            topic: quiz.topic,
            message: `Quiz for "${task.title}" is ready.`
        };

        task.assignedStudents.forEach((studentId) => ioRef.to(studentId.toString()).emit('quiz-ready', quizReadyPayload));
        ioRef.to(task.teacherId.toString()).emit('quiz-ready', quizReadyPayload);
    }

    return quiz;
}

async function closeMeetings() {
    const now = new Date();

    const tasksToClose = await Task.find({
        type: 'class',
        status: 'active',
        endTime: { $lte: now }
    });

    for (const task of tasksToClose) {
        await closeMeetingByTask(task);
    }

    return tasksToClose.length;
}

async function forceCloseMeeting(taskId) {
    const task = await Task.findById(taskId);
    if (!task) {
        throw new Error('Task not found');
    }

    return closeMeetingByTask(task);
}

function initScheduler(io) {
    ioRef = io;

    const tick = async () => {
        if (schedulerRunning) {
            return;
        }

        schedulerRunning = true;
        try {
            await activateMeetings();
            await closeMeetings();
        } catch (error) {
            console.error('Scheduler tick error:', error.message);
        } finally {
            schedulerRunning = false;
        }
    };

    highPrecisionTimer = setInterval(() => {
        void tick();
    }, 1000);

    if (typeof highPrecisionTimer.unref === 'function') {
        highPrecisionTimer.unref();
    }

    // Keep minute cron as fallback safety net.
    cron.schedule('* * * * *', async () => {
        await tick();
    });

    console.log('Meeting scheduler started (1s precision + 1m fallback)');
}

module.exports = {
    initScheduler,
    activateMeetings,
    closeMeetings,
    forceCloseMeeting
};
