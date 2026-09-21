# UI Contract: Header search (069)

Scope: `frontend/src/components/HeaderSearchBox.tsx` and the new `HeaderSuggestionPanel.tsx`, on every signed-in screen. Everything here is asserted by Vitest/RTL or Playwright — see [quickstart.md](../quickstart.md). Slot allocation and panel states: [data-model.md §3, §5](../data-model.md).

**This is the first combobox in `frontend/src`.** The pattern below is WAI-ARIA 1.2's combobox-with-listbox-popup and becomes the repo's reference for the next one.

## 1. Activation, submission, dismissal

| Event | Result |
|---|---|
| Activate (click/tap the collapsed control, or focus the field ≥ 640 px) | Expands on `spring.sheet`; the backdrop fades in; the field takes DOM focus with **no** second interaction (FR-003) |
| Activate on `/app/search` | The field is pre-filled with the query in effect and its text is **selected** (`focus()` then `select()`); `hasEdited` is false, so **no lookup and no panel** (FR-004, clarification 4) |
| First `onChange` after activation | `hasEdited = true`; the debounce starts |
| Submit (Enter with no active option, or the search button) | `navigate(buildSearchPath(trimmed, 1, onResultsPage ? activeFilters : undefined), { replace: onResultsPage })` — **unchanged from today** (FR-008), then collapse |
| Escape, panel open | Closes the panel, keeps the text, keeps focus in the field (FR-022) |
| Escape, panel closed | Collapses; `useRestoreFocus` returns focus to the control that opened it (FR-007) |
| Backdrop click/tap | Collapses, same as Escape-when-closed (FR-007) |
| `focusout` whose `relatedTarget` is **outside** the search container (field + panel) | Collapses (FR-007, **at every width**, including the phone overlay — clarification 3) |
| Field emptied | Panel closes, the lookup is discarded, the announcement region is cleared (FR-015) |
| Collapse | `hasEdited = false`, backdrop removed, scroll lock released, announcement region cleared |

A collapse never navigates and never discards the typed text from the URL — it only closes UI.

## 2. Layout by viewport (Tailwind `sm:` = 640 px, exactly FR-005/FR-006's boundary)

| | **< 640 px** | **≥ 640 px** |
|---|---|---|
| Collapsed | A 44×44 icon button, accessible name "Search" | The field at `w-64 md:w-80` plus the existing submit button |
| Activated | Full-width overlay pinned below the header: field + panel. The page **does not scroll horizontally** (FR-005) | The form expands in place to `sm:w-96`; the header's side cells absorb it; **nothing below the header moves** (FR-006, SC-008) |
| Backdrop | `fixed inset-0 z-30`, `.overlay-scrim` + `backdrop-blur-xl`, `aria-hidden="true"`, click collapses | identical |
| Page scroll | **Suspended** via the existing `useScrollLock` while open; position restored on collapse (FR-005, spec edge case) | not locked (the field is in-flow chrome) |
| Modality | **Non-modal.** No `aria-modal`, no `role="dialog"`, no focus trap; the rest of the page stays in the accessibility tree (clarification 3) | identical |
| Touch targets | every interactive element ≥ 44×44 CSS px via `min-h-11 min-w-11` (FR-005, SC-010) | ≥ 44×44 as well |

640–1023 px follows the ≥ 640 column (spec Assumptions). Stacking: backdrop `z-30` < header `z-40` (the expanded field and panel live inside the header) < app overlays `z-50`.

## 3. Accessible names, roles, states

| Element | Role (native first) | Accessible name | State exposed |
|---|---|---|---|
| Form | `search` (existing `role="search"`) | — | — |
| Collapsed icon button (< 640 px) | `button` | "Search" | `aria-expanded` mirrors the search's expanded state |
| Field | `<input type="search">` + `role="combobox"` | "Search Discogs" — persistent, via the existing `Input label` + `hideLabel` (FR-024) | `aria-expanded` (panel displayed), `aria-controls="header-search-listbox"`, `aria-autocomplete="list"`, `aria-activedescendant` (only while an option is active) |
| Submit button | `button` | "Search" | — |
| Panel surface | the existing `<Card>`, `id="header-search-panel"` | — | — |
| Suggestion list | `<ul role="listbox" id="header-search-listbox">` — **always rendered while the panel is displayed**, so `aria-controls` never dangles | "Search suggestions" (`aria-label`) | — |
| Suggestion | `<li role="option" id="header-search-option-{index}">` | "<title>, <secondary detail>, Artist \| Album" | `aria-selected="true"` on the active option only |
| Kind label on a row | visible text ("Artist" / "Album") beside an icon | — | **Never colour alone** (FR-011, FR-025) |
| Skeleton rows (loading) | 5 × `<li role="presentation" aria-hidden="true">` inside the listbox | — | The listbox exposes 0 options; the count lives in the status region |
| Empty state | `<p>` inside the panel, **outside** the listbox | — | — |
| Error state | `<p>` + `<button>` "Retry" inside the panel, outside the listbox | "Retry" | Not `role="alert"` — FR-023 requires a **polite** announcement |
| Announcement region | one `<p role="status" class="sr-only">` inside the search container (repo pattern, `LibraryListPage.tsx`) | — | see §5 |
| Backdrop | `<div aria-hidden="true">` | — | — |

