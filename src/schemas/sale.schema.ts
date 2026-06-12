import { z } from 'zod';

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().length(24, 'Invalid product ID'),
        qty: z.number().int().min(1),
      }),
    )
    .min(1, 'Sale must have at least one item'),
  discountCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().optional(),
  shippingCents: z.number().int().optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelSaleSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
