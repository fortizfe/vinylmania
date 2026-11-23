---
name: hexagonal-architecture
description: Vinylmania backend hexagonal architecture (constitution §VIII) — where code goes (domain/application/ports/adapters), the dependency rule, how to add a use case, endpoint, port or new domain, how domain errors map to HTTP, and how Discogs/Redis/Firestore integrations are wired. Use before writing, moving or reviewing any code under backend/src, when designing a backend feature, or when asked "where should this live?".
---

# Hexagonal architecture — Vinylmania backend

Binding source: `CONSTITUTION.md` §VIII (and §II for Discogs). This skill is the
practical map. Read the code of the domain you touch before adding anything —
the existing domain folders are the template, not this file.

## Layout

Global layer folders, one subfolder per business domain:

```
backend/src/
  domain/<d>/        types, pure rules, domain errors        → imports nothing but domain/ + transversal
  application/<d>/   use cases: createXxxUseCase(deps)       → domain/, ports/, transversal
  ports/<d>/         interfaces only (XxxPort)               → domain/ types
  adapters/<d>/      SDK code + <d>Routes.ts (composition)   → anything
  discogs/           shared Discogs rate limiter, retry, circuit breaker, DiscogsError hierarchy
  config/logger.ts, shared/   transversal (no infra deps) → usable from any layer
  app.ts             mounts every router under /api/*
```

Domains today: `auth`, `library`, `wantlist`, `discogsCatalog`, `discogsOauth`,
`feeds`, `collectionStats`, `streaming`, `googleAuth`, `users`.

## The dependency rule (merge gate)

- `domain/` and `application/` MUST NOT import `firebase-admin`, `axios`,
  `ioredis`, `rss-parser`, `express` or any `adapters/` file.
- Routes and middleware are **driving adapters**: parse/validate the request
  (`zod`), call a use case, map the result or domain error to HTTP. No business
  orchestration in them.
- Use cases depend on ports, never on concrete adapters. Wiring happens only in
  the domain's `*Routes.ts` (the composition root).

Check it (should print nothing):

```bash
cd backend/src && grep -rnE "from '(axios|firebase-admin[^']*|ioredis|rss-parser|express)'|from '\.\./\.\./adapters/" domain application
```

Known debt (2026-11-23): `application/{library/createLibraryEntry,library/enrichLibraryEntry,wantlist/addToWantlist,wantlist/enrichWantEntry}.ts`
import `getRelease` straight from `adapters/discogsCatalog/discogsCatalogAdapter`.
Don't copy that pattern. When you touch one of them, inject it through
`DiscogsCatalogPort` instead and remove the file from this list.

## Recipes

**New use case** (most common):
1. Test first in `backend/tests/unit/<d>/` with in-memory fakes of the ports
   (plain objects implementing the interface — no nock, no emulator needed).
2. `application/<d>/<verbNoun>.ts` exporting
   `export function createVerbNounUseCase(deps: { repository: XxxPort; ... }) { ...; return { verbNoun }; }`
   — copy the shape of `application/library/deleteLibraryEntry.ts`.
3. Wire it in `adapters/<d>/<d>Routes.ts` with the existing adapter singletons.

**New endpoint**: contract test first in `backend/tests/contract/<d>/` (Supertest
against `app`), then the route in the existing `*Routes.ts`. Validate input with
`zod` at the boundary. Rate-limit with `adapters/rateLimit/` like its siblings.
API changes need a contract doc under `specs/<NNN>/contracts/` before code
(constitution "Additional Constraints").

**New port** — only when a use case needs infrastructure that no existing port
covers. Extend the existing port of that domain first (e.g. a new method on
`LibraryRepositoryPort`) before creating a new interface. One port per external
system per domain, not one per method.

**New domain** — only when the feature is a genuinely new business area. Create
just the layer folders you need (no empty `.gitkeep` scaffolding "for later"),
add the router to `app.ts`.

## One class per file (constitution §XII)

One class per file, named after it (`DiscogsNotFoundError` → `discogsNotFoundError.ts`).
Legacy multi-class files to split when a PR touches them (never add a class to them):
`discogs/discogsErrors.ts` (6), `domain/streaming/streamingErrors.ts` (3),
`domain/library/libraryErrors.ts`, `domain/wantlist/wantlistErrors.ts`,
`application/library/createLibraryEntry.ts`, `adapters/rateLimit/rateLimitStore.ts` (2 each).
Check: `cd backend/src && grep -rcE "^(export )?(abstract )?class " . | grep -vE ":(0|1)$"`.

## Errors → HTTP

Domain/application code throws typed errors with no HTTP knowledge
(`domain/<d>/<d>Errors.ts`; Discogs failures use the `DiscogsError` hierarchy in
`src/discogs/discogsErrors.ts` with `code`: `not_found | rate_limited |
unavailable | validation_error | auth_failed`). Only routes translate them,
reusing the existing mappers (`adapters/discogs/respondCollectionError.ts`,
`respondDiscogsAuthError.ts`) before writing a new one. Internal details go to
`logger`, never into the response body (constitution §V).

## External integrations

- **Discogs** (§II): every call goes through an adapter that uses the shared
  `src/discogs/` rate limiter (`acquireSlot` / `recordRateLimitHeaders`),
  retry-with-backoff and circuit breaker. Never call Discogs from a use case or
  bypass the limiter. Catalog metadata is never persisted as source of truth in
  Firestore — Firestore holds user state only (ownership, ratings, notes).
- **Cache**: wrap fetches with `withCache(key, ttl, fetcher)` from
  `adapters/cache/cacheAside.ts` (dedupes in-flight calls, falls back to the
  fetcher when Redis is down). Don't build another cache.
- **Firestore**: only in `adapters/*/firestore*Repository.ts`. Document-shape
  changes that break readers are MAJOR and need a migration/backfill plan (§VI).
- **Tests for adapters**: `nock` via `tests/helpers/nock.ts` for HTTP; the
  Firebase emulator for Firestore/Auth (integration/contract suites).

## Ponytail guardrails

Hexagonal is mandatory, ceremony is not: no port for a pure function, no
"service" class wrapping one use case, no DTO mapper when the domain type
already fits the response, no interface with a single method that's only ever
called inline. If the dependency rule is satisfied with fewer files, use fewer
files.
