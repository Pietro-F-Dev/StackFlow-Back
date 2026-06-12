import { Schema, model, Document, Types } from 'mongoose';
import { ROLES, type Role } from '../constants/roles';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.SELLER },
    avatarUrl: { type: String, maxlength: 250_000 },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);
