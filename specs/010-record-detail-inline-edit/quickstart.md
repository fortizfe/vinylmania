# Quickstart: Validating the Record Detail Redesign

## Prerequisites

- Frontend dev server running: `cd frontend && npm run dev`
- Backend + Firebase emulator running (per existing project setup) so
  `libraryApi.getOne`/`update` resolve against real data, or run against the
  existing Vitest/RTL mocks for component-level checks.
- At least one record already added to the signed-in user's library (via the
  existing "Add record" flow) so a detail page can be opened.

## Validation Scenarios

### 1. Four blocks, correct stacked order on a narrow viewport (User Story 2)

1. Open a record's detail page (`/app/library/records/:entryId`) with the
   browser window narrowed to a phone width (e.g., ~375px, or use browser
   devtools device toolbar).
2. Scroll top to bottom.

**Expected outcome**: Blocks appear in this order: header image, disc
information (title/artist/year/format/genre), my copy (condition/notes),
tracklist. No two-column layout is visible.

### 2. Two-column layout on a wide viewport (User Story 2)

1. Open the same detail page with the window widened past the layout's
   breakpoint (e.g., ~1200px).

**Expected outcome**: The header image spans the full width at the top. Below
it, the left column shows disc information followed by my copy; the right
column shows the full tracklist.

### 3. Fluid transition while resizing (User Story 2)

1. With the detail page open, slowly drag the browser window's width from
   narrow to wide (or use devtools' responsive resize handle) across the
   breakpoint.

**Expected outcome**: The layout switches once, at the breakpoint, with no
visible content jump, overlap, or unreadable intermediate state at any width
on either side of that point (SC-004).

### 4. Inline edit + autosave on desktop (User Story 1)

1. On a pointer-device viewport, hover over the condition value in the my-copy
   block.
2. Observe a subtle hover affordance, then click it.
3. Select a different condition from the dropdown that appears in place.
4. Click elsewhere on the page (blur the field).

**Expected outcome**: No "Edit"/"Save" button is ever shown. The field
switches to an editable control in place on click, saves automatically on
blur, shows a brief success confirmation, and then returns to read mode
displaying the new value. Reloading the page confirms the value persisted.

### 5. Inline edit + autosave on touch/mobile (User Story 1)

1. On a touch-emulated viewport (devtools mobile emulation or a real device),
   observe the notes field in read mode.

**Expected outcome**: The field shows a permanent visual cue that it's
editable (no hover needed to discover it). Tapping it turns it into a text
area; typing and then tapping outside the field (or confirming via the
on-screen keyboard) autosaves it, with the same success confirmation as
desktop.

### 6. Escape cancels without saving (User Story 1)

1. Click the notes field to start editing.
2. Type a different value.
3. Press Escape before clicking/tapping away.

**Expected outcome**: The field reverts to its previous value and no network
request updates that field's stored value (verify via reload or by checking
no unexpected request in devtools' network tab).

### 7. Only one field editable at a time (Edge Case / FR-017)

1. Click the condition field to start editing.
2. Without confirming, click the notes field.

**Expected outcome**: The condition field resolves (saves its current
selection) before the notes field becomes editable — at no point are both
fields simultaneously in edit mode.

### 8. Read-only disc information (User Story 3)

1. Open a record with multiple artists, multiple format descriptors, and
   multiple genres.

**Expected outcome**: All credited artists, all format descriptors, and all
genres are shown (not just the first of each); none of these fields offer any
click-to-edit affordance (they remain plain read-only text, per FR-006).

### 9. Missing data handled gracefully (Edge Cases)

1. Open a record with no cover image, and/or no year on file, and/or an empty
   tracklist.

**Expected outcome**: Missing year is simply omitted (no blank line or "N/A"
placeholder unless intentionally designed as such); missing image shows a
clear placeholder graphic, not a broken image icon; an empty tracklist shows
an explicit "no tracklist available" message rather than an empty list.

## Automated Coverage to Run

```bash
# Component/unit + existing integration tests
cd frontend && npm test

# End-to-end (Playwright + Firebase emulators), per the constitution's
# /frontend e2e quality gate
cd e2e && npm test
```

**Expected outcome**: All existing tests continue to pass; new tests added for
this feature (InlineEditableField unit tests, updated
`recordDetailFlow.test.tsx`, new `e2e/tests/record-detail-inline-edit.spec.ts`)
pass as well.
