const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Normalises Mongoose / JWT / body-parser errors into ApiError instances.
const normalise = (err) => {
  if (err.isOperational) return err;

  switch (true) {
    case err.name === 'ValidationError' && !!err.errors:
      return ApiError.badRequest(
        'Validation failed',
        Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
      );
    case err.name === 'CastError':
      return ApiError.badRequest(`Invalid value for "${err.path}"`);
    case err.code === 11000:
      return ApiError.conflict(`Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`);
    case err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError':
      return ApiError.unauthorized('Invalid or expired token');
    case err.type === 'entity.parse.failed':
      return ApiError.badRequest('Malformed JSON body');
    case err.type === 'entity.too.large':
      return new ApiError(413, 'Request body too large');
    default:
      return null;
  }
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const known = normalise(err);
  if (!known && env.nodeEnv !== 'test') console.error(err);

  const error = known || new ApiError(500, 'Internal server error');
  const body = { success: false, message: error.message };
  if (error.errors) body.errors = error.errors;
  if (!known && env.nodeEnv === 'development') body.stack = err.stack;

  res.status(error.statusCode).json(body);
};

module.exports = { notFound, errorHandler };
