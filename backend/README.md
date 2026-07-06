# Vinylmania Backend

Express + TypeScript API. See the repository root for project-wide documentation.

## Environment

Configuration is loaded from `backend/.env` (gitignored — never commit real values):

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | prod | Firebase Admin credentials (JSON) |
| `FIREBASE_PROJECT_ID` | yes | Firebase project id |
| `PORT` | no | HTTP port (default 3000) |
| `FRONTEND_ORIGIN` | yes | Comma-separated allowed CORS origins |
| `DISCOGS_TOKEN` | yes | App-level Discogs token for catalog endpoints |
| `DISCOGS_USER_AGENT` | yes | User-Agent sent on every Discogs request |
| `REDIS_URL` | no | Redis connection for response caching |
| `DISCOGS_CONSUMER_KEY` | yes | Discogs OAuth 1.0a consumer key (account linking) |
| `DISCOGS_CONSUMER_SECRET` | yes | Discogs OAuth 1.0a consumer secret (account linking) |
| `DISCOGS_OAUTH_CALLBACK_URL` | yes | Absolute URL of the frontend callback route, e.g. `http://localhost:5173/app/profile/discogs/callback` |
| `DISCOGS_OAUTH_BASE_URL` | test only | Overrides `https://api.discogs.com` for OAuth token/identity endpoints (e2e stub) |
| `DISCOGS_AUTHORIZE_BASE_URL` | test only | Overrides `https://www.discogs.com/oauth/authorize` (e2e stub) |
