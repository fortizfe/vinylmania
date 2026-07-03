# Quickstart: Vinyl Library CRUD

## Prerequisites

- Features 001 (Firebase Auth) and 002 (Discogs client) already set up and
  working locally — see their quickstarts if not:
  [specs/001-landing-google-login/quickstart.md](../001-landing-google-login/quickstart.md),
  [specs/002-discogs-api-client/quickstart.md](../002-discogs-api-client/quickstart.md).
- No new environment variables or credentials are needed for this feature.

## Run locally

```bash
# Backend
cd backend && npm run dev

# Frontend (separate terminal)
cd frontend && npm run dev
```

## Run the tests

```bash
cd backend
npm run test:emulators   # Firestore + Auth emulators, contract + unit + integration tests

cd frontend
npm test
```

## Validate manually (end-to-end)

These map to the spec's acceptance scenarios:

1. **Add a record (US1)**: Sign in, go to "Add a record," search for a
   well-known release (e.g., "Stockholm"), select the real match, confirm
   it's added. Expect it to appear in your library afterward.
2. **View library (US2)**: Open your library. With at least one record
   added, confirm it's listed with title/artist/cover recognizable at a
   glance. With none added yet, confirm a clear empty state (not a blank
   screen or error).
3. **View detail (US3)**: Open a record from the list. Confirm you see its
   full catalog detail (tracklist, label, etc.) alongside your own
   condition/notes for that copy.
4. **Remove a record (US4)**: From the list or detail view, remove a
   record. Confirm you're asked to confirm first, and that the record no
   longer appears afterward.
5. **Update notes (US5)**: Edit a record's condition/notes. Reopen its
   detail view and confirm the change persisted.
6. **Isolation (FR-006)**: Sign in as a second Google account (or a second
   browser profile). Confirm this account's library starts empty and never
   shows the first account's records.
7. **Graceful degradation (FR-009)**: Temporarily block network access to
   `api.discogs.com` (or use an invalid `DISCOGS_TOKEN`) with at least one
   existing library entry, then load the library list. Confirm the entry
   still appears with its personal notes and a "couldn't load catalog
   details" state, rather than the whole list failing.
