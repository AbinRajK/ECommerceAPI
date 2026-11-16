const getPagination = ({ page = 1, limit = 10 }) => ({
  page,
  limit,
  skip: (page - 1) * limit,
});

const buildMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});

module.exports = { getPagination, buildMeta };
