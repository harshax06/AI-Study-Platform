const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' }
}, { _id: false });

const completionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },             // raw correct count
    percentage: { type: Number, required: true },         // 0-100
    answers: [{ type: Number }],                          // student's chosen indices
    completedAt: { type: Date, default: Date.now }
}, { _id: false });

const quizSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        unique: true
    },
    topic: { type: String, required: true },
    questions: [questionSchema],
    generatedAt: { type: Date, default: Date.now },
    completions: [completionSchema]
});

module.exports = mongoose.model('Quiz', quizSchema);
