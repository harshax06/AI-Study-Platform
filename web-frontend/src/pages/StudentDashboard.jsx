import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { aiAPI, scoresAPI, tasksAPI } from '../api';

import NotificationBell from '../components/NotificationBell';
import ProfileModal from '../components/ProfileModal';

import './StudentDashboard.css';

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const socket = useSocket();

    const [tasks, setTasks] = useState([]);
    const [scores, setScores] = useState([]);
    const [quizByTask, setQuizByTask] = useState({});

    const [loading, setLoading] = useState(true);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [quizAlert, setQuizAlert] = useState(null);
    const [openQuizTaskId, setOpenQuizTaskId] = useState(null);
    const [openQuiz, setOpenQuiz] = useState(null);
    const [answers, setAnswers] = useState([]);

    const loadScores = async () => {
        const res = await scoresAPI.getMyScores();
        setScores(res.data.scores || []);
    };

    const loadTasks = async () => {
        const res = await tasksAPI.getStudentTasks();
        const taskData = res.data.tasks || [];
        setTasks(taskData);

        const quizEntries = await Promise.all(taskData.map(async (task) => {
            try {
                const quizRes = await aiAPI.getQuizForTask(task._id);
                return [task._id, quizRes.data.quiz];
            } catch {
                return [task._id, null];
            }
        }));

        setQuizByTask(Object.fromEntries(quizEntries));
    };

    const refreshAll = async () => {
        try {
            setLoading(true);
            await Promise.all([loadTasks(), loadScores()]);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshAll();
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

    useEffect(() => {
        if (!socket) {
            return;
        }

        const onNewTask = (payload) => {
            toast.success(payload?.title || 'New task assigned');
            refreshAll();
        };

        const onMeetingStarted = (payload) => {
            toast.success(`Meeting started: ${payload.title}`);
            refreshAll();
        };

        const onMeetingEnded = (payload) => {
            toast(`Meeting ended: ${payload.title}`);
            refreshAll();
        };

        const onQuizReady = (payload) => {
            setQuizAlert(payload);
            toast.success(payload?.message || 'Quiz available');
            refreshAll();
        };

        socket.on('new-task', onNewTask);
        socket.on('meeting-started', onMeetingStarted);
        socket.on('meeting-ended', onMeetingEnded);
        socket.on('quiz-ready', onQuizReady);

        return () => {
            socket.off('new-task', onNewTask);
            socket.off('meeting-started', onMeetingStarted);
            socket.off('meeting-ended', onMeetingEnded);
            socket.off('quiz-ready', onQuizReady);
        };
    }, [socket]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTasks((prev) => [...prev]);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        const upcoming = tasks.filter((task) => task.status === 'scheduled').length;
        const active = tasks.filter((task) => task.status === 'active').length;
        const completed = tasks.filter((task) => task.status === 'completed').length;
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, item) => sum + (item.finalScore || 0), 0) / scores.length) : 0;

        return {
            total: tasks.length,
            upcoming,
            active,
            completed,
            avgScore
        };
    }, [tasks, scores]);

    const formatCountdown = (task) => {
        if (!task.startTime || task.status === 'completed') {
            return null;
        }

        const now = new Date();
        const start = new Date(task.startTime);
        const diff = start - now;

        if (diff <= 0) {
            return task.status === 'active' ? 'Live now' : 'Started';
        }

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const canJoinMeeting = (task) => {
        if (task.type !== 'class' || !task.roomId) {
            return false;
        }

        if (task.status === 'active') {
            return true;
        }

        if (!task.startTime || !task.endTime) {
            return false;
        }

        const now = new Date();
        const start = new Date(task.startTime);
        const end = new Date(task.endTime);

        return now >= new Date(start.getTime() - 10 * 60000) && now <= end;
    };

    const openQuizForTask = async (taskId) => {
        try {
            const response = await aiAPI.getQuizForTask(taskId);
            const quiz = response.data.quiz;
            setOpenQuizTaskId(taskId);
            setOpenQuiz(quiz);
            setAnswers(new Array(quiz.questions.length).fill(null));
        } catch (error) {
            const status = error?.response?.status;

            if (status === 404) {
                try {
                    await aiAPI.generateQuizForTask(taskId);
                    const generated = await aiAPI.getQuizForTask(taskId);
                    const quiz = generated.data.quiz;

                    setQuizByTask((prev) => ({ ...prev, [taskId]: quiz }));
                    setOpenQuizTaskId(taskId);
                    setOpenQuiz(quiz);
                    setAnswers(new Array(quiz.questions.length).fill(null));
                    toast.success('Quiz generated. You can take it now.');
                    return;
                } catch (generationError) {
                    toast.error(generationError.response?.data?.error || 'Failed to generate quiz');
                    return;
                }
            }

            toast.error(error.response?.data?.error || 'Quiz not available yet');
        }
    };

    const submitQuiz = async () => {
        if (!openQuizTaskId || !openQuiz) {
            return;
        }

        if (answers.some((answer) => answer === null)) {
            toast.error('Answer all questions before submitting');
            return;
        }

        try {
            const response = await aiAPI.submitQuiz(openQuizTaskId, answers);
            toast.success(`Quiz submitted (${response.data.percentage}%)`);
            setOpenQuiz(null);
            setOpenQuizTaskId(null);
            setAnswers([]);
            await refreshAll();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to submit quiz');
        }
    };

    return (
        <div className="student-dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="user-info">
                        <div className="profile-dropdown-container" ref={dropdownRef}>
                            <div className="avatar">
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
                            <h1>Student Dashboard</h1>
                            <p>Welcome back, <strong>{user?.name}</strong></p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <NotificationBell />
                    </div>
                </div>
            </header>

            {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}

            {quizAlert && (
                <div className="quiz-alert">
                    <div><strong>Quiz Available</strong></div>
                    <div className="quiz-alert-title">{quizAlert.title}</div>
                    <button
                        className="quiz-alert-btn"
                        onClick={() => {
                            setQuizAlert(null);
                            openQuizForTask(quizAlert.taskId);
                        }}
                    >
                        Take Quiz
                    </button>
                </div>
            )}

            <section className="stats-section">
                <div className="stat-card stat-purple"><div className="stat-content"><h3>{stats.total}</h3><p>Total Tasks</p></div></div>
                <div className="stat-card stat-blue"><div className="stat-content"><h3>{stats.upcoming}</h3><p>Upcoming</p></div></div>
                <div className="stat-card stat-green"><div className="stat-content"><h3>{stats.active}</h3><p>Active</p></div></div>
                <div className="stat-card stat-orange"><div className="stat-content"><h3>{stats.avgScore}%</h3><p>Avg Score</p></div></div>
            </section>

            <main className="dashboard-content">
                <section className="classes-section">
                    <div className="section-header"><h2>My Classes</h2></div>

                    {loading ? (
                        <div className="loading-container"><p>Loading...</p></div>
                    ) : (
                        <div className="classes-grid">
                            {tasks.map((task) => (
                                <div key={task._id} className={`class-card ${task.type}`}>
                                    <div className="class-header">
                                        <div className="class-title-section">
                                            <h3>{task.title}</h3>
                                            <span className={`status-badge status-${task.status}`}>{task.status}</span>
                                        </div>
                                        <span className="class-type-badge">{task.type}</span>
                                    </div>

                                    <p className="class-agenda">{task.agenda}</p>

                                    <div className="class-meta">
                                        <div className="meta-item"><span>Teacher: {task.teacherId?.name}</span></div>
                                        {task.startTime && <div className="meta-item"><span>{new Date(task.startTime).toLocaleString()}</span></div>}
                                        {task.startTime && task.status !== 'completed' && (
                                            <div className="meta-item"><span>Countdown: {formatCountdown(task)}</span></div>
                                        )}
                                    </div>

                                    <div className="class-actions">
                                        {canJoinMeeting(task) && (
                                            <button className="action-btn join-btn" onClick={() => window.location.href = `/meet/${task.roomId}`}>
                                                Join Meeting
                                            </button>
                                        )}

                                        {!canJoinMeeting(task) && task.type === 'class' && (
                                            <button className="action-btn join-btn-disabled" disabled>
                                                Not Live
                                            </button>
                                        )}

                                        {task.type === 'class' && task.status === 'completed' && (
                                            <button className="action-btn submit-btn" onClick={() => openQuizForTask(task._id)}>
                                                {quizByTask[task._id] ? 'Take Quiz' : 'Generate & Take Quiz'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="performance-section">
                    <div className="section-header"><h2>Performance</h2></div>
                    <div className="scores-grid">
                        {scores.map((score) => (
                            <div key={score._id} className="score-card">
                                <div className="score-header">
                                    <h4>{score.taskId?.title}</h4>
                                    <span className="score-date">{new Date(score.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="score-value">
                                    <span className="score-number">{score.finalScore || 0}</span>
                                    <span className="score-total">/100</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {openQuiz && (
                <div className="modal-overlay" onClick={() => setOpenQuiz(null)}>
                    <div className="modal glass-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Quiz: {openQuiz.topic}</h2>
                            <button className="close-btn" onClick={() => setOpenQuiz(null)}>x</button>
                        </div>

                        <div className="modal-form">
                            {openQuiz.questions.map((question, questionIndex) => (
                                <div key={questionIndex} className="form-group">
                                    <label>{questionIndex + 1}. {question.question}</label>
                                    <div className="quiz-options-grid">
                                        {question.options.map((option, optionIndex) => (
                                            <button
                                                key={optionIndex}
                                                type="button"
                                                className={`btn-secondary quiz-option-btn ${answers[questionIndex] === optionIndex ? 'selected' : ''}`}
                                                onClick={() => {
                                                    const nextAnswers = [...answers];
                                                    nextAnswers[questionIndex] = optionIndex;
                                                    setAnswers(nextAnswers);
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setOpenQuiz(null)}>Close</button>
                                <button type="button" className="btn-primary" onClick={submitQuiz}>Submit Quiz</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
