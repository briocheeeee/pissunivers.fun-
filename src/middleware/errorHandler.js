import logger from '../core/logger.js';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const isServerError = status >= 500;

  if (isServerError) {
    logger.error(`SERVER_ERROR [${req.method} ${req.path}]: ${err.message}`, {
      stack: err.stack,
      ip: req.ip?.ipString || 'unknown',
      userId: req.user?.id || null,
    });
  }

  const responseBody = {
    errors: [isServerError ? 'Internal server error' : err.message],
  };

  if (err.code) {
    responseBody.code = err.code;
  }

  res.status(status).json(responseBody);
}
