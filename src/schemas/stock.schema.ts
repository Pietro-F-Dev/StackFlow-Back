import { z } from 'zod';

export const createMovementSchema = z.object({
  productId: z.string().length(24, 'Invalid product ID'),
  type: z.enum(['in', 'out', 'adjustment']),
  qty: z.number().int().refine((v) => v !== 0, 'qty must be non-zero'),
  reason: z.string().max(500).optional(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
