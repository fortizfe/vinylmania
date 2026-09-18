# Data Model: Corregir huecos entre tarjetas en el layout de dos columnas del detalle de release

Not applicable. This feature is a pure frontend layout/CSS fix: it does not
add, remove, or change any domain entity, Firestore document shape,
Discogs-derived data shape, or API contract. No new component state or
props are introduced beyond the new `DetailColumns` layout component's
`{ left, right }` props, which carry pre-existing `ReactNode` card markup
— see [`contracts/DetailColumns.contract.md`](./contracts/DetailColumns.contract.md)
for the full shape/behavior contract.
