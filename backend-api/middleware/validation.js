const { body, param, validationResult } = require('express-validator');
const { CANONICAL_YEARS, isValidYear } = require('../utils/years');

const BTECH_YEARS = CANONICAL_YEARS;

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
        console.warn(JSON.stringify({
            ts: new Date().toISOString(),
            level: 'warn',
            event: 'validation.failed',
            correlationId: req.correlationId || null,
            method: req.method,
            path: req.originalUrl,
            details
        }));
        return res.status(400).json({
            error: details[0]?.message || 'Validation failed',
            validationError: 'Validation failed',
            details
        });
    }

    return next();
};

const validateRegister = [
    body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 chars'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 chars'),
    body('role').isIn(['student', 'teacher']).withMessage('Role must be student or teacher'),
    body('studentYear')
        .optional({ values: 'falsy' })
        .custom((value) => isValidYear(value))
        .withMessage('Invalid studentYear'),
    body('teachingYears').custom((value, { req }) => {
        if (req.body.role !== 'teacher') {
            return true;
        }
        return Array.isArray(value) && value.length > 0;
    }).withMessage('teachingYears must be a non-empty array'),
    body('teachingYears.*').custom((value, { req }) => {
        if (req.body.role !== 'teacher') {
            return true;
        }
        return isValidYear(value);
    }).withMessage('Invalid teaching year'),
    validateRequest
];

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
    validateRequest
];

const validateProfileUpdate = [
    body('name').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 chars'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
        .optional({ values: 'falsy' })
        .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 chars'),
    body('studentYear').optional().custom((value) => isValidYear(value)).withMessage('Invalid studentYear'),
    body('teachingYears').optional().isArray().withMessage('teachingYears must be an array'),
    body('teachingYears.*').optional().custom((value) => isValidYear(value)).withMessage('Invalid teaching year'),
    validateRequest
];

const validateTaskCreate = [
    body('title').trim().isLength({ min: 3, max: 180 }).withMessage('Title must be 3-180 chars'),
    body('agenda').trim().isLength({ min: 3, max: 2000 }).withMessage('Agenda must be 3-2000 chars'),
    body('type').optional().isIn(['class', 'assignment']).withMessage('Invalid task type'),
    body('targetYear').custom((value) => isValidYear(value)).withMessage('Invalid target year'),
    body('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be 15-480 minutes'),
    body('startTime').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid startTime'),
    body('endTime').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid endTime'),
    validateRequest
];

const validateTaskSchedule = [
    param('id').isMongoId().withMessage('Invalid task id'),
    body('startTime').isISO8601().withMessage('Valid startTime is required'),
    body('endTime').isISO8601().withMessage('Valid endTime is required'),
    validateRequest
];

const validateTaskIdParam = [
    param('id').isMongoId().withMessage('Invalid task id'),
    validateRequest
];

const validateQuizGeneration = [
    param('taskId').isMongoId().withMessage('Invalid task id'),
    validateRequest
];

const validateQuizSubmit = [
    param('taskId').isMongoId().withMessage('Invalid task id'),
    body('answers').isArray({ min: 1 }).withMessage('answers must be a non-empty array'),
    body('answers.*').isInt({ min: 0, max: 3 }).withMessage('Each answer must be 0-3'),
    validateRequest
];

module.exports = {
    BTECH_YEARS,
    validateRequest,
    validateRegister,
    validateLogin,
    validateProfileUpdate,
    validateTaskCreate,
    validateTaskSchedule,
    validateTaskIdParam,
    validateQuizGeneration,
    validateQuizSubmit
};
