const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const categoryService = require('./category.service');
const { escapeRegex } = require('../utils/helpers');
const { getPagination, buildMeta } = require('../utils/pagination');
const { PRODUCT_STATUS } = require('../config/constants');

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { effectivePrice: 1 },
  price_desc: { effectivePrice: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
};

const buildFilter = async (query, { publicOnly }) => {
  const filter = {};

  if (publicOnly) filter.status = PRODUCT_STATUS.ACTIVE;
  else if (query.status) filter.status = query.status;

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { description: rx }];
  }

  // Parent category => include products of every sub-category (any depth).
  if (query.category) filter.category = { $in: await categoryService.getSubtreeIds(query.category) };

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.effectivePrice = {};
    if (query.minPrice !== undefined) filter.effectivePrice.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.effectivePrice.$lte = query.maxPrice;
  }
  return filter;
};

const list = async (query, { publicOnly = true } = {}) => {
  const filter = await buildFilter(query, { publicOnly });
  const pageInfo = getPagination(query);
  const sort = { ...SORTS[query.sort || 'newest'], _id: 1 }; // _id tie-breaker => stable pagination

  const [data, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(pageInfo.skip).limit(pageInfo.limit).populate('category', 'name slug'),
    Product.countDocuments(filter),
  ]);
  return { data, pagination: buildMeta(pageInfo, total) };
};

const getById = async (id, { publicOnly = true } = {}) => {
  const filter = { _id: id };
  if (publicOnly) filter.status = PRODUCT_STATUS.ACTIVE;
  const product = await Product.findOne(filter).populate('category', 'name slug');
  if (!product) throw ApiError.notFound('Product not found');
  return product;
};

const assertCategoryExists = async (categoryId) => {
  if (!(await Category.exists({ _id: categoryId }))) throw ApiError.badRequest('Category does not exist');
};

const create = async (data) => {
  await assertCategoryExists(data.category);
  return Product.create(data);
};

const update = async (id, data) => {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  if (data.category) await assertCategoryExists(data.category);

  // Load + save (instead of findOneAndUpdate) so model validators and the
  // effectivePrice hook run against the merged document.
  product.set(data);
  // Model validators only run on modified paths, so also catch "price lowered below existing salePrice".
  if (product.salePrice != null && product.salePrice > product.price) {
    throw ApiError.badRequest('salePrice cannot be greater than price');
  }
  await product.save();
  return product;
};

const remove = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw ApiError.notFound('Product not found');
};

module.exports = { list, getById, create, update, remove };
