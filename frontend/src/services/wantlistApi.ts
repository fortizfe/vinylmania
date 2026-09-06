import { authorizedFetch } from './apiClient';
import type { Release } from './libraryApi';

/** One enriched wantlist entry as returned by `GET /api/wantlist`. */
export interface EnrichedWantEntry {
  discogsReleaseId: number;
  /** Personal rating, 0..5. 0 means unrated. */
  rating: number;
  notes: string | null;
  addedAt: string;
  catalogStatus: 'ok' | 'unavailable';
  /** Full catalog release; `null` when `catalogStatus === 'unavailable'`. */
  release: Release | null;
}

/** Single-entry response for the release detail page's wantlist panel. */
export interface WantEntryDetail {
  discogsReleaseId: number;
  rating: number;
  notes: string | null;
  addedAt: string;
}

/** `POST /api/wantlist` (201) response — an entry plus two reconciliation flags. */
export interface AddToWantlistResult extends EnrichedWantEntry {
  /** `true` when the release was already a want before this call (idempotent add). */
  alreadyInWantlist: boolean;
  /** `true` when the caller already owns this release. The library is not modified. */
  alreadyInLibrary: boolean;
}

/** `PATCH /api/wantlist/:releaseId` body — one field per call (per-field autosave). */
export interface UpdateWantEntryPatch {
  /** Integer 0..5; 0 clears the rating. */
  rating?: number;
  /** Any string; `''` clears the note. */
  notes?: string;
}

export interface PaginatedWantlist {
  items: EnrichedWantEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
}

export async function list(
  page = 1,
  pageSize = 20,
  refresh = false,
): Promise<PaginatedWantlist> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (refresh) {
    params.set('refresh', 'true');
  }
  const res = await authorizedFetch(`/api/wantlist?${params.toString()}`);
  return res.json();
}

export async function getOne(releaseId: number): Promise<WantEntryDetail> {
  const res = await authorizedFetch(`/api/wantlist/${releaseId}`);
  return res.json();
}

export async function add(discogsReleaseId: number): Promise<AddToWantlistResult> {
  const res = await authorizedFetch('/api/wantlist', {
    method: 'POST',
    body: JSON.stringify({ discogsReleaseId }),
  });
  return res.json();
}

export async function update(
  releaseId: number,
  patch: UpdateWantEntryPatch,
): Promise<WantEntryDetail> {
  const res = await authorizedFetch(`/api/wantlist/${releaseId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function remove(releaseId: number): Promise<void> {
  await authorizedFetch(`/api/wantlist/${releaseId}`, { method: 'DELETE' });
}
