# Contract: Frontend Query Hooks (`frontend/src/queries/`)

No REST API contracts change (same as backend — see `backend-cache-module.md`). The contract here is the **hook interface** that page components (`RecordDetailPage.tsx`, `LibraryListPage.tsx`, etc.) program against, replacing their current manual `useEffect`/`useState` fetch calls.

## `frontend/src/queries/libraryQueries.ts`

```ts
export const libraryKeys = {
  all: ['library'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...libraryKeys.lists(), page, pageSize] as const,
  details: () => [...libraryKeys.all, 'detail'] as const,
  detail: (entryId: string) => [...libraryKeys.details(), entryId] as const,
};

export function useLibraryList(page: number, pageSize: number): UseQueryResult<PaginatedLibraryEntries>;
export function useLibraryEntry(entryId: string | undefined): UseQueryResult<EnrichedLibraryEntry>;

export function useCreateLibraryEntry(): UseMutationResult<EnrichedLibraryEntry, ApiError, CreateLibraryEntryArgs>;
export function useUpdateLibraryEntry(entryId: string): UseMutationResult<EnrichedLibraryEntry, ApiError, UpdateLibraryEntryArgs>;
export function useRemoveLibraryEntry(): UseMutationResult<void, ApiError, string /* entryId */>;
```

**Behavior contract**:

- `useLibraryList`/`useLibraryEntry` call the existing `libraryApi.list`/`libraryApi.getOne` functions unchanged as their `queryFn`.
- Every mutation hook's `onSuccess` MUST invalidate at least `libraryKeys.all` (simplest, always-correct option) or, where cheap, the more targeted `libraryKeys.detail(entryId)` + `libraryKeys.lists()` — satisfying FR-004 (user's own edits are never stale).
- `useLibraryEntry(undefined)` MUST be disabled (`enabled: false`) rather than firing a request with an invalid id — mirrors the existing `if (!entryId) return;` guard in `RecordDetailPage.tsx`.

## `frontend/src/queries/discogsQueries.ts`

```ts
export const discogsKeys = {
  all: ['discogs'] as const,
  search: (query: string, type: 'release' | 'artist', page?: number, perPage?: number) =>
    [...discogsKeys.all, 'search', type, query, page, perPage] as const,
  release: (discogsId: number) => [...discogsKeys.all, 'release', discogsId] as const,
};

export function useCatalogSearch(query: string, type: 'release' | 'artist', page?: number, perPage?: number): UseQueryResult<CatalogSearchResponse>;
export function useCatalogRelease(discogsId: number | undefined): UseQueryResult<Release>;
```

**Behavior contract**:

- Wrap the existing `discogsApi.search`/`discogsApi.getRelease` functions unchanged as `queryFn`.
- `useCatalogSearch` MUST be disabled when `query` is empty (mirrors current search-page guard against empty-query requests).
- These are read-only; no corresponding mutation hooks (Discogs catalog data is never written by this app).

## Provider contract (`frontend/src/lib/queryClient.ts` + `main.tsx`)

```ts
export const queryClient: QueryClient; // single shared instance, default options per research.md §1
```

- `main.tsx` MUST wrap `<App />` in exactly one `<QueryClientProvider client={queryClient}>` for the whole app (no per-page providers).
- Test utilities MUST construct a fresh `QueryClient` per test (retries disabled) rather than reusing the app singleton, so tests don't leak cache state across cases.
