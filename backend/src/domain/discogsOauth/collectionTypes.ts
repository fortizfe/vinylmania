/**
 * The user's copy of a release inside their Discogs collection — the source
 * of truth for per-copy data (rating, conditions, notes) per feature 016.
 * Never persisted locally; always fetched from / written to Discogs.
 */
export interface CollectionInstance {
  releaseId: number;
  instanceId: number;
  folderId: number;
  /** 0–5; 0 means unrated. */
  rating: number;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
  dateAdded: string;
  /**
   * Release facets carried on each collection row's `basic_information`
   * object (feature 061, data-model §2). Mapped from the same collection
   * walk the sync already performs — no extra request. Used by the sync
   * write-back (`year`/`label`/`primaryArtist` onto the `LibraryEntry`) and
   * by the valuation use case (title/artist for the per-disc breakdown).
   */
  year: number | null;
  labelNames: string[];
  artistNames: string[];
  genres: string[];
  styles: string[];
  title: string;
}

/** Coordinates every instance-level Discogs write needs. */
export interface InstanceRef {
  folderId: number;
  releaseId: number;
  instanceId: number;
}

/**
 * The user's collection note-field IDs, resolved by default field name from
 * GET /users/{username}/collection/fields. `null` means the user deleted
 * that field on discogs.com, so the matching control is not editable.
 */
export interface CollectionFieldMap {
  mediaConditionFieldId: number | null;
  sleeveConditionFieldId: number | null;
  notesFieldId: number | null;
}

/**
 * A pure key-naming function, deliberately kept outside either the
 * connection or collection adapter so both can depend on it without
 * ordering: `disconnectConnection` (linking-flow) invalidates it,
 * `getFieldMap` (collection) reads/writes it.
 */
export function fieldsCacheKey(uid: string): string {
  return `discogs:fields:${uid}`;
}
