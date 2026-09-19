# UI Contract: Library screen (068)

Scope: `/app/library` and the record detail's return path. Everything here is asserted by Vitest/RTL or Playwright (see [quickstart.md](../quickstart.md)).

## 1. URL parameters

| Param | Values | Omitted when | Invalid → |
|---|---|---|---|
| `sort` | `added` \| `artist` \| `album` | sort is the default (`added` + `desc`) | `added` |
| `dir` | `asc` \| `desc` | same as above (both written together otherwise) | criterion default (`desc` for `added`, `asc` otherwise) |
| `genre`, `style`, `format` | comma-joined catalog values | none selected | unknown values dropped (existing `catalogFilterParams`) |
| `page` | — | always | ignored (legacy links) |

- The path is built by `buildLibraryPath(filters, sort)`. Changes are applied with `navigate(path, { replace: true })`; this default is **pending user confirmation** (see the decision note in tasks.md).
- Record links carry `state: { from: currentLibraryPath }`.
- `RecordDetailPage` returns to `state.from ?? '/app/library'` from every Back link, from its `backTo`, and after a successful delete.

## 2. Sort options (`frontend/src/constants/librarySortOptions.ts`)

| Group (optgroup / fieldset legend) | Label | `sort` | `dir` | Announcement |
|---|---|---|---|---|
| Date added | Newest first *(default)* | added | desc | "Sorted by date added, newest first." |
| Date added | Oldest first | added | asc | "Sorted by date added, oldest first." |
| Artist | Artist (A → Z) | artist | asc | "Sorted by artist, A to Z." |
| Artist | Artist (Z → A) | artist | desc | "Sorted by artist, Z to A." |
| Album | Album (A → Z) | album | asc | "Sorted by album, A to Z." |
| Album | Album (Z → A) | album | desc | "Sorted by album, Z to A." |

The arrow character is visual only. Announcements spell "A to Z" so screen readers don't read "right arrow".

## 3. Layout by viewport

| Region | < 640 px | ≥ 640 px |
|---|---|---|
| Header (in flow, opaque) | `h1` "Your library" (display face) · count "N records" · "Refresh" button | same |
| Controls (**one** bar element, restyled by breakpoint; `ViewModeToggle` mounted once) | floating capsule, fixed 16 px + safe area above the bottom: `ViewModeToggle` + "Sort & Filter" button | sticky toolbar under the app header, spanning the content width (`max-w-4xl`, `xl:max-w-7xl` from 1280 px): `ViewModeToggle` · label "Sort" + `<select>` · "Filters" button |
| Panel | bottom sheet (`Modal position="bottom"`), title "Sort & Filter": sort radios + live filters + "Clear all filters" | side drawer (`Modal position="end"`), title "Filters": live filters + "Clear all filters" |
| Content bottom padding | `--capsule-clearance` (6 rem + safe area) | `p-8` |

## 4. Accessible names, roles, states

| Element | Role (native first) | Accessible name | State exposed |
|---|---|---|---|
| View toggle | `radiogroup` › 2 × `radio` (existing) | "View mode" › "Grid view" / "List view" | `aria-checked` |
| Sort select | `combobox` (native `<select>`) + `group` per optgroup | "Sort" (visible `<label for>`) | selected option = value |
| Sort radios (sheet) | `group` (fieldset "Sort by") › 3 × `group` (fieldset per criterion) › `radio` × 2 | option label | `checked`; one `name`, arrow keys rove natively |
| "Sort & Filter" button | `button`, `aria-haspopup="dialog"` | "Sort & Filter" + badge text (e.g. "Sort & Filter, 2 active filters" via an sr-only suffix) | `aria-expanded` |
| "Filters" button | `button`, `aria-haspopup="dialog"` | "Filters" (+ same count suffix when > 0) | `aria-expanded` |
| Active-filter badge | text inside the button | number visible; "active filters" sr-only | never colour alone (a number) |
| Sheet / drawer | `dialog`, `aria-modal="true"` (existing Overlay) | `aria-labelledby` its title | focus trapped while open; Escape, scrim click, "Close" button and drag all dismiss; focus returns to the trigger |
| Facet disclosure | native `<details>` / `<summary>` | "Genre" / "Style" / "Format" + "(N selected)" | expanded (native) |
| Facet option | `checkbox` (existing `Checkbox`) | option value | `checked` |
| Style search | `textbox` (existing `Input`, sr-only label) | "Search style" | — |
| Clear all filters | `button` (text visible) | "Clear all filters" | `aria-disabled="true"` when none are active (stays focusable) |
| Record count | text | "N records" / "1 record" | — |
| Live announcer | `status` (sr-only `<p role="status">`), polite | — | see §5 |
| Next-batch failure | `alert` text + `button` "Retry" | "Retry" | — |
| End of list | text | "You've reached the end of your collection — N records" (`record` when N = 1) | — |
| Load sentinel | `div aria-hidden="true"` | — | — |

All interactive elements are ≥ 44 × 44 CSS px (`min-h-11 min-w-11`) and use the shared `focusRing` and `pressable`.

## 5. Announcements (polite, never move focus)

| Trigger (announced once the results render) | Text |
|---|---|
| Sort changed | the announcement in §2 |
| Filter toggled / cleared | "Showing N records." ("1 record", "No records match the active filters." for 0) |
| Next batch appended | "K more records loaded." |
| Next batch was the last | "K more records loaded. End of collection, N records." |
| First batch is also the last (single-batch result) | no end announcement: only the sort/filter row above if one applies; nothing on initial load. The visible end message still renders. |
| Initial page load | nothing |
| Several quick changes | exactly one announcement, for the latest selection, once its results render; an earlier selection's late response is neither shown nor announced |
| Batch failure | visible `role="alert"`: "Couldn't load more records. Please try again." |

## 6. Keyboard

- Tab order: header (Refresh) → toolbar/capsule controls → records (grid/list order) → end message/Retry.
- The sticky toolbar and the capsule never cover the focused element (`scroll-padding-top` / `scroll-padding-bottom` set while the page is mounted).
- Sheet/drawer: Tab and Shift+Tab cycle inside it; Escape closes it; focus returns to its trigger. Changing a sort or filter inside keeps focus on that control.
- The native `<select>` uses standard keyboard behaviour: arrows change the value and each change applies immediately.

## 7. Visual & motion tokens

- **Material** (toolbar + capsule): `bg-white/90 dark:bg-surface/90 backdrop-blur-xl backdrop-saturate-150` plus the `.chrome-material` fallbacks. Contrast table: research D17.
- **Sheet**: `spring.sheet` in and out on the Y axis. Drag uses `dismiss.*`, and a fling exit uses `spring.momentum`. Reduced motion follows the existing Overlay path: opacity only, no translation.
- **Press**: existing `pressable`. No other new motion (research D19).
