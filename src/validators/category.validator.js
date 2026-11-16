const Joi = require('joi');
const { objectId, idParam, pagination } = require('./common');

const create = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().max(1000).allow(''),
    parent: objectId.allow(null),
    isActive: Joi.boolean(),
  }),
};

const update = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    description: Joi.string().trim().max(1000).allow(''),
    parent: objectId.allow(null), // null => move to root
    isActive: Joi.boolean(),
  }).min(1),
};

const list = {
  query: Joi.object({
    ...pagination,
    search: Joi.string().trim().max(100),
    parent: Joi.alternatives().try(objectId, Joi.string().valid('null')), // "null" => root categories
    isActive: Joi.boolean(),
  }),
};

module.exports = { create, update, list, byId: { params: idParam } };
