const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this unique value already exists';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired authentication token';
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'Database is unavailable. Check MySQL on port 3306.';
  }

  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    statusCode = 503;
    message = 'Database authentication failed. Check DB_USER and DB_PASSWORD.';
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File exceeds the 5 MB upload limit';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field. Use field name "file".';
  }

  if (statusCode >= 500) {
    process.stderr.write(`[error] ${err.stack || err.message}\n`);
  }

  const payload = {
    error: message
  };

  if (err.details) {
    payload.details = err.details;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
