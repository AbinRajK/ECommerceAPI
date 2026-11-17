const { api, auth } = require('./testEnv');

const address = {
  fullName: 'Jane Doe', phone: '9999999999', line1: '1 Main St',
  city: 'Kochi', state: 'Kerala', postalCode: '682001', country: 'India',
};

const ADMIN = { email: 'admin@test.com', password: 'Admin@1234' };

// ---------- users ----------

const login = (email, password) => api().post('/api/v1/auth/login').send({ email, password });

/** Registers a customer through the API. Returns { id, token, email, password }. */
async function registerCustomer({ name = 'Jane', email = 'jane@test.com', password = 'Passw0rd1' } = {}) {
  const res = await api().post('/api/v1/auth/register').send({ name, email, password });
  expect(res.status).toBe(201);
  return { id: res.body.data.user._id, token: res.body.data.token, email, password };
}

/** Inserts an admin straight into the DB (there is no public way to create one). */
function createAdminUser({ email = ADMIN.email, password = ADMIN.password } = {}) {
  const User = require('../../src/models/User');
  return User.create({ name: 'Admin', email, password, role: 'admin' });
}

/** Creates the default admin and returns a login token. */
async function createAdmin() {
  await createAdminUser();
  const res = await login(ADMIN.email, ADMIN.password);
  expect(res.status).toBe(200);
  return res.body.data.token;
}

// ---------- categories ----------

/** Creates a category and returns its id. */
async function createCategory(token, name, parent) {
  const res = await api().post('/api/v1/categories').set(auth(token)).send({ name, parent });
  expect(res.status).toBe(201);
  return res.body.data._id;
}

/**
 * Electronics
 * ├── Mobiles
 * │   └── Android Phones
 * │       └── Samsung
 * └── Computers
 */
async function createCategoryTree(token) {
  const ids = {};
  ids.electronics = await createCategory(token, 'Electronics');
  ids.mobiles = await createCategory(token, 'Mobiles', ids.electronics);
  ids.android = await createCategory(token, 'Android Phones', ids.mobiles);
  ids.samsung = await createCategory(token, 'Samsung', ids.android);
  ids.computers = await createCategory(token, 'Computers', ids.electronics);
  return ids;
}

// ---------- products ----------

/** Returns the raw response so tests can assert on failures (409/400) too. */
const createProduct = (token, sku, price, category, extra = {}) =>
  api().post('/api/v1/products').set(auth(token))
    .send({ name: `Item ${sku}`, sku, price, stock: 10, category, ...extra });

const getProduct = (id) => api().get(`/api/v1/products/${id}`);
const stockOf = async (id) => (await getProduct(id)).body.data.stock;

// ---------- orders ----------

/** items: [{ productId, quantity }]. Returns the raw response. */
const placeOrder = (token, items, extra = {}) =>
  api().post('/api/v1/orders').set(auth(token)).send({ items, shippingAddress: address, ...extra });

const setOrderStatus = (token, orderId, status) =>
  api().patch(`/api/v1/orders/${orderId}/status`).set(auth(token)).send({ status });

module.exports = {
  address, login, registerCustomer, createAdminUser, createAdmin,
  createCategory, createCategoryTree,
  createProduct, getProduct, stockOf,
  placeOrder, setOrderStatus,
};
