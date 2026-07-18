# API Contract: Discogs Catalog endpoints (extended error contract)

**Feature**: 053-catalog-oauth-attribution | **Date**: 2026-07-18

Endpoints affected: `GET /api/discogs/search`, `GET /api/discogs/releases/:discogsId`, `GET /api/discogs/masters/:discogsId`, `GET /api/discogs/masters/:discogsId/versions`. All already require Firebase auth (`Authorization: Bearer <idToken>`, existing `requireAuth`) and are unchanged in every other respect (request params, response shapes, existing 404/429/502 behavior) — this contract only **adds** one new error response.

## New error response

| Status | Body `error` | When |
|---|---|---|
| 401 | `discogs_link_invalid` | The requesting user has an active linked Discogs account, **and that specific request was signed with it**, but Discogs rejected those credentials (revoked externally). Message: `"Your Discogs link is no longer valid. Please re-link your account from your profile."` — byte-identical to the existing collection contract (`specs/016-library-discogs-sync/contracts/library-sync-api.md`). |

**Not** returned when the request was identified with `DISCOGS_TOKEN` (unlinked user) — a rejected `DISCOGS_TOKEN` is an operational/config problem, not this user's link, and continues to surface as `500 internal_error` (unchanged pre-053 fallthrough behavior; see "Behavioral note" below).

Response body shape is unchanged from the existing convention: `{ "error": string, "message": string }`.

## Explicitly unchanged

- A user with **no** linked Discogs account continues to receive a normal `200` response identified by `DISCOGS_TOKEN` — `discogs_link_invalid` and `discogs_not_linked` (the collection-only 409) both never occur for this population (spec FR-002).
- Existing error responses (`404 release_not_found` / `404 master_not_found`, `429`/`502 catalog_unavailable`, `500 internal_error`) are unchanged in status, body, or triggering condition.
- No request parameter, header, or response body field is added for the success path — the caller cannot observe (and does not need to know) which credential served a `200`.

## Behavioral note (not a wire contract, but load-bearing for tests)

`discogs_link_invalid` can now occur on these four GET endpoints for the first time (previously only reachable via `POST /api/library` and friends). It occurs precisely when: the user has a linked Discogs account (`discogsConnections/{uid}` exists) AND Discogs responds 401/403 to *that specific request*, which was signed with that account's stored `accessToken`/`accessTokenSecret`. It MUST NOT occur for a user with no linked account, regardless of `DISCOGS_TOKEN`'s own validity — a 401/403 caused by an invalid/misconfigured `DISCOGS_TOKEN` (the `vinylmania` credential) is an operational problem, not this user's link, and continues to surface as `500 internal_error`, exactly as it did before this feature (no route has ever special-cased a `DISCOGS_TOKEN` 401/403; this feature must not repurpose that fallthrough for a different, misleading meaning aimed at a population — unlinked users — who have no link to re-establish).
