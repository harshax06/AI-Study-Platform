import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import './Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const nextParam = new URLSearchParams(location.search).get('next');
    const safeNextPath =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
    const registerLink = safeNextPath ? `/register?next=${encodeURIComponent(safeNextPath)}` : '/register';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await authAPI.login({ email, password });
            const { user, token } = res.data;

            login(user, token);
            navigate(safeNextPath || (user.role === 'teacher' ? '/teacher' : '/student'));
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
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
                        <div className="auth-logo">SP</div>
                        <h1>AI Study Platform</h1>
                        <p>Welcome back. Sign in to continue.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>Don't have an account? <Link to={registerLink}>Register</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
