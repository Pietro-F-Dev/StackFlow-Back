import request from 'supertest';
import app from '../src/app';
import { setupTestDB, teardownTestDB, clearDB } from './dbSetup';
import { createTestUser, createTestProduct, generateToken } from './helpers';
import { Product } from '../src/models/Product';
import { StockMovement } from '../src/models/StockMovement';
import { Sale } from '../src/models/Sale';

beforeAll(setupTestDB);
afterAll(teardownTestDB);
beforeEach(clearDB);

describe('POST /api/sales — happy path', () => {
  it('creates sale, decrements stock and creates stock movements', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'SALE-001', quantity: 10, costPrice: 1000, salePrice: 2500 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), qty: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.grossTotal).toBe(3 * 2500);
    expect(res.body.netTotal).toBe(3 * (2500 - 1000));
    expect(res.body.items[0]).toMatchObject({ name: product.name, qty: 3, unitPrice: 2500, unitCost: 1000 });

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct!.quantity).toBe(7);

    const movements = await StockMovement.find({ refSaleId: res.body._id });
    expect(movements).toHaveLength(1);
    expect(movements[0].qty).toBe(-3);
    expect(movements[0].type).toBe('sale');
  });
});

describe('POST /api/sales — insufficient stock', () => {
  it('returns 422 and writes nothing to the database', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'INSUF-001', quantity: 2 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), qty: 5 }] });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INSUFFICIENT_STOCK');

    const unchanged = await Product.findById(product._id);
    expect(unchanged!.quantity).toBe(2);

    const sales = await Sale.find({});
    expect(sales).toHaveLength(0);

    const movements = await StockMovement.find({});
    expect(movements).toHaveLength(0);
  });
});

describe('POST /api/sales — extras (discount/tax/shipping/notes)', () => {
  it('persists discount/tax/shipping/notes and computes totalPaid', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'EXTRA-001', quantity: 10, costPrice: 1000, salePrice: 2500 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product._id.toString(), qty: 2 }],
        discountCents: 500,
        taxCents: 200,
        shippingCents: 1500,
        notes: 'Entrega expressa',
      });

    expect(res.status).toBe(201);
    expect(res.body.grossTotal).toBe(5000);
    expect(res.body.discountCents).toBe(500);
    expect(res.body.taxCents).toBe(200);
    expect(res.body.shippingCents).toBe(1500);
    expect(res.body.notes).toBe('Entrega expressa');
    expect(res.body.totalPaid).toBe(5000 - 500 + 200 + 1500);
    expect(res.body.netTotal).toBe(2 * (2500 - 1000) - 500);
  });

  it('defaults extras to 0 when omitted', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'EXTRA-002', quantity: 5, costPrice: 1000, salePrice: 2000 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), qty: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.discountCents).toBe(0);
    expect(res.body.taxCents).toBe(0);
    expect(res.body.shippingCents).toBe(0);
    expect(res.body.totalPaid).toBe(2000);
    expect(res.body.notes).toBeUndefined();
  });

  it('clamps discount at grossTotal (no negative totalPaid)', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'EXTRA-003', quantity: 5, costPrice: 1000, salePrice: 2000 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product._id.toString(), qty: 1 }],
        discountCents: 999999,
      });

    expect(res.status).toBe(201);
    expect(res.body.discountCents).toBe(2000);
    expect(res.body.totalPaid).toBe(0);
  });
});

describe('POST /api/sales — snapshot integrity', () => {
  it('preserves sale snapshot after product price change', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'SNAP-001', costPrice: 1000, salePrice: 2000 });

    const saleRes = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), qty: 1 }] });

    expect(saleRes.status).toBe(201);

    await Product.findByIdAndUpdate(product._id, { salePrice: 9999, costPrice: 8888 });

    const sale = await Sale.findById(saleRes.body._id);
    expect(sale!.items[0].unitPrice).toBe(2000);
    expect(sale!.items[0].unitCost).toBe(1000);
  });
});

describe('POST /api/stock/movements', () => {
  it('admin creates manual stock movement and updates product quantity', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');
    const product = await createTestProduct({ sku: 'MOV-001', quantity: 5 });

    const res = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), type: 'in', qty: 20, reason: 'Restock' });

    expect(res.status).toBe(201);

    const updated = await Product.findById(product._id);
    expect(updated!.quantity).toBe(25);
  });

  it('returns 422 when adjustment would leave negative stock', async () => {
    const admin = await createTestUser('admin');
    const token = generateToken(admin._id.toString(), 'admin');
    const product = await createTestProduct({ sku: 'NEG-001', quantity: 3 });

    const res = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), type: 'out', qty: -10 });

    expect(res.status).toBe(422);

    const unchanged = await Product.findById(product._id);
    expect(unchanged!.quantity).toBe(3);
  });

  it('seller cannot create manual movements (403)', async () => {
    const seller = await createTestUser('seller');
    const token = generateToken(seller._id.toString(), 'seller');
    const product = await createTestProduct({ sku: 'SELL-MOV-001' });

    const res = await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), type: 'in', qty: 10 });

    expect(res.status).toBe(403);
  });
});
