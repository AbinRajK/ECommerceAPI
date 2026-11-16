const Joi = require('joi');

const objectId = Joi.string().hex().length(24).messages({
  'string.hex': '{{#label}} must be a valid id',
  'string.length': '{{#label}} must be a valid id',
});

const idParam = Joi.object({ id: objectId.required() });

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
};

module.exports = { objectId, idParam, pagination };
