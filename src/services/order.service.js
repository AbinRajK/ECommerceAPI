const Order = require('../models/Order');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { roundMoney } = require('../utils/helpers');
const { getPagination, buildMeta } = require('../utils/pagination');
const { ORDER_STATUS, ORDER_TRANSITIONS, PRODUCT_STATUS, ROLES } = require('../config/constants');

const assertTransition = (from, to) => {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    const allowed = ORDER_TRANSITIONS[from].join(', ') || 'none (terminal state)';
    throw ApiError.conflict(`Cannot change order status from ${from} to ${to}. Allowed: ${allowed}`);
  }
};

const restoreStock = (items, session) =>
  Product.bulkWrite(
    items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { stock: i.quantity } } } })),
    { session: session || undefined }
  );

/**
 * Creates an order for the authenticated customer.
 *
 * Stock safety: every decrement is ONE atomic conditional update
 *   findOneAndUpdate({ _id, status: 'active', stock: { $gte: qty } }, { $inc: { stock: -qty } })
 * so two concurrent orders can never oversell. With a replica set the whole thing runs in a
 * transaction (all-or-nothing). On a standalone server we compensate by restoring stock on failure.
 * Unit prices come from the document returned by that same atomic update, never from the client.
 */
const create = async (userId, { items, shippingAddress }) => {
  // Merge duplicate product lines, e.g. [{p1,1},{p1,2}] => {p1: 3}
  const requested = new Map();
  for (const { productId, quantity } of items) {
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }

  return runInTransaction(async (session) => {
    const reserved = [];
    try {
      const lines = [];

      for (const [productId, quantity] of requested) {
        const product = await Product.findOneAndUpdate(
          { _id: productId, status: PRODUCT_STATUS.ACTIVE, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { returnDocument: 'after', session: session || undefined }
        );

        if (!product) {
          // Work out *why* it failed to return a helpful error.
          const existing = await Product.findById(productId).session(session || null);
          if (!existing || existing.status !== PRODUCT_STATUS.ACTIVE) {
            throw ApiError.badRequest(`Product ${productId} is not available`);
          }
          throw ApiError.conflict(`Insufficient stock for "${existing.name}". Available: ${existing.stock}, requested: ${quantity}`);
        }

        reserved.push({ product: product._id, quantity });
        lines.push({
          product: product._id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.effectivePrice,
          quantity,
          subtotal: roundMoney(product.effectivePrice * quantity),
        });
      }

      const totalAmount = roundMoney(lines.reduce((sum, l) => sum + l.subtotal, 0));
      const [order] = await Order.create(
        [{
          user: userId,
          items: lines,
          totalAmount,
          shippingAddress,
          statusHistory: [{ status: ORDER_STATUS.PENDING, changedBy: userId }],
        }],
        { session: session || undefined }
      );
      return order;
    } catch (err) {
      if (!session && reserved.length) await restoreStock(reserved); // compensate (no transaction)
      throw err;
    }
  });
};

const list = async (query, user) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  // Customers are always scoped to their own orders; the `user` filter is admin-only.
  if (user.role === ROLES.CUSTOMER) filter.user = user._id;
  else if (query.user) filter.user = query.user;

  const pageInfo = getPagination(query);
  const finder = Order.find(filter).sort({ createdAt: -1 }).skip(pageInfo.skip).limit(pageInfo.limit);
  if (user.role === ROLES.ADMIN) finder.populate('user', 'name email');

  const [data, total] = await Promise.all([finder, Order.countDocuments(filter)]);
  return { data, pagination: buildMeta(pageInfo, total) };
};

const getById = async (id, user) => {
  const filter = { _id: id };
  if (user.role === ROLES.CUSTOMER) filter.user = user._id;
  // 404 (not 403) for other people's orders so order ids can't be probed.
  const order = await Order.findOne(filter).populate('user', 'name email');
  if (!order) throw ApiError.notFound('Order not found');
  return order;
};

const updateStatus = async (id, newStatus, actor) =>
  runInTransaction(async (session) => {
    const s = session || undefined;
    const order = await Order.findById(id).session(session || null);
    if (!order) throw ApiError.notFound('Order not found');
    assertTransition(order.status, newStatus);

    // Compare-and-set on the current status so concurrent updates can't both succeed
    // (this is also what prevents restoring stock twice on a double-cancel).
    const updated = await Order.findOneAndUpdate(
      { _id: id, status: order.status },
      { $set: { status: newStatus }, $push: { statusHistory: { status: newStatus, changedBy: actor._id, changedAt: new Date() } } },
      { returnDocument: 'after', session: s }
    );
    if (!updated) throw ApiError.conflict('Order was modified by another request, please retry');

    if (newStatus === ORDER_STATUS.CANCELLED) await restoreStock(order.items, session);
    return updated;
  });

/** Customers may cancel their own order only while it is still Pending. */
const cancelOwn = async (id, user) => {
  const order = await Order.findOne({ _id: id, user: user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== ORDER_STATUS.PENDING) {
    throw ApiError.conflict('Only pending orders can be cancelled. Please contact support');
  }
  return updateStatus(id, ORDER_STATUS.CANCELLED, user);
};

module.exports = { create, list, getById, updateStatus, cancelOwn };
