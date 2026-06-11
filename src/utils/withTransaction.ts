import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { AppError } from '../middlewares/errorHandler';

const MAX_ATTEMPTS = 3;
const TRANSIENT_LABEL = 'TransientTransactionError';

interface MongoErrorLike {
  errorLabels?: string[];
}

function isTransient(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const labels = (err as MongoErrorLike).errorLabels;
  return Array.isArray(labels) && labels.includes(TRANSIENT_LABEL);
}

/**
 * Runs `work` inside a MongoDB transaction, retrying up to MAX_ATTEMPTS times
 * on transient transaction errors. The returned value is whatever `work` returns.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      session.startTransaction();
      try {
        const result = await work(session);
        await session.commitTransaction();
        return result;
      } catch (err) {
        await session.abortTransaction();
        if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      }
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Transaction failed after retries');
  } finally {
    await session.endSession();
  }
}
