const Joi = require('joi');
const { objectId, idParam, pagination } = require('./common');
const { ORDER_STATUS } = require('../config/constants');

const shippingAddress = Joi.object({
  fullName: Joi.string().trim().max(100).required(),
  phone: Joi.string().trim().pattern(/^[0-9+\-\s()]{7,20}$/).required(),
  line1: Joi.string().trim().max(200).required(),
  line2: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().max(100).required(),
  state: Joi.string().trim().max(100).required(),
  postalCode: Joi.string().trim().max(20).required(),
  country: Joi.string().trim().max(100).required(),
}).required();

// Only ids and quantities come from the client; prices/totals are always computed server-side.
const create = {
  body: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          productId: objectId.required(),
          quantity: Joi.number().integer().min(1).max(1000).required(),
        })
      )
      .min(1)
      .max(50)
      .required(),
    shippingAddress,
  }),
};

const list = {
  query: Joi.object({
    ...pagination,
    status: Joi.string().valid(...Object.values(ORDER_STATUS)),
    user: objectId, // honoured for admins only
  }),
};

const updateStatus = {
  params: idParam,
  body: Joi.object({ status: Joi.string().valid(...Object.values(ORDER_STATUS)).required() }),
};

module.exports = { create, list, updateStatus, byId: { params: idParam } };
