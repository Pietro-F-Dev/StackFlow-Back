import { z } from 'zod';

const productBase = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50).trim().toUpperCase(),
  category: z.string().min(1).max(100),
  costPrice: z.number().int().min(0),
  salePrice: z.number().int().min(0),
  quantity: z.number().int().min(0),
  minStock: z.number().int().min(0).default(0),
});

export const createProductSchema = productBase;

export const updateProductSchema = productBase.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
