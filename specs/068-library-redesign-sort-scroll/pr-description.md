# feat(068): "My Library" redesign — sorting, infinite scroll, WCAG 2.1 AA & Apple HIG

Redesigns `/app/library` around three capabilities: a global sort, continuous loading, and a
controls bar that works with a thumb on a phone and with a mouse on a wide screen. Filters,
the grid/list toggle and its stored preference, Refresh, the Discogs link gate and the empty
states all keep working.

Spec artifacts: [`specs/068-library-redesign-sort-scroll/`](specs/068-library-redesign-sort-scroll/)
(spec, plan, research D1–D22, data model, contracts, quickstart, tasks, implementation notes).

## What changed

**Sorting (US1)** — six orders: date added (newest/oldest, newest is the default), artist and
album (A→Z / Z→A). The order is computed over the whole matching library before it is sliced
into batches, so every batch continues the same sequence. Comparison folds case and accents
together (`Intl.Collator` with English collation — see the `ponytail:` marker for the ceiling on
alphabets with extra base letters), ignores one leading article ("The Clash" sorts under C),
puts records without the field last, and ends every tie on the record id.
The order lives in the URL, so a link restores it exactly.

**Infinite scroll (US2)** — Previous/Next are gone. The next 20 records load about 300 px before
the end, placeholders hold the exact space so nothing shifts, the end of the list reports the
total, and a failed batch keeps what is on screen behind a Retry alert. Record links carry the
library address, so Back returns to the same sort and filters.

**Toolbar (US3)** — one bar element restyled by breakpoint: a floating translucent capsule 16 px
above the bottom edge below 640 px, opening a drag-dismissible bottom sheet; a sticky translucent
toolbar under the app header above it, with a native grouped `<select>` and a side drawer for
filters. On Library only, filters apply on each tick with no Apply button; Search is unchanged.
The header shows the record count and Refresh.

**Accessibility (US4)** — the view-mode track became opaque so the active pill clears 3:1 over the
capsule (it measured **2.49:1** before, **3.12:1** now; 6.29:1 in light). `.chrome-material`
degrades to an opaque, bordered surface when `backdrop-filter` is unsupported, transparency is
reduced, or higher contrast is requested.

## API and data changes (additive, MINOR)

- `GET /api/library` accepts `sort` (`added|artist|album`) and `dir` (`asc|desc`). Unknown values
  fall back to the defaults silently — never a 400, matching how filters already behave. Each item
  gains `title`. See `contracts/library-list-api.md`.
- The success log's `meta` now carries `sort`, `dir`, `page` and `totalItems`.
- Internally the listing collapsed to a single path (read the mirror → filter → sort → slice) and
  `repository.listEntries` was removed from the port and the Firestore adapter.

**Documented deviation from "Additional Constraints: reversible migration script"**: the new
Firestore `title` field ships without a migration script. It is additive and optional, written by
the existing Discogs collection sync (which is the backfill), absent means "missing, sorts last",
and rollback is simply ignoring the field — no reader breaks. Precedent: features 038
(`genre/style/format`) and 061 (`year/label/primaryArtist`). Recorded in the plan's Constitution
Check.

No `version` or CHANGELOG file was hand-edited; the `feat(068)` commits let CI derive the MINOR bump.

## Verification

| Gate | Result |
|---|---|
| Backend (`npm test`, full Jest + Firebase emulator) | 910/910 |
| Frontend (`npm test`) | 981/981 |
| Frontend `lint` + `build` | clean |
| E2E (`npm test`, chromium + webkit) | 456 passed, 0 failed, 2 pre-existing `fixme` |
| Cumulative layout shift while scrolling (SC-001) | **0** in grid and list |
| Reorder paint (SC-002, budget 100 ms) | **7.3 ms** |
| axe matrix (SC-003): light/dark × 390/1280 × loading, loaded, end, error, panel open | 0 violations |
| Keyboard-only walk (SC-004) | passes, no trap, focus ring at every step |
| Touch targets at 390 px (SC-005) | all ≥ 44×44 |

Bundle: +2.9 kB gzip, no new dependency.

Test-first is auditable per story (`test(068)` commits precede each `feat(068)` for US2–US4;
US1's red state is recorded in the implementation notes, as per-phase commits only started at US2).
The TDD audit (T071) passed, with that evidence gap stated explicitly.

## Checked by hand

Verified automatically in T070: article and diacritic sorting through the real comparator, rotation
across 640 px with the sheet open (closes, keeps sort/filters/records), the no-`backdrop-filter`
fallback (opaque, 17.49:1 light / 18.00:1 dark), `prefers-contrast: more`, and
`prefers-reduced-transparency` via CDP.

Still needs a human with macOS System Settings (~3 min, steps in the implementation notes):
Accessibility → Display → **Reduce transparency** makes the bar flat solid, and **Increase contrast**
adds a 1 px outline. Record browser and version with the result.

## Open decision

Live sort and filter changes **replace** the URL rather than pushing a history entry, so ticking
five filters does not add five Back steps — at the cost of Back not walking earlier filter states.
Flagged as pending in `data-model.md` §5 and `contracts/library-ui.md` §1; switching means changing
only the page's `navigate` calls and their two flow tests.

## Known, out of scope

- The facet checkbox's `<input>` is 16 px inside a 44 px row; `Checkbox` is shared with Search, so
  widening the target belongs to its own change.
- `backend` lint fails on 5 pre-existing `no-require-imports` errors in
  `tests/unit/rateLimit/rateLimitStore.test.ts` (stale `eslint-disable` rule name after a
  typescript-eslint v8 rename; CI runs no backend lint step). Untouched here.
- `SelectableListFilter` still never passes `position` to `Modal`, so the mobile Search facet stays
  centred instead of full-screen (spec 042's `test.fixme`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
