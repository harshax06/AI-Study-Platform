import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { notificationsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

import './NotificationBell.css';

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        loadNotifications();
        loadUnreadCount();

        const interval = setInterval(() => {
            loadUnreadCount();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!showDropdown) {
            return undefined;
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowDropdown(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showDropdown]);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const res = await notificationsAPI.getAll();
            setNotifications(res.data.notifications || []);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const res = await notificationsAPI.getUnreadCount();
            setUnreadCount(res.data.count || 0);
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationsAPI.markAsRead(id);
            setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationsAPI.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await notificationsAPI.delete(id);
            setNotifications((prev) => prev.filter((n) => n._id !== id));
            loadUnreadCount();
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleNotificationClick = async (notif) => {
        if (!notif.read) {
            await handleMarkAsRead(notif._id);
        }

        setShowDropdown(false);

        if (user?.role === 'student') {
            navigate('/student');
        } else if (user?.role === 'teacher') {
            navigate('/teacher');
        }
    };

    const getNotificationIcon = (type) => {
        const icons = {
            new_class: '\u{1F4DA}',
            new_assignment: '\u{1F4DD}',
            meeting_reminder: '\u{23F0}',
            quiz_available: '\u{2753}',
            score_updated: '\u{1F4CA}'
        };

        return icons[type] || '\u{1F514}';
    };

    const formatTime = (date) => {
        const now = new Date();
        const notifDate = new Date(date);
        const diffMs = now - notifDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return notifDate.toLocaleDateString();
    };

    return (
        <div className="notification-bell">
            <button
                className="bell-button"
                aria-label="Open notifications"
                aria-expanded={showDropdown}
                onClick={() => {
                    setShowDropdown(!showDropdown);
                    if (!showDropdown) {
                        loadNotifications();
                    }
                }}
            >
                <span className="bell-icon">{'\u{1F514}'}</span>
                {unreadCount > 0 && (
                    <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {showDropdown && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                className="mark-all-read"
                                onClick={handleMarkAllAsRead}
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div className="loading">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="empty-notifications">
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif._id}
                                    className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="notif-icon">{getNotificationIcon(notif.type)}</div>
                                    <div className="notif-content">
                                        <h4>{notif.title}</h4>
                                        <p>{notif.message}</p>
                                        <span className="notif-time">{formatTime(notif.createdAt)}</span>
                                    </div>
                                    <button
                                        className="delete-notif"
                                        aria-label="Delete notification"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleDelete(notif._id);
                                        }}
                                    >
                                        x
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
