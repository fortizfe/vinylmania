/**
 * Minimal stand-in for Google's OAuth 2.0 endpoints so e2e runs never touch
 * the real Google (which cannot be scripted in CI). The backend is pointed
 * here via GOOGLE_OAUTH_BASE_URL / GOOGLE_TOKEN_BASE_URL /
 * GOOGLE_USERINFO_BASE_URL in the e2e environment — see
 * contracts/google-login-api.md's "External calls" table for the shapes
 * this must honor, and discogsOauthStub.ts for the sibling pattern this
 * mirrors.
 *
 * Run directly with `node helpers/googleOauthStub.ts`.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('node:http');

const PORT = Number(process.env.GOOGLE_STUB_PORT ?? 4572);

const DEFAULT_EMAIL = 'e2e-google-user@example.com';
const DEFAULT_NAME = 'E2E Google User';

// Approve → a one-shot authorization code bound to the submitted identity.
const grantsByCode = new Map<string, { email: string; name: string; picture: string }>();
// Token exchange → a one-shot-ish access token bound to that same identity,
// consulted by /v1/userinfo (mirrors real Google's two-hop shape).
const identitiesByAccessToken = new Map<string, { sub: string; email: string; name: string; picture: string }>();

let grantCounter = 0;
let tokenCounter = 0;

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function readFormBody(req: any): Promise<URLSearchParams> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: unknown) => {
      raw += String(chunk);
    });
    req.on('end', () => resolve(new URLSearchParams(raw)));
  });
}

function authorizePageHtml(state: string, redirectUri: string): string {
  const denyUrl = `${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`;
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Google Sign-In Stub</title></head>
  <body>
    <h1>Sign in with Google (stub)</h1>
    <form method="POST" action="/o/oauth2/v2/auth/approve">
      <input type="hidden" name="state" value="${state}" />
      <input type="hidden" name="redirect_uri" value="${redirectUri}" />
      <label>Email <input id="email-input" name="email" value="${DEFAULT_EMAIL}" /></label>
      <label>Name <input id="display-name-input" name="name" value="${DEFAULT_NAME}" /></label>
      <button id="approve" type="submit">Approve</button>
    </form>
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

  if (url.pathname === '/o/oauth2/v2/auth' && req.method === 'GET') {
    const state = url.searchParams.get('state') ?? '';
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(authorizePageHtml(state, redirectUri));
    return;
  }

  if (url.pathname === '/o/oauth2/v2/auth/approve' && req.method === 'POST') {
    const body = await readFormBody(req);
    const state = body.get('state') ?? '';
    const redirectUri = body.get('redirect_uri') ?? '';
    grantCounter += 1;
    const code = `stub-code-${grantCounter}`;
    grantsByCode.set(code, {
      email: body.get('email') || DEFAULT_EMAIL,
      name: body.get('name') || DEFAULT_NAME,
      picture: 'https://example.com/stub-avatar.png',
    });
    const location = `${redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    res.writeHead(302, { Location: location }).end();
    return;
  }

  if (url.pathname === '/token' && req.method === 'POST') {
    const body = await readFormBody(req);
    const code = body.get('code') ?? '';
    const grant = grantsByCode.get(code);
    if (!grant) {
      json(res, 400, { error: 'invalid_grant' });
      return;
    }
    grantsByCode.delete(code);
    tokenCounter += 1;
    const accessToken = `stub-access-token-${tokenCounter}`;
    identitiesByAccessToken.set(accessToken, {
      sub: `stub-sub-${tokenCounter}`,
      email: grant.email,
      name: grant.name,
      picture: grant.picture,
    });
    json(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
    return;
  }

  if (url.pathname === '/v1/userinfo' && req.method === 'GET') {
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    const identity = identitiesByAccessToken.get(accessToken);
    if (!identity) {
      json(res, 401, { error: 'invalid_token' });
      return;
    }
    json(res, 200, identity);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`google oauth stub listening on http://localhost:${PORT}`);
});
