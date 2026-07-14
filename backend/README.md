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

## Testing

`npm test` wraps the Jest suite in `firebase emulators:exec` and bounds the
whole run so it never hangs indefinitely (see
[`specs/042-firebase-emulator-reliability`](../specs/042-firebase-emulator-reliability/)):

- A `pretest` step checks the fixed Auth (`9099`) / Firestore (`8080`)
  emulator ports aren't already held by a concurrent `backend` or `e2e`
  test run on the same machine, and fails fast with a clear message if so.
- Emulator startup plus the entire Jest run is bounded by a shared
  cross-platform wrapper (`../scripts/run-with-timeout.js`, chosen over the
  POSIX `timeout`/`gtimeout` coreutils since those aren't installed by
  default on macOS) — if that ceiling is hit, the whole process group
  (including the Firestore emulator's JVM child) is signaled `SIGTERM` then,
  after a short grace period, `SIGKILL`, instead of leaving the emulator's
  own shutdown routine to hang.
- Each `test()`/hook has an explicit `testTimeout` (`jest.config.js`), and
  `--detectOpenHandles --forceExit` ensure a leaked socket/timer is reported
  and the process still exits promptly once all tests finish.
- Direct emulator calls in `tests/helpers/authEmulator.ts` each carry their
  own `AbortSignal.timeout(...)`, independent of the surrounding test's
  timeout.

**First run on a new machine**: the wrapper's timeout is sized for the
steady-state (emulator binary already cached) case. Before relying on
`npm test`, pre-warm the Firestore emulator's cache once:

```bash
npx firebase emulators:start --only auth,firestore
# wait for "All emulators ready", then Ctrl+C
```

This downloads `cloud-firestore-emulator-*.jar` into
`~/.cache/firebase/emulators/` once; every `npm test` after that reuses it.
