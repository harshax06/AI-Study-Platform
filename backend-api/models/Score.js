// apps/backend-api/models/Score.js - COMPLETE REPLACEMENT (DELETE EVERYTHING AND PASTE THIS)
const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    relevanceScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    participation: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    speakingTime: {
        type: Number,
        default: 0
    },
    offTopicCount: {
        type: Number,
        default: 0
    },
    quizScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    quizCompleted: {
        type: Boolean,
        default: false
    },
    quizAttempts: {
        type: Number,
        default: 0
    },
    assignmentScore: {
        type: Number,
        min: 0,
        max: 100
    },
    submittedAt: {
        type: Date
    },
    finalScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    feedback: {
        type: String
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    gradedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate final score automatically
scoreSchema.methods.calculateFinalScore = function(taskType) {
    if (taskType === 'class') {
        this.finalScore = Math.round(
            (this.relevanceScore * 0.4) +
            (this.participation * 0.3) +
            (this.quizScore * 0.3)
        );
    } else if (taskType === 'assignment') {
        this.finalScore = this.assignmentScore || 0;
    }

    this.updatedAt = new Date();
    return this.finalScore;
};

module.exports = mongoose.model('Score', scoreSchema);