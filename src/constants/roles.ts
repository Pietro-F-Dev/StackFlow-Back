export const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
