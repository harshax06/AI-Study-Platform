const dns = require('dns');
const http = require('http');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = require('./config');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const scoreRoutes = require('./routes/scores');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const { initScheduler, forceCloseMeeting } = require('./services/scheduler');
const { withRequestAudit, logError } = require('./services/auditLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
        credentials: true
    }
});

app.set('io', io);

app.use(withRequestAudit);
app.use(helmet());
app.use(cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false
}));

app.get('/', (req, res) => {
    res.json({
        message: 'AI Study Platform API is running',
        env: config.nodeEnv
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mongoState: mongoose.connection.readyState
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

const roomUsers = new Map();

const getRoomParticipants = (roomId) => {
    const roomMap = roomUsers.get(roomId) || new Map();
    return Array.from(roomMap.values());
};

io.on('connection', (socket) => {
    const handshakeUserId = socket.handshake?.query?.userId;
    if (handshakeUserId) {
        socket.join(handshakeUserId.toString());
        socket.data.userId = handshakeUserId.toString();
    }

    socket.on('join-room', ({ roomId, userId, name, role, taskId }) => {
        if (!roomId || !userId) {
            return;
        }

        socket.join(roomId);
        socket.join(userId.toString());

        socket.data.roomId = roomId;
        socket.data.userId = userId.toString();
        socket.data.taskId = taskId || null;

        if (!roomUsers.has(roomId)) {
            roomUsers.set(roomId, new Map());
        }

        roomUsers.get(roomId).set(socket.id, {
            userId: userId.toString(),
            name: name || 'User',
            role: role || 'student'
        });

        socket.to(roomId).emit('user-connected', { userId: userId.toString() });
        io.to(roomId).emit('participant-list', getRoomParticipants(roomId));
    });

    socket.on('offer', ({ roomId, offer, userId }) => {
        if (!roomId || !offer || !userId) {
            return;
        }
        io.to(userId.toString()).emit('offer', {
            offer,
            userId: socket.data.userId || null
        });
    });

    socket.on('answer', ({ roomId, answer, userId }) => {
        if (!roomId || !answer || !userId) {
            return;
        }
        io.to(userId.toString()).emit('answer', {
            answer,
            userId: socket.data.userId || null
        });
    });

    socket.on('ice-candidate', ({ roomId, candidate, userId }) => {
        if (!roomId || !candidate || !userId) {
            return;
        }
        io.to(userId.toString()).emit('ice-candidate', {
            candidate,
            userId: socket.data.userId || null
        });
    });

    socket.on('end-meeting', async ({ taskId, roomId }) => {
        if (!taskId || !roomId) {
            return;
        }

        try {
            await forceCloseMeeting(taskId);
            io.to(roomId).emit('meeting-ended-by-host', { taskId });
        } catch (error) {
            logError('meeting.end.failed', {
                taskId,
                roomId,
                reason: error.message
            });
        }
    });

    socket.on('disconnect', () => {
        const { roomId, userId } = socket.data || {};
        if (!roomId || !roomUsers.has(roomId)) {
            return;
        }

        const participants = roomUsers.get(roomId);
        participants.delete(socket.id);

        if (participants.size === 0) {
            roomUsers.delete(roomId);
        } else {
            io.to(roomId).emit('participant-list', getRoomParticipants(roomId));
        }

        if (userId) {
            socket.to(roomId).emit('user-disconnected', userId);
        }
    });
});

const connectDB = async () => {
    const preferredUris = [
        config.mongoUri,
        config.mongoDirectUri,
        config.mongoFallbackUri
    ].filter(Boolean);

    let lastError = null;

    for (const uri of preferredUris) {
        try {
            await mongoose.connect(uri, {
                dbName: config.mongoDbName,
                serverSelectionTimeoutMS: 7000,
                socketTimeoutMS: 45000
            });
            return { connected: true, uri };
        } catch (error) {
            lastError = error;
            logError('db.connect.failed', { uri, reason: error.message });
        }
    }

    return { connected: false, error: lastError };
};

const start = async () => {
    const db = await connectDB();
    if (db.connected) {
        console.log(`MongoDB connected (${mongoose.connection.name})`);
    } else {
        console.error('MongoDB unavailable. API will start, but DB operations will fail until connection succeeds.');
    }

    if (config.schedulerEnabled) {
        initScheduler(io);
    }

    server.listen(config.port, () => {
        console.log(`Server running on http://localhost:${config.port}`);
    });
};

app.use(notFoundHandler);
app.use(errorHandler);

start().catch((error) => {
    logError('server.startup.failed', { reason: error.message, stack: error.stack });
    process.exit(1);
});
