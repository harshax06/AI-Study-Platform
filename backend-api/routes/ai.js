const express = require('express');
const { body } = require('express-validator');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { auth, studentOnly } = require('../middleware/auth');
const {
    validateRequest,
    validateQuizGeneration,
    validateQuizSubmit
} = require('../middleware/validation');
const Task = require('../models/Task');
const Quiz = require('../models/Quiz');

const router = express.Router();

function fallbackQuestions(topic) {
    return [
        {
            question: `What is the primary objective of ${topic}?`,
            options: ['Apply core concepts correctly', 'Memorize definitions only', 'Avoid practical use', 'Ignore fundamentals'],
            correctIndex: 0,
            explanation: 'Core objective is to apply concepts in realistic scenarios.'
        },
        {
            question: `Which choice best demonstrates understanding of ${topic}?`,
            options: ['Using concepts to solve a problem', 'Repeating terms without context', 'Skipping analysis', 'Guessing outcomes'],
            correctIndex: 0,
            explanation: 'Understanding is shown through correct application and reasoning.'
        },
        {
            question: `What is a common mistake in ${topic}?`,
            options: ['Ignoring assumptions and constraints', 'Reviewing fundamentals', 'Testing with examples', 'Checking outcomes'],
            correctIndex: 0,
            explanation: 'Missing assumptions often leads to incorrect results.'
        },
        {
            question: `How should students improve in ${topic}?`,
            options: ['Practice with structured feedback', 'Rely only on intuition', 'Avoid revision', 'Use one example only'],
            correctIndex: 0,
            explanation: 'Deliberate practice with feedback improves mastery.'
        },
        {
            question: `Why is ${topic} important in professional work?`,
            options: ['It enables reliable problem solving', 'It has no practical impact', 'It replaces planning', 'It removes the need for testing'],
            correctIndex: 0,
            explanation: 'It supports reliable and repeatable decisions in real systems.'
        }
    ];
}

async function generateWithGemini(topic, numQuestions = 5) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return fallbackQuestions(topic);
    }

    try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `Generate exactly ${numQuestions} MCQ questions for: "${topic}".
Return ONLY a JSON array.
Each item must contain:
- question (string)
- options (array of exactly 4 strings)
- correctIndex (number 0-3)
- explanation (string)
No markdown.`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return fallbackQuestions(topic);
        }

        return parsed.slice(0, numQuestions).map((q) => ({
            question: String(q.question || '').trim(),
            options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [],
            correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
            explanation: String(q.explanation || '')
        })).filter((q) => q.question && q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex <= 3);
    } catch (error) {
        return fallbackQuestions(topic);
    }
}

async function generateQuizForTask(taskId) {
    const task = await Task.findById(taskId);
    if (!task) {
        throw new Error('Task not found');
    }

    const existing = await Quiz.findOne({ taskId: task._id });
    if (existing) {
        return existing;
    }

    const topic = task.agenda || task.title;
    const questions = await generateWithGemini(topic, 5);

    const quiz = new Quiz({
        taskId: task._id,
        topic,
        questions
    });

    await quiz.save();
    return quiz;
}

