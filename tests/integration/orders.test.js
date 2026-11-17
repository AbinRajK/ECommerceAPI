const {
  startTestEnv, stopTestEnv, api, auth, registerCustomer, createAdmin,
  createCategoryTree, createProduct, stockOf, placeOrder, setOrderStatus,
} = require('../support');

let adminToken;
let customer;
let ids;

beforeAll(async () => {
  await startTestEnv();
  adminToken = await createAdmin();
  customer = await registerCustomer();
  const categories = await createCategoryTree(adminToken);

  ids = { ...categories };
  ids.p1 = (await createProduct(adminToken, 'SAM-1', 500, categories.samsung)).body.data._id;
  ids.p2 = (await createProduct(adminToken, 'LAP-1', 1000, categories.computers, { salePrice: 800 })).body.data._id;
});
afterAll(stopTestEnv);

describe('Placing orders', () => {
  it('prices server-side and reduces stock', async () => {
    const before = await stockOf(ids.p2);
    const order = await placeOrder(
      customer.token,
      [{ productId: ids.p2, quantity: 2 }, { productId: ids.p1, quantity: 1 }],
      { totalAmount: 1 }, // must be ignored
    );
    expect(order.status).toBe(201);
    expect(order.body.data.totalAmount).toBe(2 * 800 + 500);
    expect(await stockOf(ids.p2)).toBe(before - 2);
  });

  it('rejects an order larger than the stock and leaves stock unchanged', async () => {
    const before = await stockOf(ids.p1);
    const tooMany = await placeOrder(customer.token, [{ productId: ids.p1, quantity: 50 }]);
    expect(tooMany.status).toBe(409);
    expect(await stockOf(ids.p1)).toBe(before);
  });

  it('is all-or-nothing: a failing second line rolls back the first', async () => {
    const before = await stockOf(ids.p1);
    await placeOrder(customer.token, [{ productId: ids.p1, quantity: 1 }, { productId: ids.p2, quantity: 999 }]);
    expect(await stockOf(ids.p1)).toBe(before);
  });

  it('does not oversell under concurrent orders', async () => {
    const created = await createProduct(adminToken, 'LAST-1', 10, ids.computers, { stock: 3 });
    const pid = created.body.data._id;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => placeOrder(customer.token, [{ productId: pid, quantity: 1 }])),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(await stockOf(pid)).toBe(0);
  });
});

describe('Order lifecycle', () => {
  let orderId;
  let p2StockBeforeOrder;

  beforeAll(async () => {
    p2StockBeforeOrder = await stockOf(ids.p2);
    const order = await placeOrder(customer.token, [{ productId: ids.p2, quantity: 2 }, { productId: ids.p1, quantity: 1 }]);
    expect(order.status).toBe(201);
    orderId = order.body.data._id;
  });

  it('scopes order visibility to the owner; admin sees everything', async () => {
    const bob = await registerCustomer({ name: 'Bob', email: 'bob@test.com' });

    expect((await api().get(`/api/v1/orders/${orderId}`).set(auth(bob.token))).status).toBe(404);
    const mine = await api().get('/api/v1/orders').set(auth(bob.token));
    expect(mine.body.data).toHaveLength(0);
    expect((await api().get(`/api/v1/orders/${orderId}`).set(auth(customer.token))).status).toBe(200);

    const all = await api().get('/api/v1/orders').set(auth(adminToken));
    expect(all.body.pagination.total).toBeGreaterThan(0);
  });

  it('lets only admin change status; cancelling restores stock exactly once', async () => {
    // customers cannot change status; invalid transitions are rejected
    expect((await setOrderStatus(customer.token, orderId, 'Confirmed')).status).toBe(403);
    expect((await setOrderStatus(adminToken, orderId, 'Delivered')).status).toBe(409);
    expect((await setOrderStatus(adminToken, orderId, 'Confirmed')).status).toBe(200);

    expect((await setOrderStatus(adminToken, orderId, 'Cancelled')).status).toBe(200);
    expect(await stockOf(ids.p2)).toBe(p2StockBeforeOrder);
    // double-cancel must not restore stock twice
    expect((await setOrderStatus(adminToken, orderId, 'Cancelled')).status).toBe(409);
  });
});
