const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { escapeRegex } = require('../utils/helpers');
const { getPagination, buildMeta } = require('../utils/pagination');

/** Pure function: flat category list -> nested tree. O(n), any depth, no recursion. */
const buildTree = (categories) => {
  const nodes = new Map(categories.map((c) => [String(c._id), { ...c, children: [] }]));
  const roots = [];

  for (const node of nodes.values()) {
    const parent = node.parent ? nodes.get(String(node.parent)) : null;
    // Orphans (parent missing/inactive) are skipped rather than promoted to root.
    if (parent) parent.children.push(node);
    else if (!node.parent) roots.push(node);
  }
  return roots;
};

const getParentOrThrow = async (parentId, session) => {
  const parent = await Category.findById(parentId).session(session);
  if (!parent) throw ApiError.notFound('Parent category not found');
  return parent;
};

const create = async ({ name, description, parent, isActive }) => {
  let ancestors = [];
  if (parent) {
    const parentDoc = await getParentOrThrow(parent);
    ancestors = [...parentDoc.ancestors, parentDoc._id];
  }
  return Category.create({ name, description, isActive, parent: parent || null, ancestors });
};

/** Rewrites `ancestors` of every descendant after a subtree has been moved. */
const rebaseDescendants = async (category, newAncestors, session) => {
  const oldDepth = category.ancestors.length;
  const descendants = await Category.find({ ancestors: category._id }).select('ancestors').session(session);
  if (!descendants.length) return;

  await Category.bulkWrite(
    descendants.map((d) => ({
      updateOne: {
        filter: { _id: d._id },
        // Keep the part of the path below the moved category, replace everything above it.
        update: { $set: { ancestors: [...newAncestors, ...d.ancestors.slice(oldDepth)] } },
      },
    })),
    { session }
  );
};

const update = async (id, data) =>
  runInTransaction(async (session) => {
    const category = await Category.findById(id).session(session);
    if (!category) throw ApiError.notFound('Category not found');

    if (data.parent !== undefined) {
      const newParentId = data.parent ? String(data.parent) : null;
      const currentParentId = category.parent ? String(category.parent) : null;

      if (newParentId !== currentParentId) {
        let newAncestors = [];
        if (newParentId) {
          if (newParentId === String(category._id)) {
            throw ApiError.badRequest('A category cannot be its own parent');
          }
          const newParent = await getParentOrThrow(newParentId, session);
          // If the target parent has this category in its path, it is one of our descendants.
          if (newParent.ancestors.some((a) => a.equals(category._id))) {
            throw ApiError.badRequest('Invalid parent: it is a descendant of this category (circular relationship)');
          }
          newAncestors = [...newParent.ancestors, newParent._id];
        }

        await rebaseDescendants(category, newAncestors, session);
        category.parent = newParentId;
        category.ancestors = newAncestors;
      }
    }

    for (const field of ['name', 'description', 'isActive']) {
      if (data[field] !== undefined) category[field] = data[field];
    }
    await category.save({ session });
    return category;
  });

const remove = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');

  if (await Category.exists({ parent: id })) {
    throw ApiError.conflict('Category has sub-categories. Move or delete them first');
  }
  if (await Product.exists({ category: id })) {
    throw ApiError.conflict('Category has products. Move or delete them first');
  }
  await category.deleteOne();
};

const list = async (query) => {
  const filter = {};
  if (query.parent === 'null') filter.parent = null;
  else if (query.parent) filter.parent = query.parent;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

  const pageInfo = getPagination(query);
  const [data, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip(pageInfo.skip).limit(pageInfo.limit),
    Category.countDocuments(filter),
  ]);
  return { data, pagination: buildMeta(pageInfo, total) };
};

const getById = async (id) => {
  const category = await Category.findById(id).populate('ancestors', 'name slug');
  if (!category) throw ApiError.notFound('Category not found');
  const children = await Category.find({ parent: id }).sort({ name: 1 });
  return { ...category.toJSON(), children };
};

const getTree = async ({ onlyActive = true } = {}) => {
  const filter = onlyActive ? { isActive: true } : {};
  const categories = await Category.find(filter).sort({ name: 1 }).select('-ancestors -__v').lean();
  return buildTree(categories);
};

/** The category itself + every descendant id, at any depth, in one indexed query. */
const getSubtreeIds = async (id) => {
  const exists = await Category.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Category not found');
  const descendantIds = await Category.find({ ancestors: id }).distinct('_id');
  return [exists._id, ...descendantIds];
};

module.exports = { buildTree, create, update, remove, list, getById, getTree, getSubtreeIds };
