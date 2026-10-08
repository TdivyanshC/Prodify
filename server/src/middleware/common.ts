import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { z, type ZodType } from 'zod';
import { isDev } from '../config/env';
import { AppError, tooMany } from '../lib/errors';
import { logger } from '../lib/logger';

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = req.header('x-request-id') ?? randomUUID();
  res.setHeader('x-request-id', req.requestId);
  const started = Date.now();
  res.on('finish', () => {
    logger[res.statusCode >= 500 ? 'error' : 'debug'](
      { reqId: req.requestId, method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - started },
      'request'
    );
  });
  next();
}

// Sliding-window limiter per user (or IP before auth). In-process store;
// the Redis store (rate-limiter-flexible) drops in for multi-instance.
const windows = new Map<string, number[]>();
export function rateLimit(name: string, limit: number, windowMs: number, keyOf?: (req: Request) => string | undefined): RequestHandler {
  return (req, _res, next) => {
    const who = keyOf?.(req) ?? req.user?._id.toHexString() ?? req.ip ?? 'anon';
    const key = `${name}:${who}`;
    const now = Date.now();
    const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      logger.warn({ key }, 'rate limit tripped');
      throw tooMany();
    }
    hits.push(now);
    windows.set(key, hits);
    next();
  };
}

// Parses body/query/params with zod; the parsed value replaces the raw one.
export function validate<T extends ZodType>(schema: T, where: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Some fields are invalid', z.flattenError(result.error).fieldErrors);
    }
    if (where === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else (req as unknown as Record<string, unknown>)[where] = result.data;
    next();
  };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'No such endpoint'));
}

// Last middleware: one envelope for every error, no stack traces in prod.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status === 401 || err.status === 403) logger.warn({ reqId: req.requestId, code: err.code }, 'auth rejected');
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof MongoServerError && err.code === 11000) {
    res.status(409).json({ error: { code: 'DUPLICATE', message: 'That already exists' } });
    return;
  }
  if (err instanceof MongoServerError && err.code === 121) {
    logger.error({ err, reqId: req.requestId }, 'schema validation rejected a write');
    res.status(400).json({ error: { code: 'SCHEMA_REJECTED', message: 'That change isn’t valid' } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
    return;
  }
  logger.error({ err, reqId: req.requestId }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong', ...(isDev ? { details: String(err) } : {}) } });
}
