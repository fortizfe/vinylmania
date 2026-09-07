/**
 * Domain types for the "Escúchalo en Streaming" feature.
 *
 * Pure type declarations only — no runtime code, no infrastructure SDK imports.
 * Domain layer (dependencies point inward).
 */

/**
 * Identifier for a supported streaming platform.
 *
 * Currently the only resolvable platform is Apple Music. Future members
 * (`'spotify' | 'amazon_music' | 'deezer' | 'tidal'`) are out of scope for this
 * feature — adding one later adds a member here plus a resolver, nothing else in
 * the domain/application layer changes.
 */
export type StreamingPlatform = 'apple_music';

/**
 * A streaming storefront / country code.
 *
 * ISO-3166-1 alpha-2, uppercase (e.g. `'ES'`, `'US'`, `'GB'`). Derived per
 * request from locale; fallback `'ES'`.
 */
export type Storefront = string;

/**
 * Input to a resolver for one record + one storefront.
 */
export interface StreamingLinkQuery {
  /**
   * Raw barcode identifier values from Discogs. May be empty (masters, older
   * releases). Normalised (digits only) inside the adapter.
   */
  barcodes: string[];
  /** Primary artist display name. Required (query disabled without it). */
  artist: string;
  /** Release/master title. Required. */
  title: string;
  /** Which store to resolve against. */
  storefront: Storefront;
}

/**
 * One successful match. Also the on-the-wire item shape.
 */
export interface ResolvedStreamingLink {
  platform: StreamingPlatform;
  /** Absolute `https://` album page. The link target. */
  url: string;
}

/**
 * Use-case output / response body. Zero or more links, one per platform that
 * produced a reliable match. Empty array is valid and common.
 */
export interface StreamingLinksResult {
  links: ResolvedStreamingLink[];
}
