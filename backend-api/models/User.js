// apps/backend-api/models/User.js - COMPLETE REPLACEMENT
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['student', 'teacher'],
        required: true
    },
    studentYear: {
        type: String,
        enum: ['B-Tech 1st Year', 'B-Tech 2nd Year', 'B-Tech 3rd Year', 'B-Tech 4th Year'],
        required: function () {
            return this.role === 'student';
        }
    },
    teachingYears: [{
        type: String,
        enum: ['B-Tech 1st Year', 'B-Tech 2nd Year', 'B-Tech 3rd Year', 'B-Tech 4th Year']
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);