# Data Model: Fix gaps in the two-column record detail layout

No persisted or transmitted data entities are introduced or changed by this feature — it is a client-side rendering/layout fix with no new fields, API contracts, or storage.

The only "model" involved is the in-memory, render-time shape consumed by the new layout hook (`useIndependentColumnLayout`, see `research.md` R3):

- **Column slot** (input, one per existing card): `{ ref: RefObject<HTMLElement>, column: 'rail' | 'content' }`. `column` mirrors the existing `railSlot`/`columnSlot` distinction already present in `RecordDetailLayout.tsx` and `RecordDetailSkeleton.tsx` — not a new concept, just made explicit to the hook.
- **Computed offset** (output, one per slot): `{ top: number, height: number }`, recalculated whenever a slot's observed height changes or the `lg` breakpoint is crossed. Never persisted — recomputed on every relevant render/resize.

This state is entirely ephemeral (component-local `useState`/`useRef`) and out of scope for the constitution's data-persistence principles (Firebase/Discogs, Principle II/VI) since nothing here is stored or sent over the network.
