const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;
let app;
let User;

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const address = {
  fullName: 'Jane Doe', phone: '9999999999', line1: '1 Main St',
  city: 'Kochi', state: 'Kerala', postalCode: '682001', country: 'India',
};

beforeAll(async () => {
  // Replica set => transactions are exercised, like in production/docker.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  app = require('../../src/app');
  User = require('../../src/models/User');
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('E-commerce API', () => {
  let adminToken;
  let customerToken;
  let customerId;
  const ids = {};

  it('registers a customer and logs in; seeded admin can log in', async () => {
    const reg = await api().post('/api/v1/auth/register').send({ name: 'Jane', email: 'jane@test.com', password: 'Passw0rd1' });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.password).toBeUndefined();
    expect(reg.body.data.user.role).toBe('customer');
    customerId = reg.body.data.user._id;

    await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Admin@1234', role: 'admin' });
    const login = await api().post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'Admin@1234' });
    expect(login.status).toBe(200);
    adminToken = login.body.data.token;

    const custLogin = await api().post('/api/v1/auth/login').send({ email: 'jane@test.com', password: 'Passw0rd1' });
    customerToken = custLogin.body.data.token;

    const bad = await api().post('/api/v1/auth/login').send({ email: 'jane@test.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('rejects duplicate email and ignores role in registration payload', async () => {
    const dup = await api().post('/api/v1/auth/register').send({ name: 'X', email: 'jane@test.com', password: 'Passw0rd1' });
    expect(dup.status).toBe(409);
    const sneaky = await api().post('/api/v1/auth/register').send({ name: 'Sneaky', email: 's@test.com', password: 'Passw0rd1', role: 'admin' });
    expect(sneaky.body.data.user.role).toBe('customer');
  });

  it('enforces role-based authorization', async () => {
    expect((await api().get('/api/v1/users')).status).toBe(401);
    expect((await api().get('/api/v1/users').set(auth(customerToken))).status).toBe(403);
    expect((await api().get('/api/v1/users').set(auth(adminToken))).status).toBe(200);
  });

  it('builds an unlimited-depth category tree and prevents cycles', async () => {
    const mk = async (name, parent) => {
      const res = await api().post('/api/v1/categories').set(auth(adminToken)).send({ name, parent });
      expect(res.status).toBe(201);
      return res.body.data._id;
    };
    ids.electronics = await mk('Electronics');
    ids.mobiles = await mk('Mobiles', ids.electronics);
    ids.android = await mk('Android Phones', ids.mobiles);
    ids.samsung = await mk('Samsung', ids.android);
    ids.computers = await mk('Computers', ids.electronics);

    const tree = await api().get('/api/v1/categories/tree');
    expect(tree.body.data[0].name).toBe('Electronics');
    expect(tree.body.data[0].children).toHaveLength(2);
    const mobiles = tree.body.data[0].children.find((c) => c.name === 'Mobiles');
    expect(mobiles.children[0].children[0].name).toBe('Samsung');

    // self parent, and moving a category under its own descendant
    const self = await api().patch(`/api/v1/categories/${ids.mobiles}`).set(auth(adminToken)).send({ parent: ids.mobiles });
    expect(self.status).toBe(400);
    const cycle = await api().patch(`/api/v1/categories/${ids.electronics}`).set(auth(adminToken)).send({ parent: ids.samsung });
    expect(cycle.status).toBe(400);

    // deleting a category with children is blocked
    const del = await api().delete(`/api/v1/categories/${ids.electronics}`).set(auth(adminToken));
    expect(del.status).toBe(409);
  });

  it('re-bases descendants when a subtree is moved', async () => {
    await api().patch(`/api/v1/categories/${ids.mobiles}`).set(auth(adminToken)).send({ parent: ids.computers });
    const samsung = await api().get(`/api/v1/categories/${ids.samsung}`).set(auth(adminToken));
    const path = samsung.body.data.ancestors.map((a) => a.name);
    expect(path).toEqual(['Electronics', 'Computers', 'Mobiles', 'Android Phones']);
    // move back
    await api().patch(`/api/v1/categories/${ids.mobiles}`).set(auth(adminToken)).send({ parent: ids.electronics });
  });

  it('manages products and filters by parent category incl. sub-categories', async () => {
    const mk = (sku, price, category, extra = {}) =>
      api().post('/api/v1/products').set(auth(adminToken)).send({ name: `Item ${sku}`, sku, price, stock: 10, category, ...extra });

    const p1 = await mk('SAM-1', 500, ids.samsung);
    expect(p1.status).toBe(201);
    ids.p1 = p1.body.data._id;
    ids.p2 = (await mk('LAP-1', 1000, ids.computers, { salePrice: 800 })).body.data._id;
    await mk('HIDDEN-1', 100, ids.samsung, { status: 'inactive' });

    expect((await mk('SAM-1', 1, ids.samsung)).status).toBe(409); // duplicate SKU
    expect((await mk('BAD-1', 100, ids.samsung, { salePrice: 200 })).status).toBe(400);

    const parent = await api().get(`/api/v1/products?category=${ids.electronics}`);
    expect(parent.body.pagination.total).toBe(2); // sub-categories included, inactive excluded

    const priced = await api().get('/api/v1/products?minPrice=600&sort=price_desc');
    expect(priced.body.data.map((p) => p.sku)).toEqual(['LAP-1']); // filtered on the sale price (800)

    const searched = await api().get('/api/v1/products?search=sam&limit=1&page=1');
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.pagination.limit).toBe(1);
  });

  it('places an order: server-side pricing, stock reduced, validation of stock', async () => {
    const order = await api().post('/api/v1/orders').set(auth(customerToken)).send({
      items: [{ productId: ids.p2, quantity: 2 }, { productId: ids.p1, quantity: 1 }],
      shippingAddress: address,
      totalAmount: 1, // must be ignored
    });
    expect(order.status).toBe(201);
    expect(order.body.data.totalAmount).toBe(2 * 800 + 500);
    ids.order = order.body.data._id;

    const product = await api().get(`/api/v1/products/${ids.p2}`);
    expect(product.body.data.stock).toBe(8);

    const tooMany = await api().post('/api/v1/orders').set(auth(customerToken)).send({
      items: [{ productId: ids.p1, quantity: 50 }], shippingAddress: address,
    });
    expect(tooMany.status).toBe(409);
    expect((await api().get(`/api/v1/products/${ids.p1}`)).body.data.stock).toBe(9); // unchanged

    // all-or-nothing: second line fails => first line's stock is rolled back
    await api().post('/api/v1/orders').set(auth(customerToken)).send({
      items: [{ productId: ids.p1, quantity: 1 }, { productId: ids.p2, quantity: 999 }], shippingAddress: address,
    });
    expect((await api().get(`/api/v1/products/${ids.p1}`)).body.data.stock).toBe(9);
  });

  it('does not oversell under concurrent orders', async () => {
    const created = await api().post('/api/v1/products').set(auth(adminToken))
      .send({ name: 'Last one', sku: 'LAST-1', price: 10, stock: 3, category: ids.computers });
    const pid = created.body.data._id;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        api().post('/api/v1/orders').set(auth(customerToken)).send({ items: [{ productId: pid, quantity: 1 }], shippingAddress: address })
      )
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect((await api().get(`/api/v1/products/${pid}`)).body.data.stock).toBe(0);
  });

  it('scopes order visibility and lets admin manage status; cancel restores stock', async () => {
    const other = await api().post('/api/v1/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'Passw0rd1' });
    const bobToken = other.body.data.token;

    expect((await api().get(`/api/v1/orders/${ids.order}`).set(auth(bobToken))).status).toBe(404);
    const mine = await api().get('/api/v1/orders').set(auth(bobToken));
    expect(mine.body.data).toHaveLength(0);
    expect((await api().get(`/api/v1/orders/${ids.order}`).set(auth(customerToken))).status).toBe(200);

    const all = await api().get('/api/v1/orders').set(auth(adminToken));
    expect(all.body.pagination.total).toBeGreaterThan(0);

    // customers cannot change status; invalid transitions are rejected
    expect((await api().patch(`/api/v1/orders/${ids.order}/status`).set(auth(customerToken)).send({ status: 'Confirmed' })).status).toBe(403);
    expect((await api().patch(`/api/v1/orders/${ids.order}/status`).set(auth(adminToken)).send({ status: 'Delivered' })).status).toBe(409);
    expect((await api().patch(`/api/v1/orders/${ids.order}/status`).set(auth(adminToken)).send({ status: 'Confirmed' })).status).toBe(200);

    const cancel = await api().patch(`/api/v1/orders/${ids.order}/status`).set(auth(adminToken)).send({ status: 'Cancelled' });
    expect(cancel.status).toBe(200);
    expect((await api().get(`/api/v1/products/${ids.p2}`)).body.data.stock).toBe(10);
    // double-cancel must not restore stock twice
    expect((await api().patch(`/api/v1/orders/${ids.order}/status`).set(auth(adminToken)).send({ status: 'Cancelled' })).status).toBe(409);
  });

  it('lets admin deactivate a user, who is then locked out', async () => {
    const res = await api().patch(`/api/v1/users/${customerId}/status`).set(auth(adminToken)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await api().get('/api/v1/users/me').set(auth(customerToken))).status).toBe(403);
    expect((await api().post('/api/v1/auth/login').send({ email: 'jane@test.com', password: 'Passw0rd1' })).status).toBe(403);
  });
});
