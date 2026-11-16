const ApiError = require('../utils/ApiError');

/**
 * validate({ body, query, params }) with Joi schemas.
 * Unknown keys are stripped (prevents mass-assignment, e.g. "role" on profile update).
 */
const validate = (schemas) => (req, res, next) => {
  const errors = [];

  for (const location of ['params', 'query', 'body']) {
    const schema = schemas[location];
    if (!schema) continue;

    const { value, error } = schema.validate(req[location] || {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      errors.push(
        ...error.details.map((d) => ({
          location,
          field: d.path.join('.'),
          message: d.message.replace(/"/g, ''),
        }))
      );
    } else if (location === 'query') {
      // Express 5 exposes req.query as a getter, so redefine it with the validated value.
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    } else {
      req[location] = value;
    }
  }

  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  return next();
};

module.exports = validate;
