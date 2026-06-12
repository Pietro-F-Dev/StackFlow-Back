import { Schema, model, Document, Types } from 'mongoose';

export type MovementType = 'in' | 'out' | 'sale' | 'adjustment' | 'return';

export interface IStockMovement extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  type: MovementType;
  qty: number;
  reason?: string;
  refSaleId?: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['in', 'out', 'sale', 'adjustment', 'return'], required: true },
    qty: {
      type: Number,
      required: true,
      validate: [(v: number) => Number.isInteger(v) && v !== 0, 'qty must be a non-zero integer'],
    },
    reason: { type: String, trim: true },
    refSaleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

stockMovementSchema.index({ productId: 1, date: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ refSaleId: 1 });

export const StockMovement = model<IStockMovement>('StockMovement', stockMovementSchema);
