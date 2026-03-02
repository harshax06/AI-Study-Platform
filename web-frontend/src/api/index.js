import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url || '';

        if (status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export const authAPI = {
    register: (data) => api.post('/api/auth/register', data),
    login: (data) => api.post('/api/auth/login', data),
    getMe: () => api.get('/api/auth/me'),
    updateProfile: (data) => api.put('/api/auth/profile', data),
    deleteAccount: () => api.delete('/api/auth/profile')
};

export const aiAPI = {
    checkTopic: (data) => api.post('/api/ai/check-topic', data),
    generateQuiz: (data) => api.post('/api/ai/generate-quiz', data),
    generateQuizForTask: (taskId) => api.post(`/api/ai/generate-quiz-for-task/${taskId}`),
    getQuizForTask: (taskId) => api.get(`/api/ai/quiz/${taskId}`),
    submitQuiz: (taskId, answers) => api.post(`/api/ai/quiz/${taskId}/submit`, { answers })
};

export const tasksAPI = {
    create: (data) => api.post('/api/tasks', data),
    scheduleTask: (id, data) => api.post(`/api/tasks/${id}/schedule`, data),
    deleteTask: (id) => api.delete(`/api/tasks/${id}`),
    updateTask: (id, data) => api.put(`/api/tasks/${id}`, data),
    getTeacherTasks: () => api.get('/api/tasks/teacher'),
    getStudentTasks: () => api.get('/api/tasks/student'),
    getById: (id) => api.get(`/api/tasks/${id}`),
    getByRoomId: (roomId) => api.get(`/api/tasks/room/${roomId}`),
    getStudents: () => api.get('/api/tasks/users/students'),
    markAttendance: (taskId) => api.post(`/api/tasks/${taskId}/attend`),
    getAttendees: (taskId) => api.get(`/api/tasks/${taskId}/attendees`),
    getAnalytics: () => api.get('/api/tasks/analytics/overview')
};

export const scoresAPI = {
    update: (data) => api.post('/api/scores', data),
    getForTask: (taskId) => api.get(`/api/scores/task/${taskId}`),
    getMyScores: () => api.get('/api/scores/my'),
    getLeaderboard: (taskId) => api.get(`/api/scores/leaderboard/${taskId}`)
};

export const notificationsAPI = {
    getAll: () => api.get('/api/notifications'),
    getUnreadCount: () => api.get('/api/notifications/unread-count'),
    markAsRead: (id) => api.patch(`/api/notifications/${id}/read`),
    markAllAsRead: () => api.patch('/api/notifications/mark-all-read'),
    delete: (id) => api.delete(`/api/notifications/${id}`)
};

export default api;
