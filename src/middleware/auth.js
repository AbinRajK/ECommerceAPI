const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

const authenticate = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  const payload = verifyToken(token); // JWT errors are mapped to 401 in the error handler
  const user = await User.findById(payload.sub);

  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');
  if (user.changedPasswordAfter(payload.iat)) {
    throw ApiError.unauthorized('Password was changed recently, please log in again');
  }

  req.user = user;
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw ApiError.forbidden();
  next();
};

module.exports = { authenticate, authorize };
