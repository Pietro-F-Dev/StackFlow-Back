import request from 'supertest';
import app from '../src/app';
import { setupTestDB, teardownTestDB, clearDB } from './dbSetup';
import { createTestUser, generateToken } from './helpers';

beforeAll(setupTestDB);
afterAll(teardownTestDB);
beforeEach(clearDB);

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const { User } = await import('../src/models/User');
    const bcryptjs = await import('bcryptjs');
    const email = 'login-test@test.com';
    await User.create({
      name: 'Login Test',
      email,
      passwordHash: await bcryptjs.hash('password123', 10),
      role: 'seller',
    });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken.length).toBeGreaterThan(30);
    expect(res.body.user).toMatchObject({ email, role: 'seller' });
  });

  it('refresh rotates the refresh token and returns a new access token', async () => {
    const { User } = await import('../src/models/User');
    const bcryptjs = await import('bcryptjs');
    const email = 'rotate@test.com';
    await User.create({
      name: 'Rotate',
      email,
      passwordHash: await bcryptjs.hash('password123', 10),
      role: 'seller',
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    const oldRefresh: string = loginRes.body.refreshToken;

    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(oldRefresh);

    // Old refresh token must be invalidated after rotation.
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe('INVALID_REFRESH_TOKEN');
  });

  it('logout invalidates the refresh token', async () => {
    const { User } = await import('../src/models/User');
    const bcryptjs = await import('bcryptjs');
    const email = 'logout@test.com';
    await User.create({
      name: 'Logout',
      email,
      passwordHash: await bcryptjs.hash('password123', 10),
      role: 'seller',
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    const refreshToken: string = loginRes.body.refreshToken;

    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('returns 401 on wrong password', async () => {
    const { User } = await import('../src/models/User');
    const bcryptjs = await import('bcryptjs');
    const email = 'wrong-pw@test.com';
    await User.create({ name: 'Test', email, passwordHash: await bcryptjs.hash('correct', 10), role: 'seller' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'pass' });
    expect(res.status).toBe(401);
  });
});

describe('Protected route without token', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  it('admin can create a new user', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Seller', email: 'newseller@test.com', password: 'password123', role: 'seller' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'newseller@test.com', role: 'seller' });
  });

  it('seller cannot create users (403)', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another', email: 'another@test.com', password: 'password123' });

    expect(res.status).toBe(403);
  });
});
