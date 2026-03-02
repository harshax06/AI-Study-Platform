// apps/backend-api/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const Score = require('../models/Score');
const Notification = require('../models/Notification');

// Clear all database records (FOR TESTING ONLY!)
router.delete('/clear-database', async (req, res) => {
    try {
        // Delete all records
        const userResult = await User.deleteMany({});
        const taskResult = await Task.deleteMany({});
        const scoreResult = await Score.deleteMany({});
        const notificationResult = await Notification.deleteMany({});

        res.json({
            success: true,
            message: 'Database cleared successfully',
            deletedCounts: {
                users: userResult.deletedCount,
                tasks: taskResult.deletedCount,
                scores: scoreResult.deletedCount,
                notifications: notificationResult.deletedCount
            }
        });
    } catch (err) {
        console.error('Error clearing database:', err);
        res.status(500).json({ error: 'Failed to clear database' });
    }
});

module.exports = router;
