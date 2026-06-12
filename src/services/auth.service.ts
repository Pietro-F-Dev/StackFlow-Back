import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { AppError } from '../middlewares/errorHandler';
import { env } from '../config/env';
import type { RegisterInput, LoginInput, UpdateProfileInput } from '../schemas/auth.schema';

const SALT_ROUNDS = 10;

// Dummy hash used to keep login response time constant when the email is not found.
// Pre-computed bcrypt of a fixed string at SALT_ROUNDS=10 so it costs the same as a real compare.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.iU8oQk5BWQQjvF9eU8R7g7H8C6/W';

function signAccessToken(userId: string, role: string) {
  return jwt.sign({ id: userId, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

function hashRefreshToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ tokenHash, userId, expiresAt });
  return raw;
}

export async function register(input: RegisterInput) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email already in use');
  }
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({ name: input.name, email: input.email, passwordHash, role: input.role });
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  // Always run bcrypt to keep timing constant and prevent user enumeration.
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const token = signAccessToken(user._id.toString(), user.role);
  const refreshToken = await issueRefreshToken(user._id.toString());
  return {
    token,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const updates: Partial<Pick<IUser, 'name' | 'avatarUrl'>> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.avatarUrl !== undefined) {
    updates.avatarUrl = input.avatarUrl === '' ? undefined : input.avatarUrl;
  }
  const user = await User.findByIdAndUpdate(userId, updates, { new: true });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  // Invalid or expired token: TTL index removes expired rows but defend in code too.
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    if (stored) await RefreshToken.deleteOne({ _id: stored._id });
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }
  const user = await User.findById(stored.userId);
  if (!user) {
    await RefreshToken.deleteOne({ _id: stored._id });
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }
  // Rotation: the old token is destroyed; the client must use the new one.
  await RefreshToken.deleteOne({ _id: stored._id });
  const token = signAccessToken(user._id.toString(), user.role);
  const refreshToken = await issueRefreshToken(user._id.toString());
  return { token, refreshToken };
}

export async function logout(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshToken.deleteOne({ tokenHash });
}
