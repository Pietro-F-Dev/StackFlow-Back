import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User';
import { Product } from '../src/models/Product';

const JWT_SECRET = process.env.JWT_SECRET!;

export function generateToken(id: string, role: 'admin' | 'seller'): string {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
}

export async function createTestUser(role: 'admin' | 'seller' = 'seller') {
  const passwordHash = await bcrypt.hash('password123', 10);
  return User.create({ name: 'Test User', email: `test-${Date.now()}@test.com`, passwordHash, role });
}

export async function createTestProduct(overrides: Partial<{
  name: string; sku: string; category: string;
  costPrice: number; salePrice: number; quantity: number; minStock: number;
}> = {}) {
  return Product.create({
    name: 'Test Product',
    sku: `SKU-${Date.now()}`,
    category: 'Test',
    costPrice: 1000,
    salePrice: 2000,
    quantity: 10,
    minStock: 2,
    ...overrides,
  });
}
