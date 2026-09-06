# Quickstart & Validation: Discogs-Integrated Wantlist

How to run and prove the feature end-to-end. Implementation details live in `tasks.md`;
contracts live in `contracts/`.

## Prerequisites

- Node + workspace deps installed (`npm install` at repo root; `e2e/` has its own).
- Firebase emulator available (backend integration tests) — `npm run emu` / project script.
- No new environment variables. The wantlist client reuses `DISCOGS_CONSUMER_KEY`,
  `DISCOGS_CONSUMER_SECRET`, `DISCOGS_USER_AGENT`, and the OAuth base URL overrides
  (`DISCOGS_OAUTH_BASE_URL`) already used by the collection client.

## Run the test suites

```bash
# Backend unit + integration (Jest). Wantlist adapter contract tests run against
# the in-process extended Discogs stub; route tests use supertest.
cd backend && npm test

# Frontend component + page tests (Vitest + RTL)
cd frontend && npm test

# End-to-end (Playwright) — starts the real backend against e2e/helpers/discogsOauthStub.ts
cd e2e && npm test -- wishlist-discogs-sync
```

## Manual walkthrough (dev servers)

```bash
# terminal 1 — backend
cd backend && npm run dev
# terminal 2 — frontend
cd frontend && npm run dev
```

Then, signed in with a **linked** Discogs account:

| # | Action | Expected (spec ref) |
|---|--------|---------------------|
| 1 | Open "My wishlist" from the header (desktop **and** mobile menu) | Nav entry sits alongside "My library"; the page loads the Discogs wantlist as cards with the community rating badge (FR-001, FR-003, US1-1) |
| 2 | Unlink Discogs (Profile) then open "My wishlist" | "Link your Discogs account" gate only — no list, no actions (FR-002, US1-2, SC-007) |
| 3 | Re-link; empty the Discogs wantlist on discogs.com; open "My wishlist" | Empty state, not an error (FR-004, US1-3) |
| 4 | From a search result, click "Add to wishlist" (distinct from "Add to library") | Release is added to the Discogs wantlist; action shows the added state (FR-005, FR-006, US2-1/US2-3) |
| 5 | Open a release detail page; use "Add to wishlist" | Added to Discogs wantlist; a wantlist panel appears with notes + a personal star rating (FR-005, FR-008, US3-1) |
| 6 | In the wantlist panel, tap a star, then type a note and blur | Each field autosaves to Discogs with no Save button; reload → values persist; visible on discogs.com (FR-009, US3-2, SC-003) |
| 7 | Click "Add to wishlist" for a release already in your library | Still added to the wantlist; result says it's already in your library; library unchanged (FR-007a) |
| 8 | Click "Add to wishlist" for a release already in the wantlist | No duplicate; action indicates "already in your wishlist" (FR-007, US2-6) |
| 9 | In "My wishlist", click "Remove from wishlist" on an entry | A confirmation dialog appears; confirm → entry removed from Discogs wantlist and list; dismiss → nothing changes (FR-011, US4-1/US4-3, SC-006) |
| 10 | Add a wanted release to your library ("Add to library") | Release appears in the library; disappears from "My wishlist"; Discogs wantlist no longer contains it (FR-012, US5-1) |
| 11 | Open "My wishlist" twice within ~5 min (watch backend logs) | Second open logs `sync_skipped` and issues no Discogs `/wants` request; "Refresh" forces `sync_completed` (FR-014, FR-015, SC-008) |
| 12 | Simulate a Discogs outage (stub failure mode) during add/edit/remove | Clear, retryable error; the operation is never shown as succeeded; displayed state stays consistent with Discogs (FR-017, SC-005) |
| 13 | Delete a wantlist entry directly on discogs.com, then Refresh | Entry disappears; is not re-added by Vinylmania (FR-018) |

## Accessibility / design checks (Principles X, XI)

- Keyboard-only: tab to "Add to wishlist", the wantlist panel's star rating and notes,
  and the remove confirmation — all reachable, visible focus, no trap; `Esc` closes the dialog.
- "Add to library" vs "Add to wishlist" are distinguishable by accessible name + icon,
  not color alone.
- Contrast: new text/controls meet WCAG AA against light and dark surfaces (reuse audited
  tokens from features 058/059).
- `prefers-reduced-motion`: the "added" transition and dialog animation collapse to no motion.
- The `apple-design` / `emil-design-eng` / `animate` skills were consulted for
  `WantlistPanel`, `RemoveFromWantlistDialog`, and the add→added transition.

## Definition of done

- [ ] All acceptance scenarios in `spec.md` pass via the tables above and the e2e spec.
- [ ] `SC-001`…`SC-008` verified (sync equivalence, no duplicates, autosave persistence,
      no dual-list, no silent failures, ≤2-interaction remove, cache-window request count).
- [ ] Backend, frontend, and e2e suites green; no WCAG 2.1 AA regression.
- [ ] MINOR version bump (additive API surface).