`role="combobox"` on `input type="search"` is permitted by ARIA 1.2, so the native search affordance is kept and no Clear button is invented.

## 4. Keyboard

| Key | Panel closed | Panel open, no active option | Panel open, option *i* active |
|---|---|---|---|
| `ArrowDown` | — | activate option 0 | *i+1*, or **no active option** past the last |
| `ArrowUp` | — | activate the last option | *i−1*, or **no active option** before the first |
| `Enter` | submit the typed query | **submit the typed query** | open option *i* |
| `Escape` | collapse, restore focus | close the panel, keep the text | close the panel, keep the text |
| `Tab` / `Shift+Tab` | normal order | normal order — **into the panel** when it holds a Retry button, otherwise out of the search (which collapses it) | same |

- Arrow keys **never move DOM focus** — only `aria-activedescendant`. This is what removes the need for a focus trap (research D11).
- Arrowing past either end returns to the "no active option" state rather than wrapping, so `Enter`-submits-the-query stays reachable from the keyboard alone (FR-022).
- There is **no keyboard trap** at any width (FR-021, SC-006).
- The focus indicator is the existing `focusRing` / `Input`'s `focus:border-primary` and is visible in both themes (FR-021, US3 #1).

## 5. Announcements (polite, never move focus, never interrupt typing)

One region, set to exactly one string per state change (data-model §5).

| State change | Text |
|---|---|
| Lookup started | "Searching…" |
| Results arrived | "5 suggestions available." — "1 suggestion available." at N = 1 |
| Zero results | "No suggestions for “<typed text>”." |
| Lookup failed | "Suggestions are unavailable. Retry is available." |
| Field emptied / search collapsed | region cleared (FR-015) |
| Activation with a pre-filled query | **nothing** (no lookup runs — FR-004) |
| Several quick changes | exactly one announcement, for the text currently in the field; a superseded response is neither rendered nor announced (FR-013, SC-005) |

Consecutive failures replace the message; a single-valued state cannot stack (FR-019).

## 6. Destinations (FR-012, derived from `resultType` — research D17)

| `resultType` | Destination |
|---|---|
| `master` | `/app/masters/:discogsId` |
| `release` | `/app/releases/:discogsId` |
| `artist` | `buildSearchPath(title)` → `/app/search?q=<name>` |

Choosing a suggestion also collapses the search. The first two match `SearchResultCard.tsx` L89–90 exactly; the third reuses the same `buildSearchPath` the submit path uses.

## 7. Visual & motion tokens (no new token — research D13)

| Piece | Spec |
|---|---|
| Expand / collapse | `spring.sheet` (`duration 0.35`, `bounce 0`) on the form's width — FR-002's "~0.35 s, no overshoot" is that token's definition |
| Backdrop | opacity over `motionDuration.fade` (200 ms); `.overlay-scrim` + `backdrop-blur-xl` (24 px, on-scale, within FR-002's ≈20 px) |
| Panel | opacity over `motionDuration.fade`. **Never** animates size or position (FR-014, SC-008) |
| Reduced motion | `MotionConfig reducedMotion="user"` already drops the transform; `usePrefersReducedMotion` additionally drops the fade → instant change. Backdrop, focus and announcements unchanged (FR-009) |
| Reduced transparency / increased contrast | inherited from `.overlay-scrim`'s existing media-query blocks — **no new CSS** |
| Press feedback | the existing `pressable` |
| Skeleton | `bg-stone-200 dark:bg-surface-raised animate-pulse rounded-md`, mirroring a real row's shape and height (Constitution "Skeleton loading states") |
| Surface | the existing `<Card>`; `shadow-lg` as a floating element |
| Palette | stone + `--color-surface` tokens; the kind label is text, never colour alone |

## 8. Contrast (FR-025, SC-007 — 4.5:1 text, 3:1 large text and control boundaries, both themes)

The panel is an **opaque** `Card`, so every text pairing in it is the app's existing card pairing and needs no recomputation. Only two surfaces are new:

| Pairing | Floor |
|---|---|
| Field text / field background while expanded over the backdrop | 4.5:1 |
| Field and panel border against the scrim behind them | 3:1 |

Asserted by `e2e/helpers/contrast.ts` in light and dark, at 375 px and 1440 px, in all five panel states.
