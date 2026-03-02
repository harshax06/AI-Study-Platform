const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    durationMinutes: { type: Number, default: 0 }
});

// Compound index — one record per student per task
attendanceSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
