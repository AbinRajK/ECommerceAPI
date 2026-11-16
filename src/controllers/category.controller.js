const categoryService = require('../services/category.service');

const create = async (req, res) => {
  res.status(201).json({ success: true, message: 'Category created', data: await categoryService.create(req.body) });
};

const update = async (req, res) => {
  res.json({ success: true, message: 'Category updated', data: await categoryService.update(req.params.id, req.body) });
};

const remove = async (req, res) => {
  await categoryService.remove(req.params.id);
  res.status(204).send();
};

const list = async (req, res) => {
  const { data, pagination } = await categoryService.list(req.query);
  res.json({ success: true, data, pagination });
};

const getById = async (req, res) => {
  res.json({ success: true, data: await categoryService.getById(req.params.id) });
};

const tree = async (req, res) => {
  res.json({ success: true, data: await categoryService.getTree() });
};

module.exports = { create, update, remove, list, getById, tree };
