import { promises as dnsPromises, type LookupAddress } from 'node:dns';
import { BlockList } from 'node:net';
import type { Readable } from 'node:stream';

import axios from 'axios';
import Parser from 'rss-parser';

import { logger } from '../../config/logger';
import type { RawFeedItem } from '../../domain/feeds/types';
import type { FeedSourcePort } from '../../ports/feeds/feedSourcePort';

const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT = 'Vinylmania/0.1 (+https://vinylmania.app; RSS dashboard aggregator)';

/** xml2js node as rss-parser hands back custom fields: attributes live under `$`. */
interface XmlNode {
  $?: Record<string, string | undefined>;
  'media:content'?: XmlNode[];
}

interface CustomItem {
  mediaContent?: XmlNode[];
  mediaThumbnail?: XmlNode[];
  mediaGroup?: XmlNode;
  itunesImage?: XmlNode;
  /** RSS: link strings; Atom: `<link rel href type>` nodes. */
  links?: (string | XmlNode)[];
  'content:encoded'?: string;
}

// spec 067 D1: Media RSS / iTunes fields are only read when declared here.
const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup'],
      ['itunes:image', 'itunesImage'],
      ['link', 'links', { keepArray: true }],
    ],
  },
});

function toMediaContent(node: XmlNode) {
  const { url, medium, type, width } = node.$ ?? {};
  if (!url) {
    return undefined;
  }
  return {
    url,
    ...(medium && { medium }),
    ...(type && { type }),
    ...(width && Number.isFinite(Number(width)) && { width: Number(width) }),
  };
}

/** Fetches one feed URL and parses it into domain-owned RawFeedItems, bounded by an independent timeout per source (spec FR-005). */
export async function fetchFeed(
  feedUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<RawFeedItem[]> {
  const response = await axios.get<string>(feedUrl, {
    timeout: timeoutMs,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT },
  });

  const feed = await parser.parseString(response.data);

  return feed.items.map((item) => {
    const atomEnclosure = item.links
      ?.map((link) => (typeof link === 'string' ? undefined : link.$))
      .find((attrs) => attrs?.rel === 'enclosure');
    const mediaContent = [
      ...(item.mediaContent ?? []),
      ...(item.mediaGroup?.['media:content'] ?? []),
    ]
      .map(toMediaContent)
      .filter((m) => m !== undefined);
    const mediaThumbnails = (item.mediaThumbnail ?? [])
      .map((node) => node.$?.url)
      .filter((url) => url !== undefined);

    return {
      title: item.title,
      link: item.link,
      guid: item.guid,
      isoDate: item.isoDate,
      pubDate: item.pubDate,
      content: item.content,
      contentSnippet: item.contentSnippet,
      summary: item.summary,
      enclosureUrl: item.enclosure?.url ?? atomEnclosure?.href,
      enclosureType: item.enclosure?.type ?? atomEnclosure?.type,
      contentEncoded: item['content:encoded'],
      mediaContent: mediaContent.length > 0 ? mediaContent : undefined,
      mediaThumbnails: mediaThumbnails.length > 0 ? mediaThumbnails : undefined,
      itunesImage: item.itunesImage?.$?.href,
    };
  });
}

// --- Article-page lookup (spec 067 D3) ---------------------------------------

const MAX_REDIRECTS = 3;
const MAX_HEAD_BYTES = 256 * 1024;
const HTML_CONTENT_TYPE = /^\s*(?:text\/html|application\/xhtml\+xml)\b/i;
const HEAD_END = /<\/head\s*>/i;
const OG_IMAGE_META = /<meta\b[^>]*["']og:image["'][^>]*>/i;

// Private, loopback, link-local (incl. cloud metadata), CGNAT, multicast and
// reserved ranges. IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched against the
// IPv4 subnets by BlockList itself; the other IPv4-embedding IPv6 prefixes
// (IPv4-compatible, NAT64, Teredo, 6to4) are blocked whole.
const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['2001::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

type Resolver = (host: string) => Promise<LookupAddress[]>;

const dnsLookupAll: Resolver = (host) => dnsPromises.lookup(host, { all: true });

function isBlocked({ address, family }: LookupAddress): boolean {
  return blockedAddresses.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function rejectOnAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  ]);
}

/** Reads until </head>, an og:image meta tag or MAX_HEAD_BYTES, then drops the connection. */
async function readHead(stream: Readable): Promise<string> {
  let buffer = Buffer.alloc(0);
  try {
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk as Buffer]);
      if (buffer.length >= MAX_HEAD_BYTES) {
        buffer = buffer.subarray(0, MAX_HEAD_BYTES);
        break;
      }
      const text = buffer.toString('utf8');
      if (HEAD_END.test(text) || OG_IMAGE_META.test(text)) {
        break;
      }
    }
  } finally {
    stream.destroy();
  }
  return buffer.toString('utf8');
}

/**
 * See `FeedSourcePort.fetchArticleHead`. `resolve` is injectable so tests
 * never hit real DNS. One timeout signal covers DNS and every hop.
 */
export async function fetchArticleHead(
  url: string,
  timeoutMs: number,
  resolve: Resolver = dnsLookupAll,
): Promise<string | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let target: URL;
    try {
      target = new URL(current);
    } catch {
      return null;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return null;
    }

    const host = target.hostname.replace(/^\[|\]$/g, '');
    const addresses = await rejectOnAbort(resolve(host), signal);
    if (addresses.length === 0 || addresses.some(isBlocked)) {
      logger.warn({ route: 'feeds:images', outcome: 'validation_error', meta: { host } });
      return null;
    }
    const pinned = addresses[0];

    const response = await axios.get<Readable>(target.href, {
      signal,
      responseType: 'stream',
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      // A proxy would resolve the host itself, skipping the check and the pin.
      proxy: false,
      // Connect to the address validated above: no DNS-rebinding window.
      lookup: (_hostname, _options, callback) =>
        callback(null, pinned.address, pinned.family === 6 ? 6 : 4),
    });
    const { status, headers, data } = response;

    if (status >= 300 && status < 400) {
      data.destroy();
      const location = headers.location as string | undefined;
      if (!location) {
        return null;
      }
      try {
        current = new URL(location, target).href;
      } catch {
        return null;
      }
      continue;
    }
    if (status >= 500) {
      data.destroy();
      throw new Error(`Article page responded ${status}`);
    }
    if (status >= 400 || !HTML_CONTENT_TYPE.test(String(headers['content-type'] ?? ''))) {
      data.destroy();
      return null;
    }
    return rejectOnAbort(readHead(data), signal);
  }

  return null; // more than MAX_REDIRECTS redirects
}

export const feedSourceAdapter: FeedSourcePort = { fetchFeed, fetchArticleHead };
