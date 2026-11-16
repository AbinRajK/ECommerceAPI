const orderService = require('../services/order.service');

const create = async (req, res) => {
  const order = await orderService.create(req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Order placed', data: order });
};

const list = async (req, res) => {
  const { data, pagination } = await orderService.list(req.query, req.user);
  res.json({ success: true, data, pagination });
};

const getById = async (req, res) => {
  res.json({ success: true, data: await orderService.getById(req.params.id, req.user) });
};

const updateStatus = async (req, res) => {
  const order = await orderService.updateStatus(req.params.id, req.body.status, req.user);
  res.json({ success: true, message: 'Order status updated', data: order });
};

const cancel = async (req, res) => {
  const order = await orderService.cancelOwn(req.params.id, req.user);
  res.json({ success: true, message: 'Order cancelled', data: order });
};

module.exports = { create, list, getById, updateStatus, cancel };
