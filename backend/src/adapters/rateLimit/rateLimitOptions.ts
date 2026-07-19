import type { RateLimitExceededEventHandler } from 'express-rate-limit';

// Shared *values*, not a shared middleware instance: CodeQL's
// js/missing-rate-limiting query has a documented false-negative when the
// actual rateLimit(...) call result is constructed in one file and imported
// into another (github/codeql issue #1949) — so every route file below
// calls rateLimit(...) itself, locally, using only these plain constants.
export const RATE_LIMIT_WINDOW_MS = 60_000;

// strict: 20, not the initially-chosen 10 — raised after the existing
// discogsOauthRoutes.test.ts contract suite (12 legitimate calls to
// /request+/complete across its normal test flow, sharing one limiter
// instance for the whole file) started tripping the limit at 10, per
// research.md §2c.
export const RATE_LIMIT_THRESHOLDS = {
  strict: 20,
  standard: 100,
} as const;

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

export const rateLimitHandler: RateLimitExceededEventHandler = (_req, res, _next, options) => {
  res.status(options.statusCode).json({ error: 'rate_limited', message: options.message });
};
