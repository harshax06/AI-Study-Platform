// apps/backend-api/models/Task.js - COMPLETE REPLACEMENT (DELETE EVERYTHING AND PASTE THIS)
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    agenda: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['class', 'assignment'],
        default: 'class'
    },
    description: {
        type: String,
        trim: true
    },
    keywords: [{
        type: String,
        trim: true
    }],
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Target year for this task - MUST match User.js studentYear enum
    targetYear: {
        type: String,
        enum: ['B-Tech 1st Year', 'B-Tech 2nd Year', 'B-Tech 3rd Year', 'B-Tech 4th Year'],
        required: true
    },
    assignedStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    meetingLink: {
        type: String
    },
    roomId: {
        type: String
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    scheduledAt: {
        type: Date
    },
    dueDate: {
        type: Date
    },
    duration: {
        type: Number,
        default: 60
    },
    notificationSent: {
        type: Boolean,
        default: false
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

// Method to check if task is ready for students
taskSchema.methods.isReadyForStudents = function () {
    return this.status === 'scheduled' && this.startTime && this.endTime;
};

// Method to check if meeting can start now
taskSchema.methods.canStartNow = function () {
    if (this.type !== 'class' || !this.startTime || !this.endTime) {
        return false;
    }

    const now = new Date();
    const earlyJoinBuffer = 10 * 60000; // 10 minutes before
    const start = new Date(this.startTime);
    const end = new Date(this.endTime);

    return now >= (start.getTime() - earlyJoinBuffer) && now <= end;
};

// Method to check if meeting has passed
taskSchema.methods.hasMeetingPassed = function () {
    if (!this.endTime) return false;
    return new Date() > new Date(this.endTime);
};

module.exports = mongoose.model('Task', taskSchema);