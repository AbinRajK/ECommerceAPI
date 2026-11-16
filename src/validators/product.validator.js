const Joi = require('joi');
const { objectId, idParam, pagination } = require('./common');
const { PRODUCT_STATUS } = require('../config/constants');

const SORT_OPTIONS = ['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc'];

const base = {
  name: Joi.string().trim().min(2).max(200),
  sku: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,50}$/).messages({
    'string.pattern.base': 'sku may contain letters, numbers, "-" and "_" (3-50 chars)',
  }),
  description: Joi.string().trim().max(5000).allow(''),
  price: Joi.number().min(0).precision(2),
  salePrice: Joi.number().min(0).precision(2).allow(null),
  stock: Joi.number().integer().min(0),
  category: objectId,
  status: Joi.string().valid(...Object.values(PRODUCT_STATUS)),
};

const create = {
  body: Joi.object({
    ...base,
    name: base.name.required(),
    sku: base.sku.required(),
    price: base.price.required(),
    stock: base.stock.required(),
    category: base.category.required(),
  }).custom((value, helpers) =>
    value.salePrice != null && value.salePrice > value.price
      ? helpers.message('salePrice cannot be greater than price')
      : value
  ),
};

const update = {
  params: idParam,
  body: Joi.object(base).min(1),
};

const listQuery = {
  ...pagination,
  search: Joi.string().trim().max(100),
  category: objectId,
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  sort: Joi.string().valid(...SORT_OPTIONS).default('newest'),
};

const customerList = {
  query: Joi.object(listQuery).custom((v, h) =>
    v.minPrice != null && v.maxPrice != null && v.minPrice > v.maxPrice
      ? h.message('minPrice cannot be greater than maxPrice')
      : v
  ),
};

const adminList = {
  query: Joi.object({ ...listQuery, status: base.status }).custom((v, h) =>
    v.minPrice != null && v.maxPrice != null && v.minPrice > v.maxPrice
      ? h.message('minPrice cannot be greater than maxPrice')
      : v
  ),
};

module.exports = { create, update, customerList, adminList, byId: { params: idParam } };
