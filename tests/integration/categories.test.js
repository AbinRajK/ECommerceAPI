const {
  startTestEnv, stopTestEnv, api, auth, createAdmin, createCategoryTree,
} = require('../helpers');

let adminToken;
let ids;

beforeAll(async () => {
  await startTestEnv();
  adminToken = await createAdmin();
  ids = await createCategoryTree(adminToken);
});
afterAll(stopTestEnv);

describe('Categories', () => {
  it('builds an unlimited-depth category tree and prevents cycles', async () => {
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
});
