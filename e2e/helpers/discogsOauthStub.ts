/**
 * Minimal stand-in for Discogs' OAuth 1.0a endpoints so e2e runs never touch
 * the real Discogs (which cannot be scripted in CI). The backend dev server
 * is pointed here via DISCOGS_OAUTH_BASE_URL / DISCOGS_AUTHORIZE_BASE_URL —
 * see specs/015-discogs-oauth-link/research.md §R6 and the contract's
 * "External calls" table for the shapes this must honor.
 *
 * Run directly with `node helpers/discogsOauthStub.ts` (Node's native type
 * stripping; this package is CommonJS, hence require() syntax). The stubbed
 * Discogs username asserted by specs is STUB_USERNAME below.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('node:http');

const PORT = Number(process.env.DISCOGS_STUB_PORT ?? 4571);

const STUB_USERNAME = 'e2e-discogs-user';
const STUB_USER_ID = 4242;

// The single OAuth access token every linked stub user receives from
// /oauth/access_token. Feature 061 keys the "no seller settings" flag by it.
const STUB_ACCESS_TOKEN = 'stub-access-token';

// ---------------------------------------------------------------------------
// Feature 061: "Mi colección en cifras" — collection statistics & valuation.
// Designated release ids the collection-stats / valuation e2e specs
// (T027 / T040 / T051) depend on. Keep these stable.
// ---------------------------------------------------------------------------
// basic_information.year is OMITTED for this release → "Año desconocido" bucket.
const STATS_RELEASE_NO_YEAR = 6100;
// GET /marketplace/price_suggestions/:releaseId → 404 (no market data) unless a
// /__stub/price-suggestions seed overrides it. Drives "estimado sobre X de Y".
const VALUATION_RELEASE_NO_MARKET_DATA = 6101;
// Fixed early date_added → the growth chart's earliest month (FR-010).
const STATS_RELEASE_EARLY_ADDED = 6102;
const STATS_EARLY_ADDED_DATE = '2021-02-05T00:00:00.000Z';

// One in-flight request token at a time is enough for serial e2e runs.
const pendingCallbacks = new Map<string, string>();
let tokenCounter = 0;

// ---------------------------------------------------------------------------
// Feature 016: per-user Discogs collection state, so library sync/add/remove/
// per-copy edits can run against the real backend hermetically. Specs seed
// and assert this state through the /__stub/* control endpoints below.
// ---------------------------------------------------------------------------

interface StubNoteValue {
  field_id: number;
  value: string;
}

// Feature 061: the collection-folder rows now carry the `basic_information`
// facets the real Discogs payload includes and that Block-1 statistics are
// built from — see specs/061-collection-stats-valuation/research.md decision 1
// and data-model.md §2. `year` is optional (omitted for the designated
// "unknown year" release; `0` elsewhere also means unknown).
interface StubReleaseLabel {
  name: string;
  catno: string;
  id: number;
}

interface StubReleaseArtist {
  name: string;
  id: number;
  join: string;
}

interface StubBasicInformation {
  id: number;
  title: string;
  year?: number;
  labels: StubReleaseLabel[];
  artists: StubReleaseArtist[];
  genres: string[];
  styles: string[];
  thumb: string;
}

interface StubInstance {
  instance_id: number;
  folder_id: number;
  rating: number;
  date_added: string;
  basic_information: StubBasicInformation;
  notes: StubNoteValue[];
}

// A varied facet spread so the Block-1 breakdowns (decade / genre / style /
// label / artist) render deterministically without every spec spelling out a
// full `basic_information`. Indexed by `releaseId % DERIVED_FACETS.length`.
// Includes multi-valued genres/labels, a `"Various"` artist (excluded from the
// artist breakdown, FR-009), a `" (2)"` disambiguation suffix, and a `year: 0`
// (unknown) slot.
const DERIVED_FACETS: ReadonlyArray<{
  year: number;
  genres: string[];
  styles: string[];
  labels: string[];
  artists: string[];
}> = [
  { year: 1968, genres: ['Rock'], styles: ['Psychedelic Rock'], labels: ['Parlophone'], artists: ['The Beatles'] },
  { year: 1973, genres: ['Rock', 'Prog Rock'], styles: ['Progressive Rock'], labels: ['Harvest'], artists: ['Pink Floyd'] },
  { year: 1979, genres: ['Rock'], styles: ['Heavy Metal'], labels: ['Roadrunner Records'], artists: ['Iron Maiden'] },
  { year: 1984, genres: ['Electronic'], styles: ['Synth-pop'], labels: ['Mute'], artists: ['Depeche Mode'] },
  { year: 1988, genres: ['Electronic'], styles: ['Techno'], labels: ['Warp Records'], artists: ['Aphex Twin'] },
  { year: 1994, genres: ['Rock'], styles: ['Grunge'], labels: ['DGC'], artists: ['Nirvana'] },
  { year: 2001, genres: ['Electronic', 'Rock'], styles: ['IDM'], labels: ['Warp Records'], artists: ['Radiohead (2)'] },
  { year: 2013, genres: ['Jazz'], styles: ['Modal'], labels: ['Blue Note', 'Blue Note Records'], artists: ['Various'] },
  { year: 0, genres: [], styles: [], labels: ['Not On Label'], artists: ['Unknown Artist'] },
];

const COLLECTION_FIELDS = [
  { id: 1, name: 'Media Condition', type: 'dropdown' },
  { id: 2, name: 'Sleeve Condition', type: 'dropdown' },
  { id: 3, name: 'Notes', type: 'textarea' },
];

const collections = new Map<string, StubInstance[]>();
let instanceCounter = 0;
let collectionFailureMode: 'none' | 'auth' | 'unavailable' = 'none';
// Feature 060 / FR-013: a NARROW failure mode that fails ONLY the wantlist
// WRITE endpoints (PUT / DELETE /users/:username/wants/:id) with a 503, while
// leaving the wantlist LIST (GET /users/:username/wants), every /collection
// endpoint, and the catalog healthy. Lets an e2e assert "library add
// succeeds, wantlist removal fails" — which `collectionFailureMode` cannot,
// since it also gates the collection write the add depends on.
let wantlistWriteFailureMode: 'none' | 'unavailable' = 'none';

function userCollection(username: string): StubInstance[] {
  const existing = collections.get(username);
  if (existing) return existing;
  const fresh: StubInstance[] = [];
  collections.set(username, fresh);
  return fresh;
}

/**
 * Feature 061: builds the enriched `basic_information` for a release, applying
 * the deterministic `DERIVED_FACETS` spread and letting explicit seed values
 * win. `omitYear` drops the `year` key entirely (the "unknown year" shape).
 */
