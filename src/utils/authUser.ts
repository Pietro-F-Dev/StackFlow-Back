import type { Request } from 'express';
import { AppError } from '../middlewares/errorHandler';
import type { Role } from '../constants/roles';

export interface AuthUser {
  id: string;
  role: Role;
}

/**
 * Returns the authenticated user. Throws if the route was reached without the
 * authenticate middleware — protects against accidentally exposing a route.
 */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user;
}
