# Data Model: Fix CodeQL Code Quality Gate Alerts

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19

This feature is a remediation of existing code, not a new domain feature — it introduces no Firestore collections, no schema changes, and no user-facing persisted entities. It does introduce one small, ephemeral, infrastructure-level record (Redis-only, never persisted to Firestore, no relationship to any domain entity) needed by the rate-limiting fix, plus the tracking entity already named in spec.md.

## RateLimitCounter (ephemeral, Redis-only)

Backs the `RateLimiterPort` (see `contracts/rate-limiter-port.md`). Not a domain entity — it has no representation outside Redis, no ID beyond its key, and no relationship to `User`, `LibraryEntry`, or any other existing entity.

| Field | Type | Notes |
|---|---|---|
| key | string | `ratelimit:{tier}:{ip}:{windowStart}` — `tier` is `strict` or `standard`, `ip` is `req.ip`, `windowStart` is the fixed 60s window's epoch-second floor. |
| count | integer | Incremented once per request in that window via Redis `INCR`. |
| ttl | integer (seconds) | Set once via Redis `EXPIRE` when `count` transitions 0→1, sized to the tier's window (60s), so the key self-deletes and no cleanup job is needed. |

**Lifecycle**: created implicitly on first request in a window (`INCR` on a non-existent key starts it at 1) → expires automatically via Redis TTL at the end of the window. No update or delete path exists outside expiry — this is intentionally the simplest possible fixed-window counter, matching research.md §2's YAGNI rationale.

**Validation rules**: none beyond the tier's configured threshold (`strict`: 10, `standard`: 100 — see research.md §3), enforced by the adapter comparing `count` against the threshold after `INCR`, not by the record itself.

## Code-Quality Alert (tracking entity, not a system-owned record)

Already defined in spec.md § Key Entities: a GitHub code-scanning alert (rule ID, severity, path, line, state). Not created, stored, or modified by this feature's code — it is read (via `gh api .../code-scanning/alerts`) to verify SC-001/SC-002 during quickstart validation, and its `open`→`resolved` transition is a side effect of GitHub re-scanning the fixed code, not something this feature writes directly.
