import type {
  Artist,
  CatalogCredential,
  CatalogSearchResponse,
  CommunityRating,
  MasterRelease,
  MasterReleaseVersionsPage,
  Release,
} from '../../domain/discogsCatalog/types';

export interface SearchCatalogOptions {
  resultType?: 'release' | 'artist';
  page?: number;
  perPage?: number;
  /** Free-text filter on genre (spec FR-002, feature 021). */
  genre?: string;
  /** Free-text filter on style (spec FR-002, feature 021). */
  style?: string;
  /** Filter on format; may be a single value or a comma-joined multi-value string (spec FR-002/FR-011, feature 021/022). */
  format?: string;
}

export interface DiscogsCatalogPort {
  getRelease(credential: CatalogCredential, discogsReleaseId: number): Promise<Release>;

  getArtist(credential: CatalogCredential, discogsArtistId: number): Promise<Artist>;

  /** A Discogs master release group's detail (feature 026, US3). */
  getMasterRelease(credential: CatalogCredential, masterId: number): Promise<MasterRelease>;

  /** One page of a master's version list, 10 per page by default. */
  getMasterReleaseVersions(
    credential: CatalogCredential,
    masterId: number,
    page?: number,
    perPage?: number,
  ): Promise<MasterReleaseVersionsPage>;

  /** One release's community rating; rejects if the lookup fails or exceeds its own short timeout. */
  getReleaseRating(credential: CatalogCredential, discogsReleaseId: number): Promise<CommunityRating>;

  /** Raw catalog search — no rating enrichment; see application/discogsCatalog/searchCatalogWithRatings.ts. */
  searchCatalog(
    credential: CatalogCredential,
    query: string,
    options?: SearchCatalogOptions,
  ): Promise<CatalogSearchResponse>;
}
