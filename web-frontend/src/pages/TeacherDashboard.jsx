import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { authAPI, tasksAPI } from '../api';
import ProfileModal from '../components/ProfileModal';

import './TeacherDashboard.css';

const INITIAL_FORM = {
    title: '',
    agenda: '',
    type: 'class',
    description: '',
    targetYear: '',
    duration: 60,
    startTime: '',
    endTime: ''
};

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const { user, setUser, logout } = useAuth();

    const [tasks, setTasks] = useState([]);
    const [students, setStudents] = useState([]);
    const [analytics, setAnalytics] = useState([]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [selectedTask, setSelectedTask] = useState(null);
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [scheduleData, setScheduleData] = useState({ startTime: '', endTime: '' });

    const [loading, setLoading] = useState(true);

    const refreshDashboard = async () => {
        try {
            setLoading(true);

            const [freshUser, tasksRes, studentsRes, analyticsRes] = await Promise.all([
                authAPI.getMe(),
                tasksAPI.getTeacherTasks(),
                tasksAPI.getStudents(),
                tasksAPI.getAnalytics()
            ]);

            setUser(freshUser.data.user);
            setTasks(tasksRes.data.tasks || []);
            setStudents(studentsRes.data.students || []);
            setAnalytics(analyticsRes.data.analytics || []);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to load teacher dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshDashboard();
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const stats = useMemo(() => {
        const activeClasses = tasks.filter((task) => task.status === 'active').length;
        const scheduledClasses = tasks.filter((task) => task.status === 'scheduled').length;
        const completed = tasks.filter((task) => task.status === 'completed').length;

        const avgQuizScoreValues = analytics
            .map((entry) => entry.avgQuizScore)
            .filter((value) => typeof value === 'number');

        const avgQuizScore = avgQuizScoreValues.length > 0
            ? Math.round(avgQuizScoreValues.reduce((sum, value) => sum + value, 0) / avgQuizScoreValues.length)
            : 0;

        return {
            totalTasks: tasks.length,
            activeClasses,
            scheduledClasses,
            completed,
            studentCount: students.length,
            avgQuizScore
        };
    }, [tasks, students, analytics]);

    const handleCreateTask = async (event) => {
        event.preventDefault();

        if (!formData.targetYear) {
            toast.error('Select target year');
            return;
        }

        try {
            await tasksAPI.create(formData);
            toast.success('Task created');
            setFormData(INITIAL_FORM);
            setShowCreateModal(false);
            await refreshDashboard();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create task');
        }
    };

    const handleScheduleTask = async (event) => {
        event.preventDefault();
        if (!selectedTask) {
            return;
        }

        try {
            await tasksAPI.scheduleTask(selectedTask._id, scheduleData);
            toast.success('Task scheduled');
            setShowScheduleModal(false);
            setSelectedTask(null);
            setScheduleData({ startTime: '', endTime: '' });
            await refreshDashboard();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to schedule task');
        }
    };

    const handleDeleteTask = async (taskId, title) => {
        if (!window.confirm(`Delete task "${title}"?`)) {
            return;
        }

        try {
            await tasksAPI.deleteTask(taskId);
            toast.success('Task deleted');
            await refreshDashboard();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete task');
        }
    };

    const openScheduleModal = (task) => {
        setSelectedTask(task);

        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(10, 0, 0, 0);

        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        setScheduleData({
            startTime: start.toISOString().slice(0, 16),
            endTime: end.toISOString().slice(0, 16)
        });

        setShowScheduleModal(true);
    };

    const years = user?.teachingYears || [];

    return (
        <div className="teacher-dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="user-info">
                        <div className="profile-dropdown-container" ref={dropdownRef}>
                            <div className="avatar" style={{ cursor: 'pointer' }}>
                                <button
                                    type="button"
                                    className="avatar-button"
                                    onClick={() => setShowDropdown((prev) => !prev)}
                                    aria-label="Open profile menu"
                                    aria-expanded={showDropdown}
                                >
                                    {user?.name?.charAt(0)?.toUpperCase()}
                                </button>
                            </div>

                            {showDropdown && (
                                <div className="profile-dropdown">
                                    <button
                                        className="dropdown-item"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setShowProfileModal(true);
                                            setShowDropdown(false);
                                        }}
                                    >
                                        My Profile
                                    </button>
                                    <button
                                        className="dropdown-item danger"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setShowDropdown(false);
                                            logout();
                                        }}
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <h1>Teacher Dashboard</h1>
                            <p>Welcome back, <strong>{user?.name}</strong></p>
                        </div>
                    </div>
                </div>
            </header>

            {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}

            <section className="stats-section">
                <div className="stat-card stat-purple"><div className="stat-content"><h3>{stats.totalTasks}</h3><p>Total Tasks</p></div></div>
                <div className="stat-card stat-blue"><div className="stat-content"><h3>{stats.activeClasses}</h3><p>Active</p></div></div>
                <div className="stat-card stat-green"><div className="stat-content"><h3>{stats.scheduledClasses}</h3><p>Scheduled</p></div></div>
                <div className="stat-card stat-orange"><div className="stat-content"><h3>{stats.avgQuizScore}%</h3><p>Avg Quiz Score</p></div></div>
            </section>

            <main className="dashboard-content">
                <section className="tasks-section">
                    <div className="section-header">
                        <h2>My Tasks</h2>
                        <button className="create-btn" onClick={() => setShowCreateModal(true)}>Create Task</button>
                    </div>

                    {loading ? (
                        <div className="loading-container"><p>Loading...</p></div>
                    ) : (
                        <div className="tasks-grid">
                            {tasks.map((task) => (
                                <div key={task._id} className={`task-card ${task.status}`}>
                                    <div className="task-card-header">
                                        <div className="task-title-section">
                                            <h3>{task.title}</h3>
                                            <span className={`status-badge status-${task.status}`}>{task.status}</span>
                                        </div>
                                        <span className="task-type-badge">{task.type}</span>
                                    </div>

                                    <p className="task-agenda">{task.agenda}</p>

                                    <div className="task-meta">
                                        <div className="meta-item"><span>{task.targetYear}</span></div>
                                        <div className="meta-item"><span>{task.assignedStudents?.length || 0} students</span></div>
                                        {task.startTime && <div className="meta-item"><span>{new Date(task.startTime).toLocaleString()}</span></div>}
                                    </div>

                                    <div className="task-actions">
                                        {task.status === 'draft' && (
                                            <button className="action-btn schedule-btn" onClick={() => openScheduleModal(task)}>
                                                Schedule
                                            </button>
                                        )}

                                        {task.status === 'active' && task.roomId && (
                                            <button className="action-btn schedule-btn" onClick={() => navigate(`/meet/${task.roomId}`)}>
                                                Start/Join Meeting
                                            </button>
                                        )}

                                        {task.status === 'scheduled' && task.roomId && (
                                            <button
                                                className="action-btn copy-btn"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/meet/${task.roomId}`);
                                                    toast.success('Meeting link copied');
                                                }}
                                            >
                                                Copy Link
                                            </button>
                                        )}

                                        <button className="action-btn delete-btn" onClick={() => handleDeleteTask(task._id, task.title)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="tasks-section" style={{ marginTop: '24px' }}>
                    <div className="section-header"><h2>Analytics</h2></div>
                    <div className="tasks-grid">
                        {analytics.map((entry) => (
                            <div key={entry.taskId} className="task-card">
                                <div className="task-title-section">
                                    <h3>{entry.title}</h3>
                                </div>
                                <div className="task-meta">
                                    <div className="meta-item"><span>Assigned: {entry.assignedCount}</span></div>
                                    <div className="meta-item"><span>Attendance: {entry.attendanceCount}</span></div>
                                    <div className="meta-item"><span>Quiz completions: {entry.quizCompletions}</span></div>
                                    <div className="meta-item"><span>Avg quiz: {entry.avgQuizScore ?? '-'}%</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal glass-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create Task</h2>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>X</button>
                        </div>

                        <form onSubmit={handleCreateTask} className="modal-form">
                            <div className="form-group">
                                <label>Target Year</label>
                                <select
                                    value={formData.targetYear}
                                    onChange={(event) => setFormData({ ...formData, targetYear: event.target.value })}
                                    required
                                >
                                    <option value="">Select year</option>
                                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Agenda</label>
                                <textarea
                                    value={formData.agenda}
                                    onChange={(event) => setFormData({ ...formData, agenda: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Start Time (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>End Time (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showScheduleModal && selectedTask && (
                <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
                    <div className="modal glass-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Schedule Task</h2>
                            <button className="close-btn" onClick={() => setShowScheduleModal(false)}>X</button>
                        </div>

                        <form onSubmit={handleScheduleTask} className="modal-form">
                            <div className="form-group">
                                <label>Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={scheduleData.startTime}
                                    onChange={(event) => setScheduleData({ ...scheduleData, startTime: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>End Time</label>
                                <input
                                    type="datetime-local"
                                    value={scheduleData.endTime}
                                    onChange={(event) => setScheduleData({ ...scheduleData, endTime: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Schedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
