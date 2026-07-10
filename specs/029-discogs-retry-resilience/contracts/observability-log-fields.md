# Contract: Observability Log Fields (`backend/src/config/logger.ts`)

Extends the existing structured `LogEvent`/`LogOutcome` contract (unchanged shape: `{ timestamp, level, route, outcome, uid?, message?, meta? }`) rather than introducing a new logging mechanism. This is what User Story 3's acceptance scenarios are tested against.

## `LogOutcome` addition

```ts
export type LogOutcome =
  | /* ...existing values unchanged... */
  | 'circuit_open'; // NEW
```

## `meta.attempts` field (new, on existing outcomes)

| `outcome` | `meta.attempts` meaning |
|---|---|
| `'success'`, `attempts: 1` | Succeeded on the first try — no retry occurred. |
| `'success'`, `attempts: 2` or `3` | **Recovered after retry** — the exact case this feature exists to produce more of (SC-001, SC-005). |
| `'rate_limited'` or `'unavailable'`, `attempts: 3` | **Retries exhausted** — every attempt failed; the collector sees the existing "temporarily unavailable" message (SC-005 distinguishes this from a same-outcome log line that had `attempts: 1`, which today's code already produces for 404/401/403-type immediate failures that never entered the retry path). |
| `'circuit_open'` | No `attempts` field (no attempt was made at all — the breaker short-circuited before any request). |

## Consumers of this contract

- User Story 3's acceptance scenarios (spec.md) are validated directly against these log lines (grep/parse `outcome` + `meta.attempts` from stdout/stderr JSON lines — same mechanism already used for every other structured log in this project, no new tooling).
- No dashboard, alerting, or external log-shipping contract exists in this project today (research.md §9) — this file is the complete downstream contract.
