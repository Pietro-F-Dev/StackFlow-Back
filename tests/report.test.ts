import request from 'supertest';
import app from '../src/app';
import { setupTestDB, teardownTestDB, clearDB } from './dbSetup';
import { createTestUser, generateToken } from './helpers';
import { Sale } from '../src/models/Sale';
import mongoose from 'mongoose';

beforeAll(setupTestDB);
afterAll(teardownTestDB);
beforeEach(clearDB);

// Known data mass:
//   Sale A (day 5): 2× product P1 (unitPrice=3000, unitCost=1000) → gross=6000, net=4000
//   Sale B (day 5): 1× product P2 (unitPrice=5000, unitCost=2000) → gross=5000, net=3000
//   Sale C (day 20): 3× product P1 (unitPrice=3000, unitCost=1000) → gross=9000, net=6000
//   Total gross = 20000 | Total net = 13000 | salesCount = 3 | itemsSold = 6

async function seedKnownData(userId: string) {
  const p1Id = new mongoose.Types.ObjectId();
  const p2Id = new mongoose.Types.ObjectId();

  await Sale.insertMany([
    {
      date: new Date('2026-01-05T10:00:00Z'),
      userId,
      items: [{ productId: p1Id, name: 'P1', qty: 2, unitPrice: 3000, unitCost: 1000 }],
      grossTotal: 6000,
      netTotal: 4000,
    },
    {
      date: new Date('2026-01-05T15:00:00Z'),
      userId,
      items: [{ productId: p2Id, name: 'P2', qty: 1, unitPrice: 5000, unitCost: 2000 }],
      grossTotal: 5000,
      netTotal: 3000,
    },
    {
      date: new Date('2026-01-20T09:00:00Z'),
      userId,
      items: [{ productId: p1Id, name: 'P1', qty: 3, unitPrice: 3000, unitCost: 1000 }],
      grossTotal: 9000,
      netTotal: 6000,
    },
  ]);

  return { p1Id, p2Id };
}

describe('GET /api/reports/monthly', () => {
  it('returns correct gross and net revenue for known data', async () => {
    const user = await createTestUser('admin');
    const token = generateToken(user._id.toString(), 'admin');
    await seedKnownData(user._id.toString());

    const res = await request(app)
      .get('/api/reports/monthly?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.grossRevenue).toBe(20000);
    expect(res.body.netRevenue).toBe(13000);
    expect(res.body.salesCount).toBe(3);
    expect(res.body.itemsSold).toBe(6);
  });

  it('returns zeros for a month with no sales', async () => {
    const user = await createTestUser('seller');
    const token = generateToken(user._id.toString(), 'seller');

    const res = await request(app)
      .get('/api/reports/monthly?year=2026&month=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.grossRevenue).toBe(0);
    expect(res.body.netRevenue).toBe(0);
    expect(res.body.salesCount).toBe(0);
    expect(res.body.itemsSold).toBe(0);
    expect(res.body.topProducts).toHaveLength(0);
    expect(res.body.dailySeries).toHaveLength(31); // March has 31 days
    expect(res.body.dailySeries.every((d: { grossRevenue: number }) => d.grossRevenue === 0)).toBe(true);
  });

  it('returns correct topProducts sorted by grossRevenue desc', async () => {
    const user = await createTestUser('admin');
    const token = generateToken(user._id.toString(), 'admin');
    await seedKnownData(user._id.toString());

    const res = await request(app)
      .get('/api/reports/monthly?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // P1: 5 units × 3000 = 15000 gross; P2: 1 unit × 5000 = 5000 gross
    expect(res.body.topProducts[0].name).toBe('P1');
    expect(res.body.topProducts[0].qtySold).toBe(5);
    expect(res.body.topProducts[0].grossRevenue).toBe(15000);
    expect(res.body.topProducts[1].name).toBe('P2');
    expect(res.body.topProducts[1].grossRevenue).toBe(5000);
  });

  it('returns dailySeries with correct values on active days', async () => {
    const user = await createTestUser('admin');
    const token = generateToken(user._id.toString(), 'admin');
    await seedKnownData(user._id.toString());

    const res = await request(app)
      .get('/api/reports/monthly?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dailySeries).toHaveLength(31);

    const day5 = res.body.dailySeries.find((d: { day: number }) => d.day === 5);
    expect(day5.grossRevenue).toBe(11000); // 6000 + 5000
    expect(day5.netRevenue).toBe(7000);    // 4000 + 3000

    const day20 = res.body.dailySeries.find((d: { day: number }) => d.day === 20);
    expect(day20.grossRevenue).toBe(9000);
    expect(day20.netRevenue).toBe(6000);

    const day1 = res.body.dailySeries.find((d: { day: number }) => d.day === 1);
    expect(day1.grossRevenue).toBe(0);
  });

  it('returns 400 for missing year/month params', async () => {
    const user = await createTestUser('seller');
    const token = generateToken(user._id.toString(), 'seller');

    const res = await request(app)
      .get('/api/reports/monthly?year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/reports/monthly?year=2026&month=1');
    expect(res.status).toBe(401);
  });
});
