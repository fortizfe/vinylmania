import type { Release } from '../discogsCatalog/types';

/**
 * The normalized projection of one element of the Discogs `wants` array
 * (`GET /users/{username}/wants`). Produced by `discogsWantlistAdapter`,
 * consumed by the `wantlist` application layer. Never persisted locally —
 * the user's Discogs wantlist is the sole system of record (feature 060).
 */
export interface WantItem {
  /** Discogs `id` (== `basic_information.id`). The wantlist key. */
  releaseId: number;
  /** `0..5` integer; `0` = unrated. Personal, per-entry. */
  rating: number;
  /** Free text; `null`/`''` normalized to `null`. */
  notes: string | null;
  /** ISO-8601, from `date_added`. Used for newest-first ordering. */
  dateAdded: string;
  /** Fallback label data when catalog enrichment fails. */
  basicInformation: {
    title: string;
    year: number | null;
    artists: { name: string }[];
    thumb: string | null;
  };
}

/**
 * What `/api/wantlist` returns per entry: a {@link WantItem} joined with
 * catalog data. The card badge is derived from `release.community.rating`
 * (the community rating); the personal `rating` is rendered separately.
 */
export interface EnrichedWantEntry {
  discogsReleaseId: number;
  /** Personal rating, `0..5`. Mirrors {@link WantItem.rating}. */
  rating: number;
  notes: string | null;
  /** ISO-8601, from {@link WantItem.dateAdded}. */
  addedAt: string;
  /** `'unavailable'` when the per-release catalog lookup failed. */
  catalogStatus: 'ok' | 'unavailable';
  /** Full catalog release; `null` when `catalogStatus === 'unavailable'`. */
  release: Release | null;
}

/**
 * Single-entry response for the release detail page's wantlist panel
 * (`GET /api/wantlist/:releaseId`). No catalog enrichment — the detail page
 * already loaded the `Release` from the catalog endpoint.
 */
export interface WantEntryDetail {
  discogsReleaseId: number;
  rating: number;
  notes: string | null;
  addedAt: string;
}

/**
 * `PATCH /api/wantlist/:releaseId` body — one field per call (per-field
 * autosave, FR-009). Maps to `PUT /users/{username}/wants/{releaseId}` with
 * only the provided field.
 */
export interface UpdateWantEntryPatch {
  /** integer `0..5` (`0` clears the rating) */
  rating?: number;
  /** any string (`''` clears the note) */
  notes?: string;
}

/**
 * `POST /api/wantlist` (201) response — an {@link EnrichedWantEntry} plus two
 * advisory flags. The library is never modified by the add path (FR-007a).
 */
export interface AddToWantlistResult extends EnrichedWantEntry {
  /** `true` when the release was already a want before this call (FR-007). */
  alreadyInWantlist: boolean;
  /** `true` when the caller already owns this release (FR-007a). */
  alreadyInLibrary: boolean;
}
