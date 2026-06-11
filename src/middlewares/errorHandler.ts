import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface BodyParserError {
  status: number;
  type?: string;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return typeof err === 'object' && err !== null && 'status' in err;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message, ...err.data });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors,
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: 'INVALID_ID', message: 'Invalid resource ID' });
    return;
  }

  if (isBodyParserError(err)) {
    if (err.status === 413) {
      res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds size limit' });
      return;
    }
    if (err.status === 400) {
      res.status(400).json({ error: 'MALFORMED_JSON', message: 'Request body is not valid JSON' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
