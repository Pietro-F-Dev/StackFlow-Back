import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AppError } from '../middlewares/errorHandler';
import { Product } from '../models/Product';
import { asScalarString } from '../middlewares/sanitizeQuery';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);
  const active = req.query.active !== 'false';

  const category = asScalarString(req.query.category);
  const search = asScalarString(req.query.search);

  const filter: Record<string, unknown> = { active };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const [data, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Product.countDocuments(filter),
  ]);

  res.json(buildPaginatedResult(data, total, pagination));
});

export const getLowStock = asyncHandler(async (_req: Request, res: Response) => {
  const data = await Product.find({ active: true, $expr: { $lte: ['$quantity', '$minStock'] } }).lean();
  res.json({ data });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Product.findOne({ sku: req.body.sku });
  if (existing) throw new AppError(409, 'SKU_CONFLICT', 'A product with this SKU already exists');
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.sku) {
    const conflict = await Product.findOne({ sku: req.body.sku, _id: { $ne: req.params.id } });
    if (conflict) throw new AppError(409, 'SKU_CONFLICT', 'A product with this SKU already exists');
  }
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  res.status(204).send();
});
