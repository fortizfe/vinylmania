# Quickstart: Validate "Escúchalo en Streaming"

Proves the feature end-to-end. Assumes the standard dev setup (backend on `:3000` with Redis
optional, frontend on `:5173`, Firebase emulator for auth).

## Prerequisites

- `backend/` deps installed; `frontend/` deps installed; `e2e/` deps installed.
- A signed-in session (fake Google sign-in in dev).
- Redis running is **optional** — with it, re-opens are cache hits; without it, every open
  re-resolves (fail-soft), which is fine for validation.

## 1. Backend unit + contract + integration tests

```bash
cd backend && npm test -- streaming
```

Expected: green for
- `unit/streaming/matching.test.ts` — normalisation; UPC result accepted; text result requires
  artist **and** title correspondence; ambiguous → no-match.
- `unit/streaming/storefront.test.ts` — `es-ES→ES`, `en-US→US`, `es→ES`, `pt-BR→BR`, junk→`ES`.
- `unit/streaming/resolveStreamingLinks.test.ts` — per-platform isolation (one resolver throws,
  another still returns); `null` is cached, a throw is not; result order follows resolver order.
- `contract/streaming/streamingLinks.contract.test.ts` — see contract checklist.
- `integration/streaming/itunesSearchAdapter.integration.test.ts` (`nock`) — UPC hit; UPC miss →
  text fallback; text no-match → `null`; `403` → `rate_limited` throw; timeout → `unavailable`
  throw; malformed body → throw (never a bad link).

## 2. Manual backend check

With the server running and a valid session token:

```bash
# A well-known record that IS on Apple Music
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/streaming/links?artist=Metallica&title=Master%20of%20Puppets&barcode=075596060721&locale=es-ES' | jq

# Expected: { "links": [ { "platform": "apple_music", "url": "https://music.apple.com/es/album/..." } ] }

# A record that is NOT on Apple Music (obscure vinyl-only pressing)
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/streaming/links?artist=Some%20Obscure%20Demo%20Band&title=Rehearsal%20Tape%201987&locale=es-ES' | jq

# Expected: { "links": [] }   (no error, no partial link)

# Missing required param
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/streaming/links?title=No%20Artist'
# Expected: 400
```

Re-run the first call and confirm the server log shows a `cache_hit` (if Redis is up) and **no**
new outbound iTunes request (SC-003).

## 3. Frontend component tests

```bash
cd frontend && npm test -- StreamingLinksSection streamingApi
```

Expected: green for
- shows a skeleton while the query is loading (reserved height);
- renders an Apple Music `<a>` with `target="_blank"`, `rel="noopener noreferrer"`, and an
  accessible name ("Escuchar en Apple Music") when the API returns a link;
- renders **nothing** when the API returns `{ links: [] }`, when it errors, and when
  `artist`/`title` are absent;
- derives `barcodes` from `identifiers` where `type === 'Barcode'`;
- `streamingApi` sends `navigator.language` as `locale` and repeats `barcode` params.

## 4. Manual UI check

1. `npm run dev` in `frontend/` and `backend/`; sign in.
2. Search a well-known album (e.g. "Master of Puppets"), open its **release detail page**.
   - The "Escúchalo en streaming" section appears at the bottom; briefly a skeleton, then an Apple
     Music link. Clicking it opens `music.apple.com/...` in a new tab; Vinylmania stays open; no
     audio plays in-app.
3. Open a **master** detail page for the same album — the section resolves via text fallback and
   shows the same kind of link.
4. Open a detail page for an obscure vinyl-only release — the section shows a skeleton, then
   **disappears**; the rest of the page is unaffected; no error text.
5. Open a **library record** detail page and a **wantlist** release detail page — the section
   behaves identically in both.
6. Toggle dark mode and tab through with the keyboard — the link has a visible focus ring, the icon
   meets contrast, the section has a heading. Set `prefers-reduced-motion` and confirm the skeleton
   does not animate distractingly.

## 5. e2e

```bash
cd e2e && npx playwright test streaming-links
```

Expected: with `**/api/streaming/links**` stubbed to return a link, the release detail page shows
the Apple Music link; stubbed to return `{ links: [] }`, no streaming section is present; the
`axe` scan passes on both.

## 6. Extensibility check (design-review, no code)

Confirm that adding `spotifyAdapter` would require **only**:
- a new `adapters/streaming/spotifyAdapter.ts` implementing `StreamingResolverPort`;
- adding it to the resolver array passed to `resolveStreamingLinks` in `streamingRoutes.ts`;
- one row in the frontend platform-metadata map + an icon.

No change to `itunesSearchAdapter.ts`, `resolveStreamingLinks.ts`, `matching.ts`, or
`StreamingLinksSection.tsx`. (SC-008.)
