const userService = require('../services/user.service');

const getProfile = async (req, res) => res.json({ success: true, data: req.user });

const updateProfile = async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json({ success: true, message: 'Profile updated', data: user });
};

const changePassword = async (req, res) => {
  const token = await userService.changePassword(req.user.id, req.body);
  res.json({ success: true, message: 'Password changed', data: { token } });
};

const list = async (req, res) => {
  const { data, pagination } = await userService.list(req.query);
  res.json({ success: true, data, pagination });
};

const getById = async (req, res) => {
  res.json({ success: true, data: await userService.getById(req.params.id) });
};

const setStatus = async (req, res) => {
  const user = await userService.setActive(req.params.id, req.body.isActive, req.user);
  res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
};

module.exports = { getProfile, updateProfile, changePassword, list, getById, setStatus };
