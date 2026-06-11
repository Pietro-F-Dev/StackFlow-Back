import request from 'supertest';
import app from '../src/app';
import { setupTestDB, teardownTestDB, clearDB } from './dbSetup';
import { createTestUser, createTestProduct, generateToken } from './helpers';

beforeAll(setupTestDB);
afterAll(teardownTestDB);
beforeEach(clearDB);

describe('POST /api/products', () => {
  it('admin creates a valid product (201)', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shirt', sku: 'SHT-001', category: 'Clothing', costPrice: 1000, salePrice: 2500, quantity: 20, minStock: 5 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Shirt', sku: 'SHT-001', active: true });
  });

  it('returns 409 on duplicate SKU', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');
    await createTestProduct({ sku: 'DUP-001' });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Other', sku: 'DUP-001', category: 'Cat', costPrice: 100, salePrice: 200, quantity: 5, minStock: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SKU_CONFLICT');
  });

  it('seller cannot create products (403)', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shirt', sku: 'SHT-002', category: 'Clothing', costPrice: 1000, salePrice: 2000, quantity: 10, minStock: 0 });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/products', () => {
  it('returns paginated list', async () => {
    const user = await createTestUser('seller');
    const token = generateToken(user._id.toString(), 'seller');

    await Promise.all([
      createTestProduct({ sku: 'P-001' }),
      createTestProduct({ sku: 'P-002' }),
      createTestProduct({ sku: 'P-003' }),
    ]);

    const res = await request(app)
      .get('/api/products?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });

  it('filters by category', async () => {
    const user = await createTestUser('seller');
    const token = generateToken(user._id.toString(), 'seller');
    await createTestProduct({ sku: 'CAT-A1', category: 'Shoes' });
    await createTestProduct({ sku: 'CAT-B1', category: 'Bags' });

    const res = await request(app)
      .get('/api/products?category=Shoes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('Shoes');
  });
});

describe('DELETE /api/products/:id (soft delete)', () => {
  it('admin soft-deletes a product (204)', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');
    const product = await createTestProduct({ sku: 'DEL-001' });

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const { Product } = await import('../src/models/Product');
    const updated = await Product.findById(product._id);
    expect(updated?.active).toBe(false);
  });
});

describe('GET /api/products/low-stock', () => {
  it('returns products at or below minStock', async () => {
    const user = await createTestUser('seller');
    const token = generateToken(user._id.toString(), 'seller');
    await createTestProduct({ sku: 'LOW-001', quantity: 3, minStock: 5 });
    await createTestProduct({ sku: 'OK-001', quantity: 10, minStock: 5 });

    const res = await request(app)
      .get('/api/products/low-stock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sku).toBe('LOW-001');
  });
});
