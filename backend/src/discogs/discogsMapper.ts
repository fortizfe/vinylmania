import { z, type ZodType } from 'zod';

import { DiscogsValidationError } from './discogsErrors';
import type { Artist, CatalogSearchResult, Release } from './types';

function parseOrThrow<T>(schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new DiscogsValidationError(result.error);
  }
  return result.data;
}

const rawSearchResultSchema = z.object({
  id: z.number(),
  type: z.enum(['release', 'artist']),
  title: z.string(),
  thumb: z.string().optional(),
  cover_image: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  format: z.array(z.string()).optional(),
});

const ARTIST_TITLE_SEPARATOR = ' - ';

function splitArtistFromTitle(rawTitle: string): { title: string; artist?: string } {
  const separatorIndex = rawTitle.indexOf(ARTIST_TITLE_SEPARATOR);
  if (separatorIndex === -1) {
    return { title: rawTitle };
  }

  const artist = rawTitle.slice(0, separatorIndex).trim();
  const title = rawTitle.slice(separatorIndex + ARTIST_TITLE_SEPARATOR.length).trim();
  if (!artist || !title) {
    return { title: rawTitle };
  }

  return { title, artist };
}

export function mapSearchResult(raw: unknown): CatalogSearchResult {
  const parsed = parseOrThrow(rawSearchResultSchema, raw);

  const thumbnailUrl = parsed.cover_image || parsed.thumb || undefined;
  const year = parsed.year === undefined ? undefined : Number(parsed.year);
  const formats = parsed.format && parsed.format.length > 0 ? parsed.format : undefined;
  const { title, artist } =
    parsed.type === 'release' ? splitArtistFromTitle(parsed.title) : { title: parsed.title };

  return {
    discogsId: parsed.id,
    resultType: parsed.type,
    title,
    ...(artist ? { artist } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(year !== undefined && !Number.isNaN(year) ? { year } : {}),
    ...(formats ? { formats } : {}),
  };
}

const rawReleaseArtistSchema = z.object({
  id: z.number(),
  name: z.string(),
  anv: z.string().optional(),
  join: z.string().optional(),
});

const rawLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  catno: z.string().optional(),
});

const rawFormatSchema = z.object({
  name: z.string(),
  qty: z.union([z.string(), z.number()]).optional(),
  descriptions: z.array(z.string()).optional(),
});

const rawTrackSchema = z.object({
  position: z.string(),
  title: z.string(),
  duration: z.string().optional(),
});

const rawImageSchema = z.object({
  type: z.enum(['primary', 'secondary']),
  uri: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const rawReleaseSchema = z.object({
  id: z.number(),
  title: z.string(),
  year: z.number().optional(),
  country: z.string().optional(),
  artists: z.array(rawReleaseArtistSchema),
  labels: z.array(rawLabelSchema).optional(),
  formats: z.array(rawFormatSchema).optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  tracklist: z.array(rawTrackSchema).optional(),
  images: z.array(rawImageSchema).optional(),
  master_id: z.number().optional(),
  uri: z.string(),
});

export function mapRelease(raw: unknown): Release {
  const parsed = parseOrThrow(rawReleaseSchema, raw);

  return {
    discogsId: parsed.id,
    title: parsed.title,
    ...(parsed.year !== undefined ? { year: parsed.year } : {}),
    ...(parsed.country ? { country: parsed.country } : {}),
    artists: parsed.artists.map((artist) => ({
      discogsArtistId: artist.id,
      name: artist.name,
      ...(artist.anv ? { nameVariation: artist.anv } : {}),
      ...(artist.join ? { joinPhrase: artist.join } : {}),
    })),
    labels: (parsed.labels ?? []).map((label) => ({
      discogsLabelId: label.id,
      name: label.name,
      ...(label.catno ? { catalogNumber: label.catno } : {}),
    })),
    formats: (parsed.formats ?? []).map((format) => ({
      name: format.name,
      ...(format.qty !== undefined ? { quantity: Number(format.qty) } : {}),
      descriptions: format.descriptions ?? [],
    })),
    genres: parsed.genres ?? [],
    styles: parsed.styles ?? [],
    tracklist: (parsed.tracklist ?? []).map((track) => ({
      position: track.position,
      title: track.title,
      ...(track.duration ? { duration: track.duration } : {}),
    })),
    images: (parsed.images ?? []).map((image) => ({
      url: image.uri,
      imageType: image.type,
      ...(image.width !== undefined ? { width: image.width } : {}),
      ...(image.height !== undefined ? { height: image.height } : {}),
    })),
    ...(parsed.master_id !== undefined ? { masterId: parsed.master_id } : {}),
    discogsUrl: parsed.uri,
  };
}

const rawArtistAliasSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const rawArtistSchema = z.object({
  id: z.number(),
  name: z.string(),
  realname: z.string().optional(),
  profile: z.string().optional(),
  namevariations: z.array(z.string()).optional(),
  aliases: z.array(rawArtistAliasSchema).optional(),
  images: z.array(rawImageSchema).optional(),
  uri: z.string(),
});

export function mapArtist(raw: unknown): Artist {
  const parsed = parseOrThrow(rawArtistSchema, raw);

  return {
    discogsId: parsed.id,
    name: parsed.name,
    ...(parsed.realname ? { realName: parsed.realname } : {}),
    ...(parsed.profile ? { profile: parsed.profile } : {}),
    nameVariations: parsed.namevariations ?? [],
    aliases: (parsed.aliases ?? []).map((alias) => ({
      discogsArtistId: alias.id,
      name: alias.name,
    })),
    images: (parsed.images ?? []).map((image) => ({
      url: image.uri,
      imageType: image.type,
      ...(image.width !== undefined ? { width: image.width } : {}),
      ...(image.height !== undefined ? { height: image.height } : {}),
    })),
    discogsUrl: parsed.uri,
  };
}
