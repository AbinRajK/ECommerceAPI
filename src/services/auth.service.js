const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

// Public registration always creates a customer; admins are created via `npm run seed:admin`.
const register = async ({ name, email, password, phone }) => {
  if (await User.exists({ email })) throw ApiError.conflict('Email is already registered');

  const user = await User.create({ name, email, password, phone });
  return { user, token: signToken(user) };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email / wrong password to avoid user enumeration.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  return { user, token: signToken(user) };
};

module.exports = { register, login };
