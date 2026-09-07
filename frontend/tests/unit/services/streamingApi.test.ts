import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStreamingLinks } from '../../../src/services/streamingApi';
import { ApiError } from '../../../src/services/apiClient';
import { clearSessionToken } from '../../../src/services/sessionStore';

const originalFetch = global.fetch;

function mockFetchOnce(response: Partial<Response> & { json: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  const [url] = fetchMock.mock.calls[0] as [string];
  // API_BASE_URL is '' in tests, so the path is relative — resolve it for parsing.
  return new URL(url, 'http://localhost');
}

describe('getStreamingLinks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearSessionToken();
  });

  it('builds /api/streaming/links with a repeated barcode param per barcode, plus artist, title and locale', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({ links: [] }) });

    await getStreamingLinks({
      barcodes: ['0075596060721', '075596060721'],
      artist: 'Metallica',
      title: 'Master of Puppets',
      locale: navigator.language,
    });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe('/api/streaming/links');
    expect(url.searchParams.getAll('barcode')).toEqual(['0075596060721', '075596060721']);
    expect(url.searchParams.get('artist')).toBe('Metallica');
    expect(url.searchParams.get('title')).toBe('Master of Puppets');
    expect(url.searchParams.get('locale')).toBe(navigator.language);
  });

  it('omits the barcode param entirely when no barcodes are supplied', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({ links: [] }) });

    await getStreamingLinks({
      barcodes: [],
      artist: 'Some Master',
      title: 'Some Title',
      locale: navigator.language,
    });

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.has('barcode')).toBe(false);
  });

  it('parses { links } from a 2xx response', async () => {
    const links = [
      {
        platform: 'apple_music' as const,
        url: 'https://music.apple.com/es/album/master-of-puppets/1440899482',
      },
    ];
    mockFetchOnce({ ok: true, json: async () => ({ links }) });

    const result = await getStreamingLinks({
      barcodes: ['075596060721'],
      artist: 'Metallica',
      title: 'Master of Puppets',
      locale: navigator.language,
    });

    expect(result).toEqual({ links });
  });

  it('surfaces an ApiError on a non-2xx response', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_request',
        message: 'artist and title are required.',
      }),
    });

    await expect(
      getStreamingLinks({
        barcodes: [],
        artist: '',
        title: '',
        locale: navigator.language,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
