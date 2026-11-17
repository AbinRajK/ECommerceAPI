const {
  startTestEnv, stopTestEnv, api, auth, login, registerCustomer, createAdmin,
} = require('../helpers');

let adminToken;
let customer;

beforeAll(async () => {
  await startTestEnv();
  adminToken = await createAdmin();
  customer = await registerCustomer();
});
afterAll(stopTestEnv);

describe('Users', () => {
  it('enforces role-based authorization', async () => {
    expect((await api().get('/api/v1/users')).status).toBe(401);
    expect((await api().get('/api/v1/users').set(auth(customer.token))).status).toBe(403);
    expect((await api().get('/api/v1/users').set(auth(adminToken))).status).toBe(200);
  });

  it('lets admin deactivate a user, who is then locked out', async () => {
    // Separate user so this test doesn't lock out the shared customer.
    const victim = await registerCustomer({ name: 'Victim', email: 'victim@test.com' });

    const res = await api().patch(`/api/v1/users/${victim.id}/status`).set(auth(adminToken)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await api().get('/api/v1/users/me').set(auth(victim.token))).status).toBe(403);
    expect((await login(victim.email, victim.password)).status).toBe(403);
  });
});
