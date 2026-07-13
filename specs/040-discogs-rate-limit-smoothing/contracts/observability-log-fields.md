# Contract: Observability Log Fields (`backend/src/config/logger.ts`)

Extends the existing structured `LogEvent`/`LogOutcome` contract (unchanged shape: `{ timestamp,
level, route, outcome, uid?, message?, meta? }`) — no new logging mechanism, matching feature
029's own precedent for this exact file.

## `LogOutcome` additions

```ts
export type LogOutcome =
  | /* ...existing values unchanged... */
  | 'throttled'             // NEW — acquireSlot() applied a non-zero delay
  | 'throttle_unavailable'; // NEW — acquireSlot()/recordRateLimitHeaders() hit an internal error and fell back to zero delay (FR-005)
```

## `meta` fields on the new outcomes

| `outcome` | `meta` fields | Meaning |
|---|---|---|
| `'throttled'` | `delayMs` (number), `remaining` (number, pre-decrement), `limit` (number) | The local throttle spaced this request out by `delayMs` because `remaining` had dropped to/below the safety threshold (SC-001/SC-003). |
| `'throttle_unavailable'` | none required | The rate-limiter's internal state computation failed; the request was sent immediately, unthrottled, as a fail-soft fallback (FR-005). Expected to be rare-to-never in practice since the limiter holds no external dependency. |

## Consumers of this contract

- User Story 1's Acceptance Scenarios 1–3 and SC-003 (spec.md) are validated directly against
  `'throttled'` log lines (grep/parse `outcome` + `meta.delayMs` from stdout/stderr JSON lines) —
  the same mechanism feature 029 established for `circuit_open`/`meta.attempts`. No dashboard,
  alerting, or external log-shipping contract exists in this project (per feature 029's research
  §9, still true) — this file is the complete downstream contract.
