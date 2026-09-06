# Contract: `DiscogsWantlistPort` ↔ Discogs `/wants`

**Port**: `backend/src/ports/discogsOauth/discogsWantlistPort.ts`
**Adapter**: `backend/src/adapters/discogsOauth/discogsWantlistAdapter.ts`

The adapter is an OAuth-1.0a-signed client acting **as the linked user**, targeting the
env-overridable Discogs base URL (`getOauthApiBaseUrl()`, same as
`discogsCollectionAdapter`). It MUST reuse the shared resilience machinery (Decision 4):

- circuit breaker: `shouldShortCircuit()` / `recordSuccess()` / `recordExhaustedFailure()` from `discogs/discogsCircuitBreaker`
- preventive throttle: `acquireSlot()` from `discogs/discogsRateLimiter`, after the breaker check
- retry/backoff: `classifyForRetry` / `backoffDelayMs` / `MAX_ATTEMPTS` from `discogs/discogsRetry`
- rate-limit headers: `recordRateLimitHeaders(headers)` on every response (success and error)
- `Authorization` header rebuilt per request via `buildProtectedResourceHeader(getCredentials(), { token, tokenSecret })`

---

## Port interface

```ts
export interface DiscogsWantlistPort {
  /** Walks every page of GET /users/{username}/wants. Newest-first not guaranteed by Discogs; caller sorts. */
  listWants(connection: DiscogsConnection): Promise<WantItem[]>;

  /**
   * Single want lookup, derived from `listWants` + `.find` — Discogs exposes
   * no `GET /users/{username}/wants/{id}` endpoint. Resolves null when the
   * release is not among the caller's wants. Inherits `listWants`' errors.
   */
  getWant(connection: DiscogsConnection, releaseId: number): Promise<WantItem | null>;

  /**
   * PUT /users/{username}/wants/{releaseId}. Upsert: creates the want if absent,
   * updates the provided fields if present. Returns the resulting WantItem.
   * Non-idempotent-ish write: __skipRetry (breaker still applies).
   */
  putWant(
    connection: DiscogsConnection,
    releaseId: number,
    fields: { notes?: string; rating?: number },
  ): Promise<WantItem>;

  /**
   * DELETE /users/{username}/wants/{releaseId}.
   * Resolves normally on 204; throws DiscogsNotFoundError on 404 (caller decides
   * whether 404 is benign — it is for "remove on purchase", it is a 404-to-client
   * for an explicit DELETE /api/wantlist/:releaseId).
   * __skipRetry (breaker still applies).
   */
  deleteWant(connection: DiscogsConnection, ref: number): Promise<void>;
}
```

`WantItem` — see `data-model.md` §1.

---

## External calls

| Port method | Discogs call | Success | Mapped errors |
|-------------|--------------|---------|---------------|
| `listWants` | `GET /users/{username}/wants?page={n}&per_page=100` (loop while `page ≤ pagination.pages`) | `200` → concat + `mapWant` each | `401/403`→`DiscogsAuthError`, `429`→`DiscogsRateLimitError`, `5xx`/network/circuit→`DiscogsUnavailableError` |
| `getWant` | _(none — derived from `listWants`)_ | `listWants().find(w => w.releaseId === releaseId) ?? null` | inherits `listWants` errors |
| `putWant` | `PUT /users/{username}/wants/{releaseId}` body `{ notes?, rating? }` | `200`/`201` → `mapWant(response)` | `404`→`DiscogsNotFoundError`, others as above |
| `deleteWant` | `DELETE /users/{username}/wants/{releaseId}` | `204` → resolve | `404`→`DiscogsNotFoundError`, others as above |

`{username}` = `encodeURIComponent(connection.discogsUsername)`.

---

## `mapWant(raw)` normalization

```ts
function mapWant(raw: RawWant): WantItem {
  return {
    releaseId: raw.id ?? raw.basic_information.id,
    rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, Math.trunc(raw.rating))) : 0,
    notes: raw.notes && raw.notes !== '' ? raw.notes : null,
    dateAdded: raw.date_added,
    basicInformation: {
      title: raw.basic_information?.title ?? '',
      year: raw.basic_information?.year ?? null,
      artists: (raw.basic_information?.artists ?? []).map((a) => ({ name: a.name })),
      thumb: raw.basic_information?.thumb || null,
    },
  };
}
```

---

## Contract tests (against the extended `discogsOauthStub`)

1. `listWants` walks multiple pages and returns every want, `mapWant`-normalized.
2. `listWants` on an empty wantlist returns `[]` (not an error).
3. `getWant` returns `null` for a release not in the wantlist and the mapped `WantItem` when present — both resolved from the `GET /users/{username}/wants` list (there is no dedicated single-want endpoint).
4. `putWant` with `{ rating }` only leaves `notes` unchanged on the stub; with `{ notes }` only leaves `rating`.
5. `putWant` for a release not yet in the wantlist creates it (upsert).
6. `deleteWant` removes the want (204); throws `DiscogsNotFoundError` when absent.
7. `401` from the stub (`collectionFailureMode: 'auth'`) → `DiscogsAuthError` on every method.
8. `429` → `DiscogsRateLimitError` after `MAX_ATTEMPTS`; circuit breaker records the exhausted failure.
9. Writes (`putWant`/`deleteWant`) are not auto-retried (`__skipRetry`) but a `5xx` still trips the breaker.
10. `recordRateLimitHeaders` is called on both success and error responses.
