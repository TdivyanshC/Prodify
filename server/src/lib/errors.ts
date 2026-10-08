import { ObjectId } from 'mongodb';

// Every thrown AppError becomes `{ error: { code, message, details? } }`
// with its status — one error shape for the whole API (backend doc §5.1).
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Sign in required') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (code: string, message: string) => new AppError(403, code, message);
// 404 (not 403) for blocked users too, so a block is never revealed (§12).
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const tooMany = () => new AppError(429, 'RATE_LIMITED', 'Slow down a little');

export function parseId(value: unknown, what = 'id'): ObjectId {
  if (typeof value !== 'string' || !ObjectId.isValid(value) || value.length !== 24) throw badRequest('INVALID_ID', `Invalid ${what}`);
  return new ObjectId(value);
}
