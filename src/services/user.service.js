const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');
const { escapeRegex } = require('../utils/helpers');
const { getPagination, buildMeta } = require('../utils/pagination');

const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);
  user.set(data);
  await user.save();
  return user;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  user.password = newPassword;
  await user.save();
  return signToken(user); // old tokens are invalidated via passwordChangedAt
};

const list = async (query) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const pageInfo = getPagination(query);
  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pageInfo.skip).limit(pageInfo.limit),
    User.countDocuments(filter),
  ]);
  return { data, pagination: buildMeta(pageInfo, total) };
};

const getById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const setActive = async (id, isActive, actor) => {
  if (actor.id === id && !isActive) throw ApiError.badRequest('You cannot deactivate your own account');
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

module.exports = { updateProfile, changePassword, list, getById, setActive };
