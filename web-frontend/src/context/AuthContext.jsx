import { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext();

const normalizeUser = (rawUser) => {
    if (!rawUser) {
        return null;
    }

    return {
        ...rawUser,
        id: rawUser.id || rawUser._id,
        _id: rawUser._id || rawUser.id
    };
};

export const AuthProvider = ({ children }) => {
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);

    const setUser = (nextUser) => {
        const normalized = normalizeUser(nextUser);
        setUserState(normalized);

        if (normalized) {
            localStorage.setItem('user', JSON.stringify(normalized));
        } else {
            localStorage.removeItem('user');
        }
    };

    const refreshUser = async () => {
        const res = await authAPI.getMe();
        setUser(res.data.user);
        return normalizeUser(res.data.user);
    };

    useEffect(() => {
        const initializeAuth = async () => {
            const token = localStorage.getItem('token');
            const cachedUser = localStorage.getItem('user');

            if (!token) {
                setLoading(false);
                return;
            }

            if (cachedUser) {
                try {
                    setUserState(normalizeUser(JSON.parse(cachedUser)));
                } catch (error) {
                    localStorage.removeItem('user');
                }
            }

            try {
                await refreshUser();
            } catch (error) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUserState(null);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUserState(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, setUser, refreshUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
