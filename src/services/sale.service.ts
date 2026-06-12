import type { ClientSession } from 'mongoose';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import type { ISaleItem } from '../models/Sale';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../middlewares/errorHandler';
import { ROLES, type Role } from '../constants/roles';
import { parsePagination, buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import { parseDateRange } from '../utils/dateRange';
import { withTransaction } from '../utils/withTransaction';
import type { CreateSaleInput, CancelSaleInput } from '../schemas/sale.schema';
import { Types } from 'mongoose';

interface SaleTotals {
  grossTotal: number;
  netTotal: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalPaid: number;
}

function buildSaleItems(input: CreateSaleInput, products: Map<string, { _id: unknown; name: string; salePrice: number; costPrice: number; quantity: number }>): ISaleItem[] {
  return input.items.map((item) => {
    const product = products.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} missing — should have been caught earlier`);
    return {
      productId: product._id,
      name: product.name,
      qty: item.qty,
      unitPrice: product.salePrice,
      unitCost: product.costPrice,
    } as ISaleItem;
  });
}

function computeSaleTotals(items: ISaleItem[], input: CreateSaleInput): SaleTotals {
  const grossTotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const profitBeforeDiscount = items.reduce((sum, i) => sum + i.qty * (i.unitPrice - i.unitCost), 0);

  const discountCents = Math.min(input.discountCents ?? 0, grossTotal);
  const taxCents = input.taxCents ?? 0;
  const shippingCents = input.shippingCents ?? 0;
  const totalPaid = Math.max(0, grossTotal - discountCents + taxCents + shippingCents);
  const netTotal = profitBeforeDiscount - discountCents;

  return { grossTotal, netTotal, discountCents, taxCents, shippingCents, totalPaid };
}

async function validateAndLoadProducts(input: CreateSaleInput) {
  const productIds = input.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, active: true });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError(422, 'PRODUCT_NOT_FOUND', `Product ${item.productId} not found or inactive`);
    }
    if (product.quantity < item.qty) {
      throw new AppError(422, 'INSUFFICIENT_STOCK', `Insufficient stock for product "${product.name}"`, {
        productId: item.productId,
        available: product.quantity,
      });
    }
  }
  return productMap;
}

async function decrementStockAndLogMovement(
  item: ISaleItem,
  saleId: unknown,
  userId: string,
  saleDate: Date,
  session: ClientSession,
) {
  const updated = await Product.findOneAndUpdate(
    { _id: item.productId, quantity: { $gte: item.qty } },
    { $inc: { quantity: -item.qty } },
    { session },
  );
  if (!updated) {
    throw new AppError(422, 'INSUFFICIENT_STOCK', `Stock changed during transaction for product "${item.name}"`);
  }
  await StockMovement.create(
    [{
      productId: item.productId,
      type: 'sale',
      qty: -item.qty,
      refSaleId: saleId,
      userId,
      date: saleDate,
    }],
    { session },
  );
}

export async function createSale(userId: string, input: CreateSaleInput) {
  const productMap = await validateAndLoadProducts(input);
  const items = buildSaleItems(input, productMap);
  const totals = computeSaleTotals(items, input);
  const notes = input.notes?.trim() || undefined;
  const date = new Date();

  return withTransaction(async (session) => {
    const [sale] = await Sale.create(
      [{ date, items, ...totals, notes, userId }],
      { session },
    );
    for (const item of items) {
      await decrementStockAndLogMovement(item, sale._id, userId, date, session);
    }
    return sale;
  });
}

interface ListSalesOptions {
  query: { from?: string; to?: string; page?: unknown; limit?: unknown };
  userId: string;
  role: Role;
}

interface CancelSaleOptions {
  saleId: string;
  userId: string;
  role: Role;
  input: CancelSaleInput;
}

export async function cancelSale({ saleId, userId, role, input }: CancelSaleOptions) {
  if (!Types.ObjectId.isValid(saleId)) {
    throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  }
  const sale = await Sale.findById(saleId);
  if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  if (role !== ROLES.ADMIN && sale.userId.toString() !== userId) {
    throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  }
  if (sale.cancelledAt) {
    throw new AppError(409, 'ALREADY_CANCELLED', 'Sale already cancelled');
  }

  return withTransaction(async (session) => {
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: item.qty } },
        { session },
      );
      await StockMovement.create(
        [{
          productId: item.productId,
          type: 'return',
          qty: item.qty,
          reason: input.reason,
          refSaleId: sale._id,
          userId,
          date: new Date(),
        }],
        { session },
      );
    }
    sale.cancelledAt = new Date();
    sale.cancelledBy = new Types.ObjectId(userId);
    sale.cancellationReason = input.reason;
    await sale.save({ session });
    return sale;
  });
}

export async function listSales({ query, userId, role }: ListSalesOptions): Promise<PaginatedResult<unknown>> {
  const pagination = parsePagination(query);

  const filter: Record<string, unknown> = {};
  if (role !== ROLES.ADMIN) filter.userId = userId;

  const dateRange = parseDateRange(query.from, query.to);
  if (dateRange) filter.date = dateRange;

  const [data, total] = await Promise.all([
    Sale.find(filter).sort({ date: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Sale.countDocuments(filter),
  ]);

  return buildPaginatedResult(data, total, pagination);
}
