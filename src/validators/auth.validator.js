const Joi = require('joi');

const password = Joi.string()
  .min(8)
  .max(72) // bcrypt only uses the first 72 bytes
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'number')
  .messages({
    'string.pattern.name': 'password must contain at least one letter and one number',
  });

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: password.required(),
    phone: Joi.string().trim().pattern(/^[0-9+\-\s()]{7,20}$/).messages({ 'string.pattern.base': 'phone is invalid' }),
  }),
};

const login = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().required(),
  }),
};

module.exports = { register, login, password };
