import { authorizedFetch } from './apiClient';

/**
 * One resolved streaming-platform link for a record.
 *
 * The `platform` union is intentionally narrow: Apple Music is the only
 * platform resolved in this version. It widens (`'apple_music' | 'spotify' |
 * …`) as new server-side resolvers land — see
 * `specs/062-streaming-platform-links/data-model.md`.
 */
export interface StreamingLink {
  platform: 'apple_music';
  url: string;
}

export interface StreamingLinksResponse {
  links: StreamingLink[];
}

export interface StreamingLinksInput {
  /** Raw `Barcode`-type identifier values from Discogs; may be empty. */
  barcodes: string[];
  /** Primary artist display name. Required by the endpoint. */
  artist: string;
  /** Release or master title. Required by the endpoint. */
  title: string;
  /** BCP-47 tag from the browser (`navigator.language`), e.g. `es-ES`. */
  locale: string;
}

export async function getStreamingLinks(
  input: StreamingLinksInput,
): Promise<StreamingLinksResponse> {
  const params = new URLSearchParams({
    artist: input.artist,
    title: input.title,
    locale: input.locale,
  });
  for (const barcode of input.barcodes) {
    params.append('barcode', barcode);
  }
  const res = await authorizedFetch(`/api/streaming/links?${params.toString()}`);
  return res.json();
}
