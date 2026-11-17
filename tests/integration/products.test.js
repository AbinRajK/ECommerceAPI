const {
  startTestEnv, stopTestEnv, api, createAdmin, createCategoryTree, createProduct,
} = require('../helpers');

let adminToken;
let ids;

beforeAll(async () => {
  await startTestEnv();
  adminToken = await createAdmin();
  ids = await createCategoryTree(adminToken);

  const p1 = await createProduct(adminToken, 'SAM-1', 500, ids.samsung);
  expect(p1.status).toBe(201);
  await createProduct(adminToken, 'LAP-1', 1000, ids.computers, { salePrice: 800 });
  await createProduct(adminToken, 'HIDDEN-1', 100, ids.samsung, { status: 'inactive' });
});
afterAll(stopTestEnv);

describe('Products', () => {
  it('rejects a duplicate SKU and a sale price above the price', async () => {
    expect((await createProduct(adminToken, 'SAM-1', 1, ids.samsung)).status).toBe(409);
    expect((await createProduct(adminToken, 'BAD-1', 100, ids.samsung, { salePrice: 200 })).status).toBe(400);
  });

  it('filters by parent category incl. sub-categories, excluding inactive', async () => {
    const parent = await api().get(`/api/v1/products?category=${ids.electronics}`);
    expect(parent.body.pagination.total).toBe(2);
  });

  it('filters on the sale price and sorts', async () => {
    const priced = await api().get('/api/v1/products?minPrice=600&sort=price_desc');
    expect(priced.body.data.map((p) => p.sku)).toEqual(['LAP-1']); // sale price (800), not list price
  });

  it('searches and paginates', async () => {
    const searched = await api().get('/api/v1/products?search=sam&limit=1&page=1');
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.pagination.limit).toBe(1);
  });
});
