# Quickstart: Discogs Catalog Client & Data Model

## Prerequisites

- The `backend/` project from feature 001 already set up (`npm install` run
  there at least once).
- A Discogs account (free) with a **Personal Access Token**:
  1. Log in at discogs.com → **Settings → Developers**.
  2. Click **Generate new token**.
  3. Copy the token value — treat it like a password; don't paste it in
     chat/screenshots.

## Environment variables

Add to `backend/.env` (git-ignored; already exists from feature 001):

```
DISCOGS_TOKEN=<your personal access token>
DISCOGS_USER_AGENT=Vinylmania/0.1 +https://github.com/fortizfe/vinylmania
```

`DISCOGS_USER_AGENT` is not secret — it's just an identification string
Discogs asks every client to send (see research.md §4).

## Run the tests

```bash
cd backend

# Fast, offline, no network/rate-limit dependency:
npm test -- discogsClient.contract discogsMapper

# Small, real-network suite against stable public Discogs IDs:
npm test -- discogsClient.live
```

## Validate manually

```bash
cd backend
node -e "
require('dotenv').config();
const { searchCatalog, getRelease, getArtist } = require('./dist/discogs/discogsClient');
(async () => {
  const search = await searchCatalog('Stockholm', { resultType: 'release' });
  console.log('search results:', search.results.slice(0, 3));

  const release = await getRelease(1);
  console.log('release 1:', release.title, release.artists.map(a => a.name));

  const artist = await getArtist(1);
  console.log('artist 1:', artist.name, artist.aliases.length, 'aliases');
})();
"
```

(Run `npm run build` first so `dist/` exists, or adapt the snippet to
`ts-node` for a quick ad-hoc check.)

## Expected outcomes

These map to the spec's acceptance scenarios:

1. **Search (US1)**: `searchCatalog('Stockholm', { resultType: 'release' })`
   returns a non-empty `results` array including "The Persuader - Stockholm"
   (Discogs release ID `1`), each with `title`/`year`/`formats`.
2. **Release detail (US2)**: `getRelease(1)` resolves with the mapped
   `Release` shape — title `"Stockholm"`, at least one artist ("The
   Persuader"), a non-empty `tracklist`.
3. **Artist detail (US3)**: `getArtist(1)` resolves with the mapped `Artist`
   shape — name `"The Persuader"`, `realName` `"Jesper Dahlbäck"`, and a
   non-empty `aliases` list.
4. **Not found**: `getRelease(999999999)` (or another ID confirmed not to
   exist) rejects with `DiscogsNotFoundError`, not a generic error.
5. **Rate limit / unavailable**: cannot be triggered deliberately in a
   quickstart without abusing the real API — covered instead by the
   `nock`-mocked contract tests, which simulate 429/5xx/network-error
   responses directly (see
   [contracts/discogs-client.md](./contracts/discogs-client.md)).