function deriveBasicInformation(
  releaseId: number,
  overrides: Partial<StubBasicInformation> = {},
  omitYear = false,
): StubBasicInformation {
  const facet = DERIVED_FACETS[releaseId % DERIVED_FACETS.length];
  const base: StubBasicInformation = {
    id: releaseId,
    title: `Stub Release ${releaseId}`,
    year: facet.year,
    labels: facet.labels.map((name, i) => ({
      name,
      catno: `CAT-${releaseId}-${i}`,
      id: 9_000_000 + releaseId * 10 + i,
    })),
    artists: facet.artists.map((name, i) => ({
      name,
      id: 8_000_000 + releaseId * 10 + i,
      join: i === 0 ? '' : ',',
    })),
    genres: [...facet.genres],
    styles: [...facet.styles],
    thumb: '',
    ...overrides,
  };
  if (omitYear || (releaseId === STATS_RELEASE_NO_YEAR && overrides.year === undefined)) {
    delete base.year;
  }
  return base;
}

/**
 * Feature 061: a deterministic `date_added` so the growth chart has several
 * populated months with zero-fill gaps between them, plus a fixed early anchor
 * for the designated release (FR-010).
 */
function deriveDateAdded(releaseId: number): string {
  if (releaseId === STATS_RELEASE_EARLY_ADDED) return STATS_EARLY_ADDED_DATE;
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (releaseId % 12), 5),
  ).toISOString();
}

function makeInstance(releaseId: number, overrides: Partial<StubInstance> = {}): StubInstance {
  instanceCounter += 1;
  return {
    instance_id: instanceCounter,
    folder_id: 1,
    rating: 0,
    date_added: deriveDateAdded(releaseId),
    basic_information: deriveBasicInformation(releaseId),
    notes: [],
    ...overrides,
  };
}

