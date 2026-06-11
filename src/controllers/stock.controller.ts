import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import type { MovementType } from '../models/StockMovement';
import { asScalarString } from '../middlewares/sanitizeQuery';
import { getAuthUser } from '../utils/authUser';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';
import { parseDateRange } from '../utils/dateRange';

const VALID_MOVEMENT_TYPES: readonly MovementType[] = ['in', 'out', 'sale', 'adjustment'];

const isValidMovementType = (value: string): value is MovementType =>
  (VALID_MOVEMENT_TYPES as readonly string[]).includes(value);

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const { productId, type, qty, reason } = req.body;
  const { id: userId } = getAuthUser(req);

  const product = await Product.findOne({ _id: productId, active: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found or inactive');

  if (product.quantity + qty < 0) {
    throw new AppError(422, 'NEGATIVE_STOCK', 'Adjustment would result in negative stock', {
      current: product.quantity,
      requested: qty,
    });
  }

  const condition: Record<string, unknown> = { _id: productId, active: true };
  if (qty < 0) condition.quantity = { $gte: -qty };

  const updated = await Product.findOneAndUpdate(condition, { $inc: { quantity: qty } }, { new: true });
  if (!updated) {
    throw new AppError(422, 'NEGATIVE_STOCK', 'Stock changed concurrently, please retry');
  }

  const movement = await StockMovement.create({ productId, type, qty, reason, userId });
  res.status(201).json(movement);
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);
  const filter: Record<string, unknown> = {};

  const productId = asScalarString(req.query.productId);
  if (productId) {
    if (!isValidObjectId(productId)) throw new AppError(400, 'INVALID_ID', 'Invalid productId');
    filter.productId = productId;
  }

  const type = asScalarString(req.query.type);
  if (type) {
    if (!isValidMovementType(type)) throw new AppError(400, 'INVALID_TYPE', 'Invalid movement type');
    filter.type = type;
  }

  const dateRange = parseDateRange(asScalarString(req.query.from), asScalarString(req.query.to));
  if (dateRange) filter.date = dateRange;

  const [data, total] = await Promise.all([
    StockMovement.find(filter).sort({ date: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.json(buildPaginatedResult(data, total, pagination));
});