router.post('/check-topic', auth, [
    body('agenda').trim().isLength({ min: 3 }).withMessage('agenda is required'),
    body('text').trim().isLength({ min: 3 }).withMessage('text is required'),
    validateRequest
], async (req, res) => {
    try {
        const { agenda, text } = req.body;
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were',
            'be', 'being', 'been', 'it', 'this', 'that', 'as', 'at', 'by', 'from', 'we', 'you', 'they', 'i'
        ]);

        const tokenize = (value) => value
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((token) => token.length > 2 && !stopWords.has(token));

        const agendaTerms = [...new Set(tokenize(agenda))];
        const textTerms = [...new Set(tokenize(text))];

        let score = 0;
        if (agendaTerms.length > 0 && textTerms.length > 0) {
            const overlapCount = agendaTerms.filter((term) => textTerms.includes(term)).length;
            const agendaCoverage = overlapCount / agendaTerms.length;
            const textRelevance = overlapCount / textTerms.length;
            score = Number((agendaCoverage * 0.75 + textRelevance * 0.25).toFixed(3));
        }

        const isOffTopic = score < 0.35;
        const keyTerms = agendaTerms.slice(0, 4).join(', ');
        const politeMessage = isOffTopic
            ? `Let's gently refocus on the topic: ${agenda}. Please concentrate on the key points.`
            : 'Great discussion. You are staying aligned with the topic.';

        return res.json({
            score,
            is_off_topic: isOffTopic,
            message: politeMessage,
            suggestions: isOffTopic
                ? [
                    keyTerms ? `Please include these key terms: ${keyTerms}` : 'Please reconnect to the agenda details.',
                    'Summarize one point from the agenda before moving forward.'
                ]
                : ['Continue building on the current agenda points.']
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/generate-quiz', auth, [
    body('topic').trim().isLength({ min: 3 }).withMessage('topic is required'),
    body('numQuestions').optional().isInt({ min: 1, max: 10 }).withMessage('numQuestions must be 1-10'),
    validateRequest
], async (req, res) => {
    try {
        const { topic, numQuestions = 5 } = req.body;

        const questions = await generateWithGemini(topic, numQuestions);
        return res.json({ topic, questions });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/generate-quiz-for-task/:taskId', auth, validateQuizGeneration, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const userId = req.userId.toString();
        const isTeacherOwner = task.teacherId.toString() === userId;
        const isAssignedStudent = task.assignedStudents.some((s) => s.toString() === userId);

        if (!isTeacherOwner && !isAssignedStudent) {
            return res.status(403).json({ error: 'Not authorized for this task' });
        }

        const quiz = await generateQuizForTask(task._id);

        const io = req.app.get('io');
        if (io) {
            const payload = {
                taskId: task._id,
                quizId: quiz._id,
                title: task.title,
                topic: quiz.topic,
                message: `Quiz for "${task.title}" is ready.`
            };

            task.assignedStudents.forEach((studentId) => io.to(studentId.toString()).emit('quiz-ready', payload));
            io.to(task.teacherId.toString()).emit('quiz-ready', payload);
        }

        return res.json({ message: 'Quiz generated', quiz });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/quiz/:taskId', auth, validateQuizGeneration, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const userId = req.userId.toString();
        const isTeacherOwner = task.teacherId.toString() === userId;
        const isAssignedStudent = task.assignedStudents.some((s) => s.toString() === userId);

        if (!isTeacherOwner && !isAssignedStudent) {
            return res.status(403).json({ error: 'Not authorized for this task' });
        }

        const quiz = await Quiz.findOne({ taskId: task._id });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found for this task' });
        }

        return res.json({ quiz });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/quiz/:taskId/submit', auth, studentOnly, validateQuizSubmit, async (req, res) => {
    try {
        const { answers } = req.body;

        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const isAssignedStudent = task.assignedStudents.some((s) => s.toString() === req.userId.toString());
        if (!isAssignedStudent) {
            return res.status(403).json({ error: 'Not authorized for this task' });
        }

        const quiz = await Quiz.findOne({ taskId: task._id });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        if (answers.length !== quiz.questions.length) {
            return res.status(400).json({ error: `answers length must equal ${quiz.questions.length}` });
        }

        const existingSubmission = quiz.completions.find((c) => c.studentId.toString() === req.userId.toString());
        if (existingSubmission) {
            return res.json({
                message: 'Quiz already submitted',
                score: existingSubmission.score,
                percentage: existingSubmission.percentage,
                completedAt: existingSubmission.completedAt
            });
        }

        let correct = 0;
        quiz.questions.forEach((question, index) => {
            if (answers[index] === question.correctIndex) {
                correct += 1;
            }
        });

        const total = quiz.questions.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        quiz.completions.push({
            studentId: req.userId,
            score: correct,
            percentage,
            answers,
            completedAt: new Date()
        });

        await quiz.save();

        return res.json({
            message: 'Quiz submitted',
            score: correct,
            total,
            percentage
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.generateQuizForTask = generateQuizForTask;