function readJsonBody(req: any): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: unknown) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function seedInstance(seed: Record<string, unknown>): StubInstance {
  const notes: StubNoteValue[] = [];
  if (seed.mediaCondition) notes.push({ field_id: 1, value: asText(seed.mediaCondition) });
  if (seed.sleeveCondition) notes.push({ field_id: 2, value: asText(seed.sleeveCondition) });
  if (seed.notes) notes.push({ field_id: 3, value: asText(seed.notes) });

  const releaseId = Number(seed.releaseId);
  // Feature 061: `basic_information` facet overrides may be given either flat on
  // the seed or nested under `basic_information` (mirrors `seedWant`).
  const bi = (seed.basic_information as Record<string, unknown> | undefined) ?? {};
  const pick = (key: string): unknown => seed[key] ?? bi[key];

  const biOverrides: Partial<StubBasicInformation> = {};
  const titleRaw = pick('title');
  if (titleRaw !== undefined) biOverrides.title = asText(titleRaw);

  const yearRaw = pick('year');
  const omitYear = seed.year === null || bi.year === null;
  if (yearRaw !== undefined && yearRaw !== null) biOverrides.year = Number(yearRaw);

  const labelsRaw = pick('labels');
  if (Array.isArray(labelsRaw)) {
    biOverrides.labels = labelsRaw.map((entry, i) => {
      const rec = (entry ?? {}) as Record<string, unknown>;
      return {
        name: typeof entry === 'string' ? entry : asText(rec.name),
        catno: rec.catno !== undefined ? asText(rec.catno) : `CAT-${releaseId}-${i}`,
        id: rec.id !== undefined ? Number(rec.id) : 9_000_000 + releaseId * 10 + i,
      };
    });
  }

  const artistsRaw = pick('artists');
  if (Array.isArray(artistsRaw)) {
    biOverrides.artists = artistsRaw.map((entry, i) => {
      const rec = (entry ?? {}) as Record<string, unknown>;
      return {
        name: typeof entry === 'string' ? entry : asText(rec.name),
        id: rec.id !== undefined ? Number(rec.id) : 8_000_000 + releaseId * 10 + i,
        join: rec.join !== undefined ? asText(rec.join) : i === 0 ? '' : ',',
      };
    });
  }

  const genresRaw = pick('genres');
  if (Array.isArray(genresRaw)) biOverrides.genres = genresRaw.map(asText);
  const stylesRaw = pick('styles');
  if (Array.isArray(stylesRaw)) biOverrides.styles = stylesRaw.map(asText);
  const thumbRaw = pick('thumb');
  if (thumbRaw !== undefined) biOverrides.thumb = asText(thumbRaw);

  const overrides: Partial<StubInstance> = {
    rating: Number(seed.rating ?? 0),
    notes,
    basic_information: deriveBasicInformation(releaseId, biOverrides, omitYear),
  };
  const dateAdded = seed.date_added ?? bi.date_added;
  if (dateAdded !== undefined) overrides.date_added = asText(dateAdded);

  return makeInstance(releaseId, overrides);
}

// ---------------------------------------------------------------------------
// Feature 061: GET /marketplace/price_suggestions/:releaseId state.
// ---------------------------------------------------------------------------
// Exact grade strings from backend/src/domain/discogsOauth/conditionGrading.ts
// (`MEDIA_CONDITIONS`) — the price_suggestions response keys must match verbatim
// so the valuation use case can do a direct lookup with no mapping.
const MEDIA_CONDITION_GRADES = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
] as const;

type MediaConditionGrade = (typeof MEDIA_CONDITION_GRADES)[number];

interface StubConditionPrice {
  currency: string;
  value: number;
}

type StubPriceSuggestions = Partial<Record<MediaConditionGrade, StubConditionPrice>>;

