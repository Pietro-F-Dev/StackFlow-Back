import { Schema, model, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  salePrice: number;
  taxCents: number;
  shippingCents: number;
  quantity: number;
  minStock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, required: true, trim: true },
    costPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, default: 0 },
    shippingCents: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ category: 1 });
productSchema.index({ active: 1, quantity: 1 });
productSchema.index({ name: 'text', sku: 'text' });

export const Product = model<IProduct>('Product', productSchema);
