# Quickstart: Validate Persistent Header Search & Results Page

## Prerequisites

- Frontend dev environment set up (`cd frontend && npm install`).
- A logged-in test account (Firebase auth), ideally with a linked Discogs
  account to also exercise the add-to-library action.

## Run the app

```bash
cd frontend
npm run dev
```

Open the printed local URL and log in.

## Manual validation scenarios

1. **Header search is always visible** (User Story 1)
   - Visit Dashboard, My Library, Wishlist, a Record Detail page, and
     Profile in turn.
   - Confirm a search textbox is visible, centered in the header, on every
     one of them.

2. **Search launches the results page** (User Story 2)
   - From any of the pages above, type a query (e.g., an artist name) into
     the header search box and submit.
   - Confirm the app navigates to `/app/search?q=...` and shows matching
     records as cards (cover, title, artist, year) with add and preview
     actions and pagination, matching today's existing result-card behavior.
   - From the results page, submit a different query from the header;
     confirm the same page updates to the new results without a full reload.
   - Submit an empty query; confirm nothing happens (no navigation).
   - Search a nonsense string with no matches; confirm a clear empty-state
     message appears.
   - Use the preview action on a result; confirm the existing preview modal
     opens. Use the add action; confirm the record is added to the library
     as it is today (or the existing Discogs-link gate message appears if
     the account isn't linked).

3. **Header search resets on navigation** (Clarification 2 / FR-002a)
   - After submitting a query and landing on the results page, navigate to
     Wishlist (or any other page).
   - Confirm the header search box is empty again.

4. **My Library no longer shows "Add a record"** (User Story 3)
   - Open My Library with an active Discogs link.
   - Confirm there is no "Add a record" link/button; confirm the header
     search box is present and usable from this page.
   - If testing the Discogs-not-linked gated state, confirm that gating
     message still renders exactly as before.

5. **Old route is retired** (FR-011)
   - Manually navigate the browser to `/app/library/add`.
   - Confirm it no longer renders the old add-record page (consistent with
     how any other unknown route behaves in this app today).

## Automated checks

```bash
# Frontend unit/component tests
cd frontend && npm test

# e2e (Playwright) — includes the three specs updated by this feature:
# library-discogs-sync.spec.ts, caching-navigation.spec.ts,
# release-preview-gallery.spec.ts
cd e2e && npx playwright test
```

Refer to [data-model.md](./data-model.md) for the client-side state shape and
[contracts/header-search-navigation.md](./contracts/header-search-navigation.md)
for the exact route/query-param contract being validated above.
