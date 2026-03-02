import logger from '../utils/logger.js';

/**
 * Global Express error-handling middleware.
 * Must be registered LAST, after all routes.
 *
 * @param {Error & { status?: number, statusCode?: number }} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = status < 500 ? err.message : 'Internal server error.';

    logger.error(`${req.method} ${req.originalUrl} → ${status}: ${err.message}`);

    res.status(status).json({ error: message });
};

export default errorHandler;