const GRADE_FACTOR: Record<MediaConditionGrade, number> = {
  'Mint (M)': 1,
  'Near Mint (NM or M-)': 0.82,
  'Very Good Plus (VG+)': 0.55,
  'Very Good (VG)': 0.34,
  'Good Plus (G+)': 0.2,
  'Good (G)': 0.12,
  'Fair (F)': 0.06,
  'Poor (P)': 0.03,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Deterministic per-grade EUR price map for a release (currency = the user's Discogs seller currency). */
function derivePriceSuggestions(releaseId: number): StubPriceSuggestions {
  const mint = 8 + (releaseId % 47); // spread 8.00–54.00 EUR at Mint
  const map: StubPriceSuggestions = {};
  for (const grade of MEDIA_CONDITION_GRADES) {
    map[grade] = { currency: 'EUR', value: round2(mint * GRADE_FACTOR[grade]) };
  }
  return map;
}

// Explicit per-release price seeds win over the deterministic map. A `null`
// seed → 404 (no market data). See /__stub/price-suggestions.
const priceSuggestionSeeds = new Map<number, StubPriceSuggestions | null>();
// How many times GET /marketplace/price_suggestions was hit per release — lets
// a spec assert a warm re-open issues zero new calls (SC-005 / T051).
const priceSuggestionHits = new Map<number, number>();
// OAuth access tokens whose owner has NOT completed Discogs seller settings →
// GET /marketplace/price_suggestions responds 403 (SellerSettingsRequiredError).
const noSellerSettingsTokens = new Set<string>();
// Narrow failure injection for the marketplace endpoint (mirrors
// `collectionFailureMode` but scoped to price_suggestions) so a scale/outage
// spec can force 503 or paced responses without touching /collection.
let priceSuggestionsFailureMode: 'none' | 'unavailable' | 'slow' = 'none';
const PRICE_SUGGESTIONS_SLOW_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Extracts the OAuth 1.0a `oauth_token` from the Authorization header, if present. */
function oauthTokenOf(req: any): string | null {
  const authHeader = req.headers.authorization ?? '';
  const match = /oauth_token="?([^",\s]+)"?/.exec(authHeader);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Feature 060: per-user Discogs wantlist state, mirroring the collection block
// above. Specs seed and assert this through the /__stub/wants/* control
// endpoints. The authenticated /users/:username/wants endpoints are OAuth-
// signed and gated by the same `collectionFailureMode` toggle.
// ---------------------------------------------------------------------------

interface StubWant {
  id: number;
  rating: number;
  notes: string;
  date_added: string;
  basic_information: {
    id: number;
    title: string;
    year: number;
    artists: { name: string }[];
    thumb: string;
  };
}

const wants = new Map<string, StubWant[]>();

function userWants(username: string): StubWant[] {
  const existing = wants.get(username);
  if (existing) return existing;
  const fresh: StubWant[] = [];
  wants.set(username, fresh);
  return fresh;
}

function makeWant(releaseId: number, overrides: Partial<StubWant> = {}): StubWant {
  return {
    id: releaseId,
    rating: 0,
    notes: '',
    date_added: new Date().toISOString(),
    basic_information: {
      id: releaseId,
      title: `Stub Release ${releaseId}`,
      year: 2000,
      artists: [{ name: 'Stub Artist' }],
      thumb: '',
    },
    ...overrides,
  };
}

function seedWant(raw: Record<string, unknown>): StubWant {
  const releaseId = Number(raw.releaseId ?? raw.id);
  const bi = (raw.basic_information as Record<string, unknown> | undefined) ?? {};
  const rawArtists = bi.artists;
  return makeWant(releaseId, {
    rating: Number(raw.rating ?? 0),
    notes: asText(raw.notes ?? ''),
    ...(raw.date_added ? { date_added: asText(raw.date_added) } : {}),
    basic_information: {
      id: releaseId,
      title: raw.title ? asText(raw.title) : asText(bi.title ?? `Stub Release ${releaseId}`),
      year: Number(bi.year ?? raw.year ?? 2000),
      artists: Array.isArray(rawArtists)
        ? (rawArtists as Array<Record<string, unknown>>).map((a) => ({ name: asText(a.name) }))
        : [{ name: raw.artist ? asText(raw.artist) : 'Stub Artist' }],
      thumb: asText(bi.thumb ?? raw.thumb ?? ''),
    },
  });
}

function listWants(res: any, url: URL, entries: StubWant[]): void {
  const perPage = Number(url.searchParams.get('per_page') ?? 100);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  json(res, 200, {
    pagination: { page, pages, per_page: perPage, items: entries.length },
    wants: entries.slice((page - 1) * perPage, page * perPage),
  });
}

/** Handles /__stub/* control endpoints (never part of the Discogs API). */
async function handleControlRequest(req: any, res: any, url: URL): Promise<boolean> {
  if (url.pathname === '/__stub/reset' && req.method === 'POST') {
    collections.clear();
    wants.clear();
    collectionFailureMode = 'none';
    wantlistWriteFailureMode = 'none';
    // Feature 061.
    priceSuggestionSeeds.clear();
    priceSuggestionHits.clear();
    noSellerSettingsTokens.clear();
    priceSuggestionsFailureMode = 'none';
    json(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === '/__stub/failure' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if ('mode' in body) {
      collectionFailureMode = (body.mode as typeof collectionFailureMode) ?? 'none';
    }
    if ('wantlistWrite' in body) {
      wantlistWriteFailureMode =
        (body.wantlistWrite as typeof wantlistWriteFailureMode) ?? 'none';
    }
    // Feature 061: 'unavailable' → 503 on every price call; 'slow' → paced
    // responses (so a scale spec can prove the shared breaker never trips).
    if ('priceSuggestions' in body) {
      priceSuggestionsFailureMode =
        (body.priceSuggestions as typeof priceSuggestionsFailureMode) ?? 'none';
    }
    json(res, 200, { ok: true });
    return true;
  }

  // Feature 061: seed / clear per-release price-suggestion data.
  //   POST /__stub/price-suggestions { seeds: { "<releaseId>": <map> | null }, reset?: true }
  //   GET  /__stub/price-suggestions  → current seeds, per-release hit counts
  if (url.pathname === '/__stub/price-suggestions') {
    if (req.method === 'GET') {
      json(res, 200, {
        seeds: Object.fromEntries(priceSuggestionSeeds),
        hits: Object.fromEntries(priceSuggestionHits),
        totalHits: [...priceSuggestionHits.values()].reduce((sum, n) => sum + n, 0),
        noSellerSettingsTokens: [...noSellerSettingsTokens],
        failureMode: priceSuggestionsFailureMode,
      });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (body.reset === true) {
        priceSuggestionSeeds.clear();
        priceSuggestionHits.clear();
      }
      const seeds = (body.seeds as Record<string, unknown> | undefined) ?? {};
      for (const [releaseId, value] of Object.entries(seeds)) {
        priceSuggestionSeeds.set(
          Number(releaseId),
          value === null ? null : (value as StubPriceSuggestions),
        );
      }
      json(res, 200, { ok: true });
      return true;
    }
    return false;
  }

  // Feature 061: mark / unmark an account as lacking Discogs seller settings.
  //   POST /__stub/seller-settings { missing: boolean, token?: string }
  // `token` defaults to STUB_ACCESS_TOKEN (the single token every linked stub
  // user gets), so a spec can just POST { missing: true }.
  if (url.pathname === '/__stub/seller-settings' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const token = typeof body.token === 'string' ? body.token : STUB_ACCESS_TOKEN;
    if (body.missing === true) {
      noSellerSettingsTokens.add(token);
    } else {
      noSellerSettingsTokens.delete(token);
    }
    json(res, 200, { ok: true });
    return true;
  }

  const wantsMatch = /^\/__stub\/wants\/([^/]+)$/.exec(url.pathname);
  if (wantsMatch) {
    const username = decodeURIComponent(wantsMatch[1]);
    if (req.method === 'GET') {
      json(res, 200, { wants: userWants(username) });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const seeds = (body.wants as Array<Record<string, unknown>>) ?? [];
      wants.set(username, seeds.map(seedWant));
      json(res, 200, { ok: true });
      return true;
    }
    return false;
  }

  const match = /^\/__stub\/collections\/([^/]+)$/.exec(url.pathname);
  if (!match) return false;
  const username = decodeURIComponent(match[1]);

  if (req.method === 'GET') {
    json(res, 200, { releases: userCollection(username) });
    return true;
  }
  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const seeds = (body.releases as Array<Record<string, unknown>>) ?? [];
    collections.set(username, seeds.map(seedInstance));
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

function listReleases(res: any, url: URL, instances: StubInstance[]): void {
  const perPage = Number(url.searchParams.get('per_page') ?? 100);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pages = Math.max(1, Math.ceil(instances.length / perPage));
  json(res, 200, {
    pagination: { page, pages, per_page: perPage, items: instances.length },
    releases: instances.slice((page - 1) * perPage, page * perPage),
  });
}

async function handleInstanceRequest(
  req: any,
  res: any,
  instances: StubInstance[],
  instanceId: number,
): Promise<void> {
  const index = instances.findIndex((instance) => instance.instance_id === instanceId);
  if (index === -1) {
    json(res, 404, { message: 'Instance not found.' });
    return;
  }
  if (req.method === 'DELETE') {
    instances.splice(index, 1);
    res.writeHead(204).end();
    return;
  }
  const body = await readJsonBody(req);
  if (typeof body.rating === 'number') {
    instances[index].rating = body.rating;
  }
  res.writeHead(204).end();
}

async function handleFieldRequest(
  req: any,
  res: any,
  url: URL,
  instances: StubInstance[],
  instanceId: number,
  fieldId: number,
): Promise<void> {
  const instance = instances.find((candidate) => candidate.instance_id === instanceId);
  if (!instance) {
    json(res, 404, { message: 'Instance not found.' });
    return;
  }
  const body = await readJsonBody(req);
  const value = asText(url.searchParams.get('value') ?? body.value);
  const existing = instance.notes.find((note) => note.field_id === fieldId);
  if (existing) {
    existing.value = value;
  } else {
    instance.notes.push({ field_id: fieldId, value });
  }
  res.writeHead(204).end();
}

function respondWithInjectedFailure(res: any): boolean {
  if (collectionFailureMode === 'auth') {
    json(res, 401, { message: 'You must authenticate to access this resource.' });
    return true;
  }
  if (collectionFailureMode === 'unavailable') {
    json(res, 503, { message: 'Service unavailable.' });
    return true;
  }
  return false;
}

/** True for the backend's OAuth 1.0a PLAINTEXT header (a linked user's own credentials), false for its `Discogs token=` app-level header. */
function isOAuthSignedRequest(req: any): boolean {
  const authHeader = req.headers.authorization ?? '';
  return authHeader.startsWith('OAuth ') && authHeader.includes('oauth_token=');
}

/**
 * Spec 053: `auth` failure mode also revokes a linked user's *catalog*
 * requests (OAuth-signed), while requests signed with the shared app token
 * (unlinked users) keep succeeding — mirrors the backend's own mis-
 * attribution guard (a broken app token is a different failure than a
 * revoked user link) and its no-silent-fallback guarantee.
 */
function respondWithInjectedCatalogAuthFailure(req: any, res: any): boolean {
  if (collectionFailureMode === 'auth' && isOAuthSignedRequest(req)) {
    json(res, 401, { message: 'You must authenticate to access this resource.' });
    return true;
  }
  return false;
}

/**
 * Feature 061 — GET {DISCOGS_OAUTH_BASE_URL}/marketplace/price_suggestions/:releaseId
 * (OAuth-signed). Returns true when the request was handled here. Mapping, per
 * specs/061-collection-stats-valuation/contracts/discogs-marketplace-client.md:
 *  - shared / endpoint-scoped failure injection → 401 / 503
 *  - caller without seller settings                → 403 (SellerSettingsRequiredError)
 *  - `null` seed or VALUATION_RELEASE_NO_MARKET_DATA → 404 (no market data)
 *  - explicit seed                                  → that map
 *  - anything else                                  → deterministic EUR per-grade map
 */
async function handlePriceSuggestionsRequest(req: any, res: any, url: URL): Promise<boolean> {
  const match = /^\/marketplace\/price_suggestions\/(\d+)$/.exec(url.pathname);
  if (!match || req.method !== 'GET') return false;

  const releaseId = Number(match[1]);
  priceSuggestionHits.set(releaseId, (priceSuggestionHits.get(releaseId) ?? 0) + 1);

  // Shared revoke/outage injection (same toggle as /collection).
  if (respondWithInjectedFailure(res)) return true;
  // Endpoint-scoped injection (FR-021 scale / outage specs).
  if (priceSuggestionsFailureMode === 'unavailable') {
    json(res, 503, { message: 'Service unavailable.' });
    return true;
  }
  if (priceSuggestionsFailureMode === 'slow') {
    await delay(PRICE_SUGGESTIONS_SLOW_MS);
  }

  // A linked account without completed Discogs seller settings cannot read
  // price suggestions — Discogs answers 403 (→ SellerSettingsRequiredError).
  const token = oauthTokenOf(req);
  if (token && noSellerSettingsTokens.has(token)) {
    json(res, 403, {
      message:
        "You must set your seller settings before you can access price suggestions.",
    });
    return true;
  }

  if (priceSuggestionSeeds.has(releaseId)) {
    const seeded = priceSuggestionSeeds.get(releaseId) ?? null;
    if (seeded === null) {
      json(res, 404, { message: 'No price suggestions for this release.' });
      return true;
    }
    json(res, 200, seeded);
    return true;
  }

  if (releaseId === VALUATION_RELEASE_NO_MARKET_DATA) {
    json(res, 404, { message: 'No price suggestions for this release.' });
    return true;
  }

  json(res, 200, derivePriceSuggestions(releaseId));
  return true;
}

/**
 * Routes /users/:username/collection/* and /__stub/* requests. Returns true
 * when the request was handled here.
 */
async function handleCollectionRequest(req: any, res: any, url: URL): Promise<boolean> {
  if (await handleControlRequest(req, res, url)) return true;

  // --- Feature 060: authenticated wantlist endpoints, per the User Wantlist docs ---
  const wantsPath = /^\/users\/([^/]+)\/wants(?:\/(\d+))?$/.exec(url.pathname);
  if (wantsPath) {
    if (respondWithInjectedFailure(res)) return true;

    const username = decodeURIComponent(wantsPath[1]);
    const releaseId = wantsPath[2] ? Number(wantsPath[2]) : null;
    const entries = userWants(username);

    if (releaseId === null && req.method === 'GET') {
      listWants(res, url, entries);
      return true;
    }

    // FR-013: fail ONLY the wantlist WRITE (PUT/DELETE) — the LIST above stays healthy.
    if (
      releaseId !== null &&
      (req.method === 'PUT' || req.method === 'DELETE') &&
      wantlistWriteFailureMode === 'unavailable'
    ) {
      json(res, 503, { message: 'Service unavailable.' });
      return true;
    }

    if (releaseId !== null && req.method === 'PUT') {
      const body = await readJsonBody(req);
      let want = entries.find((candidate) => candidate.id === releaseId);
      if (want) {
        if (typeof body.notes === 'string') want.notes = body.notes;
        if (typeof body.rating === 'number') want.rating = body.rating;
      } else {
        want = makeWant(releaseId, {
          rating: typeof body.rating === 'number' ? body.rating : 0,
          notes: typeof body.notes === 'string' ? body.notes : '',
        });
        entries.push(want);
      }
      json(res, 200, want);
      return true;
    }

    if (releaseId !== null && req.method === 'DELETE') {
      const index = entries.findIndex((candidate) => candidate.id === releaseId);
      if (index === -1) {
        json(res, 404, { message: 'Release not in wantlist' });
        return true;
      }
      entries.splice(index, 1);
      res.writeHead(204).end();
      return true;
    }

    json(res, 404, { message: 'not found' });
    return true;
  }

  // --- Authenticated collection endpoints, per the User Collection docs ---
  const collectionPath = /^\/users\/([^/]+)\/collection(\/.*)?$/.exec(url.pathname);
  if (!collectionPath) return false;

  if (respondWithInjectedFailure(res)) return true;

  const username = decodeURIComponent(collectionPath[1]);
  const rest = collectionPath[2] ?? '';
  const instances = userCollection(username);

  if (rest === '/fields' && req.method === 'GET') {
    json(res, 200, { fields: COLLECTION_FIELDS });
    return true;
  }

  if (rest === '/folders/0/releases' && req.method === 'GET') {
    listReleases(res, url, instances);
    return true;
  }

  const byReleaseMatch = /^\/releases\/(\d+)$/.exec(rest);
  if (byReleaseMatch && req.method === 'GET') {
    const releaseId = Number(byReleaseMatch[1]);
    listReleases(res, url, instances.filter((i) => i.basic_information.id === releaseId));
    return true;
  }

  const addMatch = /^\/folders\/(\d+)\/releases\/(\d+)$/.exec(rest);
  if (addMatch && req.method === 'POST') {
    const instance = makeInstance(Number(addMatch[2]), { folder_id: Number(addMatch[1]) });
    instances.push(instance);
    json(res, 201, { instance_id: instance.instance_id, resource_url: '' });
    return true;
  }

  const instanceMatch = /^\/folders\/\d+\/releases\/\d+\/instances\/(\d+)$/.exec(rest);
  if (instanceMatch && (req.method === 'DELETE' || req.method === 'POST')) {
    await handleInstanceRequest(req, res, instances, Number(instanceMatch[1]));
    return true;
  }

  const fieldMatch = /^\/folders\/\d+\/releases\/\d+\/instances\/(\d+)\/fields\/(\d+)$/.exec(rest);
  if (fieldMatch && req.method === 'POST') {
    await handleFieldRequest(req, res, url, instances, Number(fieldMatch[1]), Number(fieldMatch[2]));
    return true;
  }

  json(res, 404, { message: 'not found' });
  return true;
}

function urlencoded(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * Minimal catalog release response for GET /releases/:id.
 * Maps to the Discogs release shape consumed by the backend's discogsMapper.
 */
// Feature 017: releases ending in 1 get a "high"-band community rating so
// e2e specs can assert the rating badge renders on library cards without a
// separate control endpoint; every other release stays unrated.
function stubCommunity(releaseId: number) {
  return releaseId % 10 === 1
    ? { have: 20, want: 5, rating: { average: 4.5, count: 30 } }
    : undefined;
}

function stubRelease(releaseId: number) {
  const community = stubCommunity(releaseId);
  return {
    id: releaseId,
    title: `Stub Release ${releaseId}`,
    year: 2000,
    country: 'UK',
    artists: [{ id: 1, name: 'Stub Artist', anv: '', join: '', role: '' }],
    labels: [{ id: 1, name: 'Stub Label', catno: 'STUB01' }],
    formats: [{ name: 'Vinyl', qty: '1', descriptions: ['12"'] }],
    genres: ['Electronic'],
    styles: ['Techno'],
    tracklist: [{ position: 'A1', type_: 'track', title: 'Stub Track', duration: '6:00' }],
    identifiers: [],
    images: [],
    ...(community ? { community } : {}),
    uri: `http://localhost:${PORT}/releases/${releaseId}`,
  };
}

function authorizePageHtml(oauthToken: string, callbackUrl: string): string {
  const approveUrl = `${callbackUrl}?oauth_token=${encodeURIComponent(oauthToken)}&oauth_verifier=stub-verifier-${encodeURIComponent(oauthToken)}`;
  const denyUrl = `${callbackUrl}?denied=${encodeURIComponent(oauthToken)}`;
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Discogs OAuth Stub</title></head>
  <body>
    <h1>Discogs authorization (stub)</h1>
    <p>An application is requesting access to your Discogs account.</p>
    <p><a id="authorize" href="${approveUrl}">Authorize</a></p>
    <p><a id="deny" href="${denyUrl}">Deny</a></p>
  </body>
</html>`;
}

const server = createServer(async (req: any, res: any) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }

  // Feature 016: user-collection endpoints + spec control endpoints.
  if (await handleCollectionRequest(req, res, url)) {
    return;
  }

  // Feature 061: marketplace price suggestions (OAuth-signed).
  if (await handlePriceSuggestionsRequest(req, res, url)) {
    return;
  }

  // Catalog endpoints (used by library enrichment when DISCOGS_BASE_URL points here).
  const releaseMatch = /^\/releases\/(\d+)$/.exec(url.pathname);
  if (releaseMatch && req.method === 'GET') {
    if (respondWithInjectedCatalogAuthFailure(req, res)) return;
    json(res, 200, stubRelease(Number(releaseMatch[1])));
    return;
  }

  // Catalog search (used by AddRecordPage).
  if (url.pathname === '/database/search' && req.method === 'GET') {
    if (respondWithInjectedCatalogAuthFailure(req, res)) return;
    const q = url.searchParams.get('q') ?? '';
    const releaseId = 99901;
    json(res, 200, {
      results: [{
        id: releaseId,
        type: 'release',
        title: `Stub Artist - Stub Search Result for ${q}`,
        thumb: '',
        cover_image: '',
        year: '2000',
        format: ['Vinyl'],
      }],
      pagination: { page: 1, pages: 1, per_page: 20, items: 1 },
    });
    return;
  }

  if (url.pathname === '/oauth/request_token' && req.method === 'GET') {
    tokenCounter += 1;
    const token = `stub-request-token-${tokenCounter}`;
    const authHeader = req.headers.authorization ?? '';
    const callbackMatch = /oauth_callback="([^"]+)"/.exec(authHeader);
    pendingCallbacks.set(token, callbackMatch ? callbackMatch[1] : '');
    res.writeHead(200, { 'Content-Type': 'application/x-www-form-urlencoded' }).end(
      urlencoded({
        oauth_token: token,
        oauth_token_secret: `stub-request-secret-${tokenCounter}`,
        oauth_callback_confirmed: 'true',
      }),
    );
    return;
  }

  if (url.pathname === '/oauth/authorize' && req.method === 'GET') {
    const token = url.searchParams.get('oauth_token') ?? '';
    const callbackUrl = pendingCallbacks.get(token);
    if (!callbackUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('unknown oauth_token');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(authorizePageHtml(token, callbackUrl));
    return;
  }

  if (url.pathname === '/oauth/access_token' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/x-www-form-urlencoded' }).end(
      urlencoded({
        oauth_token: STUB_ACCESS_TOKEN,
        oauth_token_secret: 'stub-access-secret',
      }),
    );
    return;
  }

  if (url.pathname === '/oauth/identity' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        id: STUB_USER_ID,
        username: STUB_USERNAME,
        resource_url: `http://localhost:${PORT}/users/${STUB_USERNAME}`,
      }),
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`discogs oauth stub listening on http://localhost:${PORT}`);
});
