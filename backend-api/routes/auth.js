const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Score = require('../models/Score');
const { auth } = require('../middleware/auth');
const {
    BTECH_YEARS,
    validateRegister,
    validateLogin,
    validateProfileUpdate
} = require('../middleware/validation');
const config = require('../config');
const { logAudit, logSecurity } = require('../services/auditLogger');
const { normalizeYear, normalizeYears } = require('../utils/years');

const router = express.Router();

const serializeUser = (user) => ({
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentYear: user.studentYear,
    teachingYears: user.teachingYears
});

const createToken = (user) => jwt.sign(
    { userId: user._id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
);

router.post('/register', validateRegister, async (req, res) => {
    try {
        const { name, email, password, role, studentYear, teachingYears } = req.body;
        const normalizedStudentYear = normalizeYear(studentYear);
        const normalizedTeachingYears = normalizeYears(teachingYears);

        if (role === 'student' && !normalizedStudentYear) {
            return res.status(400).json({ error: 'Students must select studentYear' });
        }

        if (role === 'teacher' && normalizedTeachingYears.length === 0) {
            return res.status(400).json({ error: 'Teachers must select at least one teaching year' });
        }

        if (role === 'teacher') {
            const invalidTeachingYears = (teachingYears || []).filter((year) => !normalizeYear(year));
            if (invalidTeachingYears.length > 0) {
                return res.status(400).json({ error: 'Invalid teachingYears values' });
            }
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            logSecurity('auth.register.conflict', { correlationId: req.correlationId, email: email.toLowerCase() });
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const payload = {
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            studentYear: role === 'student' ? normalizedStudentYear : undefined,
            teachingYears: role === 'teacher' ? [...new Set(normalizedTeachingYears)] : []
        };

        const user = await User.create(payload);
        const token = createToken(user);

        logAudit('auth.register.success', {
            correlationId: req.correlationId,
            userId: user._id.toString(),
            role: user.role,
            email: user.email
        });

        return res.status(201).json({
            message: 'User registered successfully',
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/login', validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            logSecurity('auth.login.failed', {
                correlationId: req.correlationId,
                reason: 'email_not_found',
                email: email.toLowerCase()
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await user.comparePassword(password);
        if (!validPassword) {
            logSecurity('auth.login.failed', {
                correlationId: req.correlationId,
                reason: 'invalid_password',
                userId: user._id.toString(),
                email: user.email
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = createToken(user);

        logAudit('auth.login.success', {
            correlationId: req.correlationId,
            userId: user._id.toString(),
            role: user.role,
            email: user.email
        });

        return res.json({
            message: 'Login successful',
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ user: serializeUser(user) });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/profile', auth, validateProfileUpdate, async (req, res) => {
    try {
        const { name, email, password, studentYear, teachingYears } = req.body;
        const normalizedStudentYear = normalizeYear(studentYear);
        const normalizedTeachingYears = normalizeYears(teachingYears);
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (email && email.toLowerCase() !== user.email) {
            const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
            if (existing) {
                return res.status(409).json({ error: 'Email already in use' });
            }
            user.email = email.toLowerCase();
        }

        if (name) {
            user.name = name.trim();
        }

        if (user.role === 'student' && normalizedStudentYear) {
            user.studentYear = normalizedStudentYear;
        }

        if (user.role === 'teacher' && teachingYears) {
            if (normalizedTeachingYears.length === 0) {
                return res.status(400).json({ error: 'At least one teaching year is required' });
            }
            user.teachingYears = [...new Set(normalizedTeachingYears)];
        }

        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        logAudit('auth.profile.updated', {
            correlationId: req.correlationId,
            userId: user._id.toString(),
            role: user.role
        });

        return res.json({
            message: 'Profile updated successfully',
            user: serializeUser(user)
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.delete('/profile', auth, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'teacher') {
            await Task.deleteMany({ teacherId: userId });
            await Notification.deleteMany({ userId });
        }

        if (user.role === 'student') {
            await Task.updateMany({ assignedStudents: userId }, { $pull: { assignedStudents: userId } });
            await Score.deleteMany({ studentId: userId });
            await Notification.deleteMany({ userId });
        }

        await User.findByIdAndDelete(userId);

        logAudit('auth.profile.deleted', {
            correlationId: req.correlationId,
            userId: userId.toString(),
            role: user.role,
            email: user.email
        });

        return res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
