export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist';
  title: string;
  artist?: string;
  thumbnailUrl?: string;
  year?: number;
  formats?: string[];
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
