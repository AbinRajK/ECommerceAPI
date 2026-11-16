const Joi = require('joi');
const { idParam, pagination } = require('./common');
const { password } = require('./auth.validator');
const { ROLES } = require('../config/constants');

const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    phone: Joi.string().trim().pattern(/^[0-9+\-\s()]{7,20}$/).messages({ 'string.pattern.base': 'phone is invalid' }),
    address: Joi.object({
      line1: Joi.string().trim().max(200),
      line2: Joi.string().trim().max(200).allow(''),
      city: Joi.string().trim().max(100),
      state: Joi.string().trim().max(100),
      postalCode: Joi.string().trim().max(20),
      country: Joi.string().trim().max(100),
    }),
  }).min(1),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password.required(),
  }),
};

const listUsers = {
  query: Joi.object({
    ...pagination,
    search: Joi.string().trim().max(100),
    role: Joi.string().valid(...Object.values(ROLES)),
    isActive: Joi.boolean(),
  }),
};

const setStatus = {
  params: idParam,
  body: Joi.object({ isActive: Joi.boolean().required() }),
};

module.exports = { updateProfile, changePassword, listUsers, setStatus, getUser: { params: idParam } };
