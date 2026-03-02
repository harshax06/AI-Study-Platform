import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    useEffect(() => {
        if (!user) {
            setSocket(null);
            return;
        }

        const token = localStorage.getItem('token');

        const newSocket = io(API_URL, {
            query: { userId: user.id || user._id },
            auth: token ? { token } : undefined,
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        return () => {
            newSocket.disconnect();
            setSocket(null);
        };
    }, [user, API_URL]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
