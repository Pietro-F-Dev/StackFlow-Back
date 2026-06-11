import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { Product } from '../src/models/Product';
import { env } from '../src/config/env';

const PRODUCTS = [
  { name: 'Camiseta Básica', sku: 'CAM-001', category: 'Vestuário', costPrice: 2500, salePrice: 5990, quantity: 50, minStock: 10 },
  { name: 'Calça Jeans', sku: 'CAL-001', category: 'Vestuário', costPrice: 6000, salePrice: 12990, quantity: 30, minStock: 5 },
  { name: 'Tênis Casual', sku: 'TEN-001', category: 'Calçados', costPrice: 8000, salePrice: 18990, quantity: 20, minStock: 5 },
  { name: 'Mochila Executiva', sku: 'BOL-001', category: 'Acessórios', costPrice: 4500, salePrice: 9990, quantity: 15, minStock: 3 },
  { name: 'Boné Aba Reta', sku: 'BON-001', category: 'Acessórios', costPrice: 1500, salePrice: 3990, quantity: 8, minStock: 10 },
];

async function seed() {
  if (env.isProd) {
    throw new Error('Refusing to seed in NODE_ENV=production (would wipe users and products with demo credentials)');
  }
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Product.deleteMany({});

  const passwordHash = await bcrypt.hash('admin123', 10);
  await User.create({ name: 'Admin', email: 'admin@stockflow.com', passwordHash, role: 'admin' });
  console.log('Admin created — email: admin@stockflow.com  password: admin123');

  const sellerHash = await bcrypt.hash('seller123', 10);
  await User.create({ name: 'Vendedor Demo', email: 'seller@stockflow.com', passwordHash: sellerHash, role: 'seller' });
  console.log('Seller created — email: seller@stockflow.com  password: seller123');

  await Product.insertMany(PRODUCTS);
  console.log(`${PRODUCTS.length} products created`);

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
