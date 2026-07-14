# Data Model: Backend & E2E Test Suite Firebase Emulator Reliability

## No new or modified data entities

This feature changes test configuration, test-helper timeout behavior, and
the CI workflow only. It introduces no new domain entities, no changes to
Firestore document shapes, and no new API request/response contracts.

The only "state" this feature reasons about is process-level and
infrastructure-level, not domain data:

- Test/hook execution time (bounded by `testTimeout`)
- Open process handles at test-suite exit (detected/reported, then force-closed)
- A single cache-layer connection object (`ioredis` client in
  `backend/src/cache/redisClient.ts`), neutralized during tests rather than
  modeled as data
- Emulator port bindings (`9099` Auth, `8080` Firestore) — fixed
  configuration values in `backend/firebase.json`, not data
- CI job wall-clock duration (bounded by `timeout-minutes`)

None of these are persisted, versioned, or exposed to end users, so no
entity/attribute/relationship model applies. Per the spec template, this
section is intentionally minimal rather than padded with placeholder
entities.
