// apps/backend-api/routes/scores.js
const express = require('express');
const Score = require('../models/Score');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { auth, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// Update/Create score for a student in a task
router.post('/', auth, async (req, res) => {
    try {
        const { 
            studentId, 
            taskId, 
            relevanceScore, 
            participation, 
            speakingTime, 
            offTopicCount, 
            quizScore,
            quizCompleted,
            assignmentScore,
            feedback
        } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        let score = await Score.findOne({ studentId, taskId });

        if (score) {
            // Update existing score
            if (relevanceScore !== undefined) score.relevanceScore = relevanceScore;
            if (participation !== undefined) score.participation = participation;
            if (speakingTime !== undefined) score.speakingTime = speakingTime;
            if (offTopicCount !== undefined) score.offTopicCount = offTopicCount;
            if (quizScore !== undefined) {
                score.quizScore = quizScore;
                score.quizCompleted = true;
                score.quizAttempts += 1;
            }
            if (assignmentScore !== undefined) {
                score.assignmentScore = assignmentScore;
                score.submittedAt = new Date();
            }
            if (feedback !== undefined) score.feedback = feedback;
        } else {
            // Create new score
            score = new Score({
                studentId,
                taskId,
                relevanceScore: relevanceScore || 0,
                participation: participation || 0,
                speakingTime: speakingTime || 0,
                offTopicCount: offTopicCount || 0,
                quizScore: quizScore || 0,
                quizCompleted: quizCompleted || false,
                assignmentScore: assignmentScore || 0,
                feedback: feedback || ''
            });
        }

        // Calculate final score
        score.calculateFinalScore(task.type);
        
        // If graded by teacher
        if (req.user.role === 'teacher') {
            score.gradedBy = req.userId;
            score.gradedAt = new Date();
            
            // Send notification to student
            await Notification.create({
                userId: studentId,
                type: 'score_updated',
                title: 'Score Updated',
                message: `Your score for "${task.title}" has been updated: ${score.finalScore}/${task.maxScore}`,
                taskId: task._id
            });
        }

        await score.save();

        res.json({ 
            message: 'Score updated successfully', 
            score 
        });
    } catch (error) {
        console.error('Score update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Submit quiz score (Student)
router.post('/submit-quiz', auth, async (req, res) => {
    try {
        const { taskId, quizScore, totalQuestions, correctAnswers } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        let score = await Score.findOne({ studentId: req.userId, taskId });

        if (!score) {
            score = new Score({
                studentId: req.userId,
                taskId
            });
        }

        // Calculate quiz score percentage
        const quizPercentage = Math.round((correctAnswers / totalQuestions) * 100);
        score.quizScore = quizPercentage;
        score.quizCompleted = true;
        score.quizAttempts += 1;

        // Recalculate final score
        score.calculateFinalScore(task.type);
        await score.save();

        res.json({ 
            message: 'Quiz submitted successfully',
            score: score.quizScore,
            finalScore: score.finalScore
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get scores for a task (Teacher)
router.get('/task/:taskId', auth, teacherOnly, async (req, res) => {
    try {
        const scores = await Score.find({ taskId: req.params.taskId })
            .populate('studentId', 'name email')
            .populate('taskId', 'title type maxScore');

        res.json({ scores });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get my scores (Student)
router.get('/my', auth, async (req, res) => {
    try {
        const scores = await Score.find({ studentId: req.userId })
            .populate('taskId', 'title agenda type maxScore scheduledAt')
            .sort({ createdAt: -1 });

        res.json({ scores });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get leaderboard for a task
router.get('/leaderboard/:taskId', auth, async (req, res) => {
    try {
        const scores = await Score.find({ taskId: req.params.taskId })
            .populate('studentId', 'name')
            .sort({ finalScore: -1 })
            .limit(10);

        res.json({
            leaderboard: scores.map((s, index) => ({
                rank: index + 1,
                name: s.studentId.name,
                score: s.finalScore,
                quizCompleted: s.quizCompleted
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;