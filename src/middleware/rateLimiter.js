const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const build = (limit) =>
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    message: { success: false, message: 'Too many requests, please try again later' },
  });

module.exports = {
  apiLimiter: build(env.rateLimit.max),
  authLimiter: build(env.rateLimit.authMax),
};
