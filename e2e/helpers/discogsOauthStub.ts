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

interface StubInstance {
  instance_id: number;
  folder_id: number;
  rating: number;
  date_added: string;
  basic_information: { id: number; title: string; year: number };
  notes: StubNoteValue[];
}

const COLLECTION_FIELDS = [
  { id: 1, name: 'Media Condition', type: 'dropdown' },
  { id: 2, name: 'Sleeve Condition', type: 'dropdown' },
  { id: 3, name: 'Notes', type: 'textarea' },
];

const collections = new Map<string, StubInstance[]>();
let instanceCounter = 0;
let collectionFailureMode: 'none' | 'auth' | 'unavailable' = 'none';

function userCollection(username: string): StubInstance[] {
  const existing = collections.get(username);
  if (existing) return existing;
  const fresh: StubInstance[] = [];
  collections.set(username, fresh);
  return fresh;
}

function makeInstance(releaseId: number, overrides: Partial<StubInstance> = {}): StubInstance {
  instanceCounter += 1;
  return {
    instance_id: instanceCounter,
    folder_id: 1,
    rating: 0,
    date_added: new Date().toISOString(),
    basic_information: { id: releaseId, title: `Stub Release ${releaseId}`, year: 2000 },
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
  return makeInstance(Number(seed.releaseId), { rating: Number(seed.rating ?? 0), notes });
}

/** Handles /__stub/* control endpoints (never part of the Discogs API). */
async function handleControlRequest(req: any, res: any, url: URL): Promise<boolean> {
  if (url.pathname === '/__stub/reset' && req.method === 'POST') {
    collections.clear();
    collectionFailureMode = 'none';
    json(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === '/__stub/failure' && req.method === 'POST') {
    const body = await readJsonBody(req);
    collectionFailureMode = (body.mode as typeof collectionFailureMode) ?? 'none';
    json(res, 200, { ok: true });
    return true;
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

/**
 * Routes /users/:username/collection/* and /__stub/* requests. Returns true
 * when the request was handled here.
 */
async function handleCollectionRequest(req: any, res: any, url: URL): Promise<boolean> {
  if (await handleControlRequest(req, res, url)) return true;

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

  // Catalog endpoints (used by library enrichment when DISCOGS_BASE_URL points here).
  const releaseMatch = /^\/releases\/(\d+)$/.exec(url.pathname);
  if (releaseMatch && req.method === 'GET') {
    json(res, 200, stubRelease(Number(releaseMatch[1])));
    return;
  }

  // Catalog search (used by AddRecordPage).
  if (url.pathname === '/database/search' && req.method === 'GET') {
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
        oauth_token: 'stub-access-token',
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
