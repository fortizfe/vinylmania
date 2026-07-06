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

function urlencoded(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
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

const server = createServer((req: any, res: any) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
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
