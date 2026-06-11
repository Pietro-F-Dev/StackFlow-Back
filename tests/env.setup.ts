// Sets env vars before any module is loaded — env.ts reads these at import time
process.env.MONGODB_URI = 'mongodb://placeholder/test';
process.env.JWT_SECRET = 'test-secret-key-for-jest-32chars!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
