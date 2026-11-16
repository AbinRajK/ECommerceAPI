const authService = require('../services/auth.service');

const register = async (req, res) => {
  const { user, token } = await authService.register(req.body);
  res.status(201).json({ success: true, message: 'Registration successful', data: { user, token } });
};

const login = async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ success: true, message: 'Login successful', data: { user, token } });
};

module.exports = { register, login };
