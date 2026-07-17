export interface CommunityRating {
  average: number;
  count: number;
}

export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist' | 'master';
  title: string;
  artist?: string;
  thumbnailUrl?: string;
  year?: number;
  formats?: string[];
  /** Additive enrichment (feature 017); present only when a valid, votable rating exists. */
  communityRating?: CommunityRating;
  /** Additive enrichment (feature 052); present when Discogs provides a value. */
  country?: string;
  /** Additive enrichment (feature 052); present when Discogs provides at least one label. */
  labels?: string[];
}

export interface CatalogSearchResponse {
  results: CatalogSearchResult[];
  pagination: {
    page: number;
    pages: number;
    items: number;
    perPage: number;
  };
}

export interface ReleaseArtistCredit {
  discogsArtistId: number;
  name: string;
  nameVariation?: string;
  joinPhrase?: string;
}

export interface Track {
  position: string;
  title: string;
  duration?: string;
}

export interface LabelCredit {
  discogsLabelId: number;
  name: string;
  catalogNumber?: string;
}

export interface FormatDescriptor {
  name: string;
  quantity?: number;
  descriptions: string[];
}

export interface CatalogImage {
  url: string;
  imageType: 'primary' | 'secondary';
  width?: number;
  height?: number;
}

export interface ReleaseIdentifier {
  type: string;
  value: string;
  description?: string;
}

export interface CommunityStats {
  have: number;
  want: number;
  rating: {
    average: number;
    count: number;
  };
}

export interface Release {
  discogsId: number;
  title: string;
  year?: number;
  country?: string;
  releaseDate?: string;
  notes?: string;
  artists: ReleaseArtistCredit[];
  labels: LabelCredit[];
  formats: FormatDescriptor[];
  genres: string[];
  styles: string[];
  identifiers: ReleaseIdentifier[];
  community?: CommunityStats;
  tracklist: Track[];
  images: CatalogImage[];
  masterId?: number;
  discogsUrl: string;
}

/** A Discogs master release group (feature 026, US3) — see data-model.md. */
export interface MasterRelease {
  discogsId: number;
  title: string;
  year?: number;
  artists: ReleaseArtistCredit[];
  genres: string[];
  styles: string[];
  images: CatalogImage[];
  tracklist: Track[];
  mainReleaseId: number;
  discogsUrl: string;
}

/** One row of a master's paginated version list (feature 026, US3). */
export interface MasterReleaseVersion {
  discogsId: number;
  title: string;
  format?: string;
  year?: number;
  label?: string;
  country?: string;
  thumbnailUrl?: string;
}

export interface MasterReleaseVersionsPage {
  results: MasterReleaseVersion[];
  pagination: {
    page: number;
    pages: number;
    items: number;
    perPage: number;
  };
}

export interface ArtistAliasRef {
  discogsArtistId: number;
  name: string;
}

export interface Artist {
  discogsId: number;
  name: string;
  realName?: string;
  profile?: string;
  nameVariations: string[];
  aliases: ArtistAliasRef[];
  images: CatalogImage[];
  discogsUrl: string;
}
