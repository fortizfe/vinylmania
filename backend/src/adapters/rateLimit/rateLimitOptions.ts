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
//
// RATE_LIMIT_MAX_OVERRIDE (both tiers, not per-tier — E2E only needs
// "effectively unlimited," not precise tuning): the e2e suite drives a
// single long-lived backend process (playwright.config.ts's webServer)
// through 139+ real Google sign-ins across its full run, comfortably
// exceeding either tier's production threshold — this is CI test volume,
// not the abuse pattern the limiter defends against. The rateLimit(...)
// call itself stays present unconditionally in every route file regardless
// of this override (CodeQL's js/missing-rate-limiting recognition is keyed
// off that call's presence, not the threshold it resolves to — research.md
// §2b/§2c), so this cannot regress the gate. playwright.config.ts sets it;
// production and normal dev/tests leave it unset and get the real values.
const overrideRaw = Number(process.env.RATE_LIMIT_MAX_OVERRIDE);
const override = Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : undefined;

export const RATE_LIMIT_THRESHOLDS = {
  strict: override ?? 20,
  standard: override ?? 100,
} as const;

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

export const rateLimitHandler: RateLimitExceededEventHandler = (_req, res, _next, options) => {
  res.status(options.statusCode).json({ error: 'rate_limited', message: options.message });
};
