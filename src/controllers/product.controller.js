const productService = require('../services/product.service');

const list = async (req, res) => {
  const { data, pagination } = await productService.list(req.query, { publicOnly: true });
  res.json({ success: true, data, pagination });
};

const getById = async (req, res) => {
  res.json({ success: true, data: await productService.getById(req.params.id) });
};

const adminList = async (req, res) => {
  const { data, pagination } = await productService.list(req.query, { publicOnly: false });
  res.json({ success: true, data, pagination });
};

const adminGetById = async (req, res) => {
  res.json({ success: true, data: await productService.getById(req.params.id, { publicOnly: false }) });
};

const create = async (req, res) => {
  res.status(201).json({ success: true, message: 'Product created', data: await productService.create(req.body) });
};

const update = async (req, res) => {
  res.json({ success: true, message: 'Product updated', data: await productService.update(req.params.id, req.body) });
};

const remove = async (req, res) => {
  await productService.remove(req.params.id);
  res.status(204).send();
};

module.exports = { list, getById, adminList, adminGetById, create, update, remove };
