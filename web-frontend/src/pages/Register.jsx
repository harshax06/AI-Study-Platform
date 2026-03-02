import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Auth.css';

const YEARS = ['B-Tech 1st Year', 'B-Tech 2nd Year', 'B-Tech 3rd Year', 'B-Tech 4th Year'];

const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const nextParam = new URLSearchParams(location.search).get('next');
    const safeNextPath =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
    const loginLink = safeNextPath ? `/login?next=${encodeURIComponent(safeNextPath)}` : '/login';

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'student',
        studentYear: YEARS[0],
        teachingYears: []
    });

    const handleRoleChange = (role) => {
        setFormData((prev) => ({
            ...prev,
            role,
            studentYear: role === 'student' ? YEARS[0] : '',
            teachingYears: role === 'teacher' ? prev.teachingYears : []
        }));
    };

    const handleTeachingYearToggle = (year) => {
        setFormData((prev) => ({
            ...prev,
            teachingYears: prev.teachingYears.includes(year)
                ? prev.teachingYears.filter((value) => value !== year)
                : [...prev.teachingYears, year]
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            if (formData.role === 'student' && !formData.studentYear) {
                toast.error('Please select your year');
                return;
            }

            if (formData.role === 'teacher' && formData.teachingYears.length === 0) {
                toast.error('Please select at least one year to teach');
                return;
            }

            const payload = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role
            };

            if (formData.role === 'student') {
                payload.studentYear = formData.studentYear;
            }

            if (formData.role === 'teacher') {
                payload.teachingYears = formData.teachingYears;
            }

            const res = await authAPI.register(payload);
            const { user, token } = res.data;
            login(user, token);
            toast.success('Registration successful');

            navigate(safeNextPath || (user.role === 'teacher' ? '/teacher' : '/student'));
        } catch (err) {
            console.error('Registration error:', err);
            const apiError = err.response?.data;
            const detailMessage = apiError?.details?.[0]?.message;
            toast.error(detailMessage || apiError?.error || 'Registration failed');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-background" aria-hidden="true">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">NEW</div>
                        <h1>Create Account</h1>
                        <p className="auth-subtitle">Join the AI Study Platform</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                                placeholder="your.email@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                                placeholder="Create a strong password"
                                minLength="6"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>I am a</label>
                            <div className="role-selector">
                                <button
                                    type="button"
                                    className={`role-option ${formData.role === 'student' ? 'active' : ''}`}
                                    onClick={() => handleRoleChange('student')}
                                >
                                    <span className="role-icon">ST</span>
                                    <span>Student</span>
                                </button>
                                <button
                                    type="button"
                                    className={`role-option ${formData.role === 'teacher' ? 'active' : ''}`}
                                    onClick={() => handleRoleChange('teacher')}
                                >
                                    <span className="role-icon">TE</span>
                                    <span>Teacher</span>
                                </button>
                            </div>
                        </div>

                        {formData.role === 'student' && (
                            <div className="form-group">
                                <label>Current Year</label>
                                <select
                                    value={formData.studentYear}
                                    onChange={(event) => setFormData({ ...formData, studentYear: event.target.value })}
                                    required
                                >
                                    {YEARS.map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.role === 'teacher' && (
                            <div className="form-group">
                                <label>Years You Teach (Select Multiple)</label>
                                <div className="year-selector">
                                    {YEARS.map((year) => (
                                        <label key={year} className="year-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={formData.teachingYears.includes(year)}
                                                onChange={() => handleTeachingYearToggle(year)}
                                            />
                                            <span className="checkbox-custom"></span>
                                            <span className="year-label">{year}</span>
                                        </label>
                                    ))}
                                </div>
                                {formData.teachingYears.length === 0 && (
                                    <small className="error-text">Please select at least one year</small>
                                )}
                            </div>
                        )}

                        <button type="submit" className="auth-button">
                            Create Account
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account? <Link to={loginLink}>Login here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
