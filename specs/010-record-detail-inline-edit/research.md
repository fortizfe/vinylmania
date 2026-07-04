# Phase 0 Research: Record Detail View Redesign with Inline Editing

No `NEEDS CLARIFICATION` markers remain in the spec. This research confirms the
current implementation's capabilities (so the plan doesn't duplicate existing
work) and resolves the technical approach for the two behavioral requirements
that need a concrete mechanism: the fluid responsive layout and the inline
autosave fields.

## Finding: All catalog fields needed already exist — no backend change required

- **Decision**: Implement this feature entirely in `frontend/`; make no changes
  to `backend/src/discogs/` or `backend/src/library/`.
- **Rationale**: Reading `backend/src/discogs/types.ts` and
  `frontend/src/services/libraryApi.ts` shows the `Release` type already has
  `title`, `year?`, `artists: ReleaseArtistCredit[]`, `formats:
  FormatDescriptor[]`, `genres: string[]`, `images: CatalogImage[]`, and
  `tracklist: Track[]` — sourced verbatim from the Discogs release API
  (`backend/src/discogs/discogsMapper.ts`, confirmed against the contract test
  fixture `backend/tests/contract/discogsRelease.contract.test.ts`). "Format"
  and "genre" were flagged in the feature request as possibly missing, but
  they are already present as arrays (a release can have multiple format
  descriptors or genre tags).
- **Alternatives considered**: Adding a flattened `artist`/`format`/`genre`
  string field to the backend `Release` type for convenience (rejected — would
  duplicate `artists[]`/`formats[]`/`genres[]` and violate Principle III/YAGNI;
  the frontend can join/format these arrays for display without a backend
  change).

## Finding: The update endpoint already supports independent per-field autosave

- **Decision**: Call the existing `libraryApi.update(entryId, condition,
  notes)` once per field save, passing only the field being edited and leaving
  the other `undefined`.
- **Rationale**: `frontend/src/services/libraryApi.ts`'s `update()` calls
  `PATCH /api/library/:id` with `JSON.stringify({ condition, notes })`;
  `JSON.stringify` omits `undefined` values, and
  `backend/src/library/libraryService.ts` only applies a field when
  `input.condition !== undefined` / `input.notes !== undefined`. So
  `update(entryId, newCondition, undefined)` already updates only `condition`
  without touching `notes`, and vice versa — exactly what per-field autosave
  needs (FR-011, FR-017: only one field editable/saving at a time).
- **Alternatives considered**: A new batched "save both fields" endpoint
  (rejected — unnecessary, the spec requires independent per-field saves, and
  the existing partial-update contract already supports that); adding a new
  `PUT` per-field endpoint (rejected — no behavior gap to justify a new
  contract).

## Decision: Responsive layout mechanism

- **Decision**: Use Tailwind v4's default responsive breakpoints
  (`frontend/src/styles/global.css` defines no custom `--breakpoint-*`
  overrides, so defaults apply: `sm` 40rem/640px, `md` 48rem/768px, `lg`
  64rem/1024px). Structure the page as a CSS Grid: a single-column stack by
  default, switching to `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` (or
  equivalent two-column grid) with the image block spanning both columns via
  `lg:col-span-2` at the top. Order via source order + `lg:` column-placement
  utilities so the DOM order (image → info → my-copy → tracklist, matching the
  stacked/mobile order in FR-002) still renders correctly once columns split
  per FR-003.
