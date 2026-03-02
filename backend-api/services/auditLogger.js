const crypto = require('crypto');

const redact = (data = {}) => {
    const clone = { ...data };

    if (clone.password) clone.password = '[REDACTED]';
    if (clone.token) clone.token = '[REDACTED]';
    if (clone.authorization) clone.authorization = '[REDACTED]';

    return clone;
};

const emitLog = (level, event, payload = {}) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        event,
        ...redact(payload)
    };

    if (level === 'error') {
        console.error(JSON.stringify(entry));
        return;
    }

    console.log(JSON.stringify(entry));
};

const createCorrelationId = () => crypto.randomUUID();

const withRequestAudit = (req, res, next) => {
    const correlationId = req.header('x-correlation-id') || createCorrelationId();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    const start = Date.now();

    res.on('finish', () => {
        emitLog('info', 'http.request.completed', {
            correlationId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            userId: req.userId || null,
            ip: req.ip
        });
    });

    next();
};

const logAudit = (event, payload = {}) => emitLog('info', event, payload);
const logSecurity = (event, payload = {}) => emitLog('warn', event, payload);
const logError = (event, payload = {}) => emitLog('error', event, payload);

module.exports = {
    withRequestAudit,
    logAudit,
    logSecurity,
    logError
};
