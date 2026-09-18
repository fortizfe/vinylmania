# Data Model: Over-engineering Audit Cleanup

This feature adds, changes or removes no entities, persisted data, API payloads or stored fields (spec FR-008).

The only shape it touches is an internal frontend type:

- **CatalogFilters**: the optional `genre`, `style` and `format` fields, each a list of strings. The current `LibraryFilters` and `SearchFilters` already have exactly this shape and become aliases of it.
  - **Validation (unchanged):** each value must belong to its fixed catalog, and values are re-ordered to the catalog's order. Unknown values are dropped, and an empty list means the filter is absent.
