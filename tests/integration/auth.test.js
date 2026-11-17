const {
  startTestEnv, stopTestEnv, api, login, registerCustomer, createAdminUser,
} = require('../helpers');

beforeAll(startTestEnv);
afterAll(stopTestEnv);

describe('Auth', () => {
  it('registers a customer and logs in; seeded admin can log in', async () => {
    const reg = await api().post('/api/v1/auth/register').send({ name: 'Jane', email: 'jane@test.com', password: 'Passw0rd1' });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.password).toBeUndefined();
    expect(reg.body.data.user.role).toBe('customer');

    await createAdminUser({ email: 'admin@test.com', password: 'Admin@1234' });
    const adminLogin = await login('admin@test.com', 'Admin@1234');
    expect(adminLogin.status).toBe(200);

    const customerLogin = await login('jane@test.com', 'Passw0rd1');
    expect(customerLogin.status).toBe(200);

    const bad = await login('jane@test.com', 'wrong');
    expect(bad.status).toBe(401);
  });

  it('rejects duplicate email and ignores role in registration payload', async () => {
    await registerCustomer({ name: 'Dup', email: 'dup@test.com' });
    const dup = await api().post('/api/v1/auth/register').send({ name: 'X', email: 'dup@test.com', password: 'Passw0rd1' });
    expect(dup.status).toBe(409);

    const sneaky = await api().post('/api/v1/auth/register').send({ name: 'Sneaky', email: 's@test.com', password: 'Passw0rd1', role: 'admin' });
    expect(sneaky.body.data.user.role).toBe('customer');
  });
});
