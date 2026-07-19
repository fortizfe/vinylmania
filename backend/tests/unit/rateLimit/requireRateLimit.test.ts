import type { NextFunction, Request, Response } from 'express';

import { createRequireRateLimit } from '../../../src/adapters/rateLimit/requireRateLimit';
import type { RateLimiterPort } from '../../../src/ports/rateLimit/rateLimiterPort';

function mockRes(): Response {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('requireRateLimit middleware factory', () => {
  it('calls next() and sets no rate-limit response when not limited', async () => {
    const rateLimiter: RateLimiterPort = {
      checkAndIncrement: jest.fn().mockResolvedValue({ limited: false, retryAfterSeconds: 0 }),
    };
    const middleware = createRequireRateLimit({ rateLimiter })('standard');
    const req = { path: '/api/library', ip: '1.2.3.4' } as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await middleware(req, res, next);

    expect(rateLimiter.checkAndIncrement).toHaveBeenCalledWith('standard', '1.2.3.4');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 429 with Retry-After and a JSON body when limited, and does not call next()', async () => {
    const rateLimiter: RateLimiterPort = {
      checkAndIncrement: jest.fn().mockResolvedValue({ limited: true, retryAfterSeconds: 42 }),
    };
    const middleware = createRequireRateLimit({ rateLimiter })('strict');
    const req = { path: '/api/auth/google/authorize', ip: '5.6.7.8' } as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'rate_limited',
      message: 'Too many requests. Please try again shortly.',
    });
  });
});
