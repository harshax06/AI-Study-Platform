const normalizeOriginList = (value) => {
    if (!value) {
        return ['*'];
    }

    return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const resolveMongoUri = () => {
    return process.env.MONGODB_URI
        || process.env.MONGO_URI
        || process.env.DATABASE_URL
        || 'mongodb://localhost:27017/ai-study';
};

const resolveMongoDbName = (mongoUri) => {
    if (process.env.MONGODB_DB) {
        return process.env.MONGODB_DB;
    }

    try {
        const parsed = new URL(mongoUri);
        const path = (parsed.pathname || '/').replace(/^\//, '');
        return path || 'ai-study';
    } catch (error) {
        return 'ai-study';
    }
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const mongoUri = resolveMongoUri();
const mongoDbName = resolveMongoDbName(mongoUri);

const config = {
    nodeEnv,
    isProduction,
    port: Number(process.env.PORT || 5000),
    mongoUri,
    mongoDirectUri: process.env.MONGODB_DIRECT_URI || '',
    mongoFallbackUri: process.env.MONGODB_FALLBACK_URI || 'mongodb://127.0.0.1:27017/ai-study',
    mongoDbName,
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    corsOrigins: normalizeOriginList(process.env.CORS_ORIGIN),
    schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false'
};

if (isProduction) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET must be set in production');
    }
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI && !process.env.DATABASE_URL) {
        throw new Error('One of MONGODB_URI, MONGO_URI, or DATABASE_URL must be set in production');
    }
}

module.exports = config;
