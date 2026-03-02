const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, config.jwtSecret);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        req.user = user;
        req.userId = decoded.userId;
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const teacherOnly = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Teachers only.' });
    }
    return next();
};

const studentOnly = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied. Students only.' });
    }
    return next();
};

module.exports = { auth, teacherOnly, studentOnly };
