# Contract: `ReleaseImageGallery` component (amendment)

This feature does not change `ReleaseImageGallery`'s **public props** — all
three consuming pages require zero prop-level changes. It changes one class
on the existing root element. This document amends
`specs/043-gallery-fullscreen-viewer/contracts/ReleaseImageGallery.contract.md`
with the single delta introduced here; that document remains the full DOM
contract for everything else (fullscreen viewer, thumbnail strip, no-image
placeholder — all unchanged by this feature).

## Props (unchanged)

```ts
interface ReleaseImageGalleryProps {
  images: CatalogImage[];
  alt: string;
}
```

## DOM contract delta

- Root element (`mx-auto flex aspect-square gap-3 lg:max-w-md`) gains
  `overflow-hidden`, applied unconditionally at every breakpoint
  (research.md Decision 1). This is the only class change in this feature.
- No other element, testid, prop, or behavior changes.

## Consumers

- `frontend/src/pages/ReleaseDetailPage.tsx`,
  `frontend/src/pages/RecordDetailPage.tsx`,
  `frontend/src/pages/MasterReleaseDetailPage.tsx` — no prop changes; they
  automatically inherit the fix (same shared component).
- `frontend/tests/unit/ReleaseImageGallery.test.tsx` — extended with an
  assertion that the root container's className includes `overflow-hidden`.
- `e2e/tests/release-detail-responsive.spec.ts`,
  `e2e/tests/master-release-detail-responsive.spec.ts`,
  `e2e/tests/record-detail-responsive.spec.ts` — each gains a "more than 4
  images" containment case, run under both the existing `chromium` project
  and the new `webkit` project (research.md Decision 2); the existing
  ≤12-image containment tests are generalized to run under both projects
  too, since the underlying bug is engine-specific and content-count
  dependent (not previously exercised on the engine where it reproduces).

## Backward compatibility

Purely additive/behavioral fix (Principle VI: PATCH — bug fix, no contract
change). No prop, testid, or exported type is removed, renamed, or added.
