import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import type { Role } from '../constants/roles';

interface JwtPayload {
  id: string;
  role: Role;
}

const BEARER_PREFIX = 'Bearer ';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header'));
  }
  const token = header.slice(BEARER_PREFIX.length);
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
