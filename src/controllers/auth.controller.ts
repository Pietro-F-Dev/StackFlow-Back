import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { getAuthUser } from '../utils/authUser';
import * as authService from '../services/auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const auth = getAuthUser(req);
  const result = await authService.updateProfile(auth.id, req.body);
  res.json(result);
});
