# Phase 1 Data Model: Responsive Header Navigation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Entities

None. Per the spec's Key Entities section, this feature introduces no new
data entities, fields, or persistence — it only changes how three
already-existing navigation destinations (Profile, My wishlist, My library)
are presented in the header based on viewport width.

## Shared configuration shape

The only "data" this feature adds is a static, in-memory UI configuration
list (not a persisted entity), extracted from `HamburgerMenu.tsx` into
`frontend/src/components/headerNavLinks.ts`:

| Field | Type | Notes |
|---|---|---|
| `key` | `'profile' \| 'wishlist' \| 'library'` | Used by `HeaderNavIcons` to select the matching icon |
| `label` | `string` | Accessible name / hamburger link text (e.g., "Profile", "My wishlist", "My library") |
| `to` | `string` | Route path (e.g., `/app/profile`, `/app/wishlist`, `/app/library`) — unchanged from current `HamburgerMenu` routes |

This list is consumed by both `HamburgerMenu` (existing) and the new
`HeaderNavIcons`, so the destinations, labels, and order stay identical
between the two presentations by construction (see research.md Decision 4).
