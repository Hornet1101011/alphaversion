import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

export function createRateLimiter(options?: { windowMs?: number; max?: number; message?: string }): RequestHandler {
  const { windowMs = 60 * 60 * 1000, max = 5, message } = options || {};
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ message: message || 'Too many requests, please try again later.' });
    },
  }) as unknown as RequestHandler;
}
