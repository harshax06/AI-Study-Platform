// apps/backend-api/routes/notifications.js - CREATE THIS FILE
const express = require('express');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all user notifications
router.get('/', auth, async (req, res) => {
    try {
        console.log('🔔 Getting notifications for user:', req.userId);

        const notifications = await Notification.find({ userId: req.userId })
            .populate('taskId', 'title type scheduledAt startTime')
            .sort({ createdAt: -1 })
            .limit(50);

        console.log(`✅ Found ${notifications.length} notifications`);

        res.json({ notifications });
    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.userId,
            read: false
        });

        console.log(`🔔 User ${req.userId} has ${count} unread notifications`);

        res.json({ count });
    } catch (error) {
        console.error('❌ Unread count error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ notification });
    } catch (error) {
        console.error('❌ Mark read error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark all as read
router.patch('/mark-all-read', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, read: false },
            { read: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('❌ Mark all read error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('❌ Delete notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;