import { z } from 'zod';
import { ROLES } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().email().max(254),
  // Cap length to prevent CPU-DoS via giant-string bcrypt compares.
  password: z.string().min(1).max(72),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters') // bcrypt truncates beyond 72 bytes
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one digit'),
  role: z.enum([ROLES.ADMIN, ROLES.SELLER]).default(ROLES.SELLER),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z
      .string()
      .max(250_000)
      .refine((v) => v === '' || DATA_URL_RE.test(v), 'Invalid image data URL')
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.avatarUrl !== undefined, {
    message: 'At least one field must be provided',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