- **Rationale**: This page (`RecordDetailPage`) is rendered under
  `AuthenticatedLayout`, which only adds a top `AppHeader` — there is no
  resizable sidebar or nested container that would make the page's own width
  diverge from the viewport width. A plain viewport-width media query (which
  is what Tailwind's `lg:` prefix compiles to) therefore already satisfies
  FR-004 ("driven by available horizontal space... not device-type detection
  alone"): the browser recalculates the applicable breakpoint continuously as
  the window is resized, with no JavaScript device/UA branching involved.
- **Alternatives considered**: CSS container queries (`@container`) via
  Tailwind v4's container-query utilities (rejected as unnecessary complexity
  for this page specifically, since its width already tracks the viewport
  1:1 — container queries earn their complexity when a component's width is
  independent of the viewport, e.g. inside a resizable sidebar, which doesn't
  apply here per Principle III/YAGNI); a JS `matchMedia`/`ResizeObserver`
  hook to toggle layout in JS (rejected — CSS Grid + Tailwind responsive
  utilities alone achieve the same reflow with less code and no re-render
  cost, consistent with Principle III).

## Decision: Inline editable field mechanism

- **Decision**: Build one reusable `InlineEditableField` component (used by
  both condition and notes) with three visual states — `read`, `editing`,
  `saved` (transient) — plus an `error` state per FR-016:
  - `read`: renders the value as text; on `onClick`/`onTouchStart` switches to
    `editing`. Tailwind classes provide a `hover:` affordance on pointer
    devices and an always-on subtle style (e.g., a dashed underline or
    faint background) via a `(hover: none)` media feature check so touch
    devices get the permanent affordance without JS device sniffing (Tailwind
    v4 exposes pointer/hover media features as `pointer-fine:`/`pointer-coarse:`
    or a custom `@media (hover: hover)` variant may be added via `@theme`
    if not already covered — to confirm exact utility name during
    implementation, not a scope-changing decision).
  - `editing`: renders a `<select>` (condition, fixed options reused from the
    existing `CONDITION_OPTIONS` list) or `<textarea>` (notes, free text),
    autofocused on mount; `onBlur` triggers save-and-return-to-read;
    `onKeyDown` handles `Escape` (revert, no save) and `Enter`
    (confirm-and-blur, mainly relevant for the single-line condition control
    and mobile "Done"/"Go" keyboard action which fires a blur naturally).
  - `saved`: after a successful save, briefly shows a confirmation (e.g., a
    checkmark icon or a soft highlight) for ~1.5s via a `setTimeout`, then
    reverts to `read` — matching SC-... "brief, self-dismissing" requirement.
  - `error`: if the save request fails, keep the field in `editing` (retain
    the entered value per FR-016), show an inline error message below the
    control, and log the failure via `console.error` with `entryId`/field
    context (Principle V, Observability).
  - Only one instance is "active" (editing/saving) at a time: the parent
    (`RecordDetailPage`) holds which field key is currently active and passes
    a callback so starting to edit a new field first resolves (blurs/saves)
    the previous one (FR-017), rather than each field managing global state
    independently.
- **Rationale**: A single component parameterized by `value`,
  `renderEditor(value, onChange)`, and `onSave(value): Promise<void>` avoids
  duplicating the click→edit→blur→save→confirm state machine between
  condition and notes (Principle II, Library-First & Modularity; Principle
  IV, SOLID — one component, one state-machine responsibility, callers decide
  the editor UI and persistence).
- **Alternatives considered**: A form library (e.g., react-hook-form) for
  inline editing (rejected — massive overkill for two fields with no
  cross-field validation, violates Principle III/YAGNI); two separate
  bespoke components for condition and notes (rejected — duplicates the
  click/blur/Escape/confirm logic that is identical between them, violating
  DRY/Principle II).

## Decision: Test coverage approach

- **Decision**: Add Vitest + React Testing Library tests for
  `InlineEditableField` (click-to-edit, blur-saves, Escape-cancels, error
  state retains value) and extend the existing
  `frontend/tests/integration/recordDetailFlow.test.tsx` for the new block
  structure and one-field-at-a-time behavior. Add one new Playwright spec
  under `/e2e/tests/` exercising: open a record detail page, edit condition
  inline, confirm it persists after reload — satisfying the constitution's
  e2e quality gate for this `/frontend` change.
- **Rationale**: Matches Principle I (Test-First) and the constitution's e2e
  gate; follows the existing pattern in `e2e/tests/*.spec.ts` (Firebase
  emulator + Playwright, per `e2e/package.json`'s `test` script).
- **Alternatives considered**: Relying on unit/component tests alone
  (rejected — explicitly insufficient per the constitution's e2e gate for any
  `/frontend` PR, and per plan.md Constitution Check).
