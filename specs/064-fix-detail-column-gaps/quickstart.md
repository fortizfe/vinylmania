# Quickstart: Validate the two-column gap fix

Prerequisites: `frontend/` deps installed (`npm install` inside
`frontend/`); a signed-in fake Google session for the e2e flows (existing
`e2e/helpers/fakeGoogleSignIn.ts` fixture — no manual setup needed).

## 1. Automated validation

```sh
# Frontend unit/component tests (Vitest + RTL)
cd frontend && npm run test -- DetailColumns RecordDetailPage ReleaseDetailPage MasterReleaseDetailPage StreamingLinksSection

# e2e responsive/composition tests (Playwright)
cd e2e && npx playwright test record-detail-responsive release-detail-responsive master-release-detail-responsive
```

Expected outcome: all green, including the new/updated assertions that
(a) tracklist/additional-info/versions-table render in the same column as
the gallery card, independent of the opposite column's height, and (b) no
gap appears within a column when the opposite column is much taller or
much shorter (research.md Decision 8).

## 2. Manual validation — the actual reported bug

1. Run `cd frontend && npm run dev` and `cd backend && npm run dev` (or the
   project's usual local dev flow).
2. Open a release detail page for a record with a **short** "Your Copy" /
   wantlist state (no rating, no notes) and a **long** tracklist, at a
   viewport ≥1024px wide (`/app/library/records/:entryId`,
   `/app/releases/:discogsId`, or `/app/masters/:discogsId`).
3. Confirm: no visible gap between the bottom of the shorter column's last
   card and the top of the next card in *that same column* — even though
   the two columns end at clearly different heights.
4. Resize the window continuously from ~1023px to ~1281px and back.
   Confirm no card jumps, overlaps, or briefly shows a gap during the
   transition (spec SC-002).
5. Narrow the window below 1024px. Confirm the page still renders as a
   single column with no horizontal scroll, and note the (intentionally
   changed, per Clarifications) card order: Gallery → Tracklist →
   Additional info/Versions → Main info → Your Copy/Wantlist → Streaming.
6. Repeat steps 2–5 for the other two/three detail surfaces (search result,
   library, wishlist, and master release) to confirm SC-004.

## 3. Accessibility regression check

The existing per-page axe scans (`record-detail-responsive.spec.ts`,
`release-detail-responsive.spec.ts`, `master-release-detail-responsive.spec.ts`
— "WCAG 2.1 AA automated scan" describe blocks) must still report zero
serious/critical violations, confirming the reordered mobile DOM (research.md
Decision 5) does not break heading structure, landmark order, or focus
order (Constitution Principle X).
