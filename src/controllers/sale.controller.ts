import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';
import { Sale } from '../models/Sale';
import { ROLES } from '../constants/roles';
import { getAuthUser } from '../utils/authUser';
import * as saleService from '../services/sale.service';

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = getAuthUser(req);
  const sale = await saleService.createSale(userId, req.body);
  res.status(201).json(sale);
});

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId, role } = getAuthUser(req);
  const result = await saleService.listSales({
    query: req.query as { from?: string; to?: string; page?: unknown; limit?: unknown },
    userId,
    role,
  });
  res.json(result);
});

export const getSale = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId, role } = getAuthUser(req);
  const sale = await Sale.findById(req.params.id).lean();
  if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  if (role !== ROLES.ADMIN && sale.userId.toString() !== userId) {
    throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  }
  res.json(sale);
});
