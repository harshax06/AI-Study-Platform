const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
};

const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    if (status >= 500) {
        console.error('[server-error]', {
            method: req.method,
            path: req.originalUrl,
            message,
            stack: err.stack
        });
    }

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {})
    });
};

module.exports = {
    notFoundHandler,
    errorHandler
};
