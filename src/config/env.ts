import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters (use a high-entropy random string)');
}

const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (isProd && !allowedOrigin) {
  throw new Error('ALLOWED_ORIGIN must be set in production (refusing to fall back to wildcard CORS)');
}

const trustProxy = process.env.TRUST_PROXY;

export const env = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '30', 10),
  nodeEnv,
  isProd,
  allowedOrigin,
  trustProxy,
};
