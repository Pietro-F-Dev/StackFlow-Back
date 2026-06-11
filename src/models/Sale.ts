import { Schema, model, Document, Types } from 'mongoose';

export interface ISaleItem {
  productId: Types.ObjectId;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
}

export interface ISale extends Document {
  _id: Types.ObjectId;
  date: Date;
  items: ISaleItem[];
  grossTotal: number;
  netTotal: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalPaid: number;
  notes?: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const saleSchema = new Schema<ISale>(
  {
    date: { type: Date, default: Date.now },
    items: { type: [saleItemSchema], required: true, validate: [(v: ISaleItem[]) => v.length >= 1, 'Sale must have at least one item'] },
    grossTotal: { type: Number, required: true, min: 0 },
    netTotal: { type: Number, required: true },
    discountCents: { type: Number, default: 0, min: 0 },
    taxCents: { type: Number, default: 0, min: 0 },
    shippingCents: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 500 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

saleSchema.index({ date: -1 });
saleSchema.index({ userId: 1, date: -1 });

export const Sale = model<ISale>('Sale', saleSchema);
