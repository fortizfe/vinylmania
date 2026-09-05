# Phase 1 Data Model: Apple HIG Component Polish

This feature has **no runtime/persisted data model** — it changes interaction, motion, depth, and typography of existing UI. The "entities" below are *design entities*: the shared definitions the implementation and the audit are organized around. They live as code (`frontend/src/motion/tokens.ts`, `frontend/src/styles/global.css`) and as documentation (`audit.md`), not in a database.

---

## 1. Motion Token

A single named motion definition referenced by every animated component. No component defines its own.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | e.g. `spring.default`, `--ease-out`, `--motion-duration-fade` |
| `kind` | `spring` \| `easing` \| `duration` | springs are JS objects; easings/durations are CSS custom properties + TS constants |
| `value` | object \| string | spring: `{ type:'spring', duration, bounce }`; easing: `cubic-bezier(...)`; duration: `<n>ms` |
| `reducedMotionValue` | string \| `null` | what it becomes under `prefers-reduced-motion` (`transform: none` / opacity-only / `0ms`) |
| `usedBy` | string[] | components/primitives that reference it (traceability for FR-006) |

**Validation rules**:
- Every animated component references a token by name — grep for inline `cubic-bezier(`, `transition: all`, `duration-[`, bare `ease`/`ease-in`/`linear` in `frontend/src/components/**` must return nothing new (FR-006).
- `bounce > 0` is allowed **only** for `spring.momentum` (momentum/flick interactions) — never for fade-in / non-gesture motion (apple-design §4).
- Every token has a defined `reducedMotionValue` (FR-005).

**Canonical set**: see research.md R2 (`--ease-out`, `--ease-in-out`, `--ease-drawer`, `--motion-duration-press|fade|collapse|drawer`, `spring.default|sheet|momentum`).

---

## 2. Interaction Pattern

A canonical behavior for a shared UI concept. Components implementing that concept MUST conform to exactly one pattern (FR-014).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `binary-switch`, `segmented-selector`, `multi-select-list`, `disclosure`, `dismissible-layer`, `pressable` |
| `semantics` | string | ARIA role(s) + keyboard model |
| `motionTokens` | string[] | which Motion Tokens it uses |
| `focusTreatment` | string | always the shared `focusRing` (`focus-visible:ring-2 ring-primary ring-offset-2`) |
| `affordance` | string | visual cue (knob, sliding pill, chevron, scrim+sheet, scale-on-press) |
| `conformingComponents` | string[] | every component that must match |
| `reducedMotionBehavior` | string | the non-vestibular equivalent |

**Validation rules**:
- No component implements a concept with a bespoke variant not listed here (audit surfaces violations: today `ThemeToggle` vs `ViewModeToggle` vs `StarRating` use three different idioms — `StarRating` is a rating input, legitimately distinct; the switch/selector split is kept, the *focus treatment* is unified).
- Every interactive component maps to `pressable` **plus** at most one higher-level pattern.

**Canonical set**: see research.md R9.

---

## 3. Elevation / Material Treatment

The depth treatment for a floating layer (FR-007), applied uniformly to all overlays.

| Field | Type | Notes |
|-------|------|-------|
| `layer` | `scrim` \| `surface` | scrim = the dimmed/blurred backdrop; surface = the opaque content card |
| `scrimBackground` | string | `bg-stone-950/60` (default), `/80` (no-backdrop-filter), `/95` (reduced-transparency) |
| `blur` | string | `backdrop-blur-md backdrop-saturate-150`; `none` under the fallbacks |
| `surfaceShadow` | string | `shadow-xl` (drawer) / `shadow-2xl` (center modal) — the constitution's "floating elements" tier |
| `enterMotion` | string | center: scale `0.96→1` + opacity + blur, `spring.default`, origin near trigger; drawer: slide on own axis, `--ease-drawer` / `spring.sheet` |
| `exitMotion` | string | mirror of enter on the **same path** (apple-design §7) |
| `fallbacks` | list | `@supports not (backdrop-filter)`, `prefers-reduced-transparency`, `prefers-contrast` |

**Validation rules**:
- Overlay text/controls never sit directly on the `scrim` — always on the opaque `surface` (keeps spec-058 contrast pairings valid; FR-009).
- Never stack two translucent surfaces (apple-design §12).
- `enterMotion` and `exitMotion` are inverses (spatial consistency).

**Consumers**: `Modal` (center + end), `GalleryFullscreenViewer`.

---

## 4. Component Audit Entry

One row per in-scope component in `audit.md` (FR-016). Produced during planning; every implementation task traces to a row (SC-002).

| Field | Type | Notes |
|-------|------|-------|
| `component` | string | path under `frontend/src/components/` |
| `disposition` | `conforms` \| `refine` \| `rework` | `conforms` = no change; `refine` = token/press/focus adjustments; `rework` = structural interaction change |
| `higPrinciples` | string[] | which HIG principle(s) it currently falls short on (Response, Direct manipulation, Interruptibility, Feedback, Depth/Materials, Spatial consistency, Typography, Consistency, Familiarity, Craft) |
| `skillConsulted` | string[] | `apple-design` / `emil-design-eng` / `animate` |
| `changes` | string | concise description of the proposed change |
| `story` | `US1`–`US5` \| `—` | which increment delivers it |
| `e2e` | string | the spec file that covers the change (new or extended) |

**Validation rules**:
- 100% of components in spec.md → Scope have exactly one row (SC-002).
- No implementation task exists without a matching `component` + `story` row.
- A `conforms` row still names the principle checked and the skill used (proof of the "MUST NOT be skipped because a change looks small" rule in Principle XI).

---

## Relationships

```text
Component Audit Entry ──references──> Interaction Pattern (the pattern it must conform to)
Component Audit Entry ──references──> Motion Token[]      (tokens its changes introduce)
Interaction Pattern  ──references──> Motion Token[]
Elevation Treatment  ──references──> Motion Token[]       (enter/exit motion)
Interaction Pattern "dismissible-layer" ──uses──> Elevation Treatment
```
