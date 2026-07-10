# Vinylmania

A modern web app for vinyl record collectors, built around three pillars:
Discogs-powered catalog data, collector ratings, and related music news — with
an editorial focus on rock and metal. Manage your personal vinyl library,
discover releases via Discogs, and keep up with the scene, all in one place.

## Stack

- **Frontend**: React + TypeScript (Vite) — [frontend/](frontend/)
- **Backend**: Express.js + TypeScript — [backend/](backend/)
- **Auth & data**: Firebase Authentication (Google sign-in) + Firestore
- **Vinyl catalog data**: [Discogs API](https://www.discogs.com/developers/) client — [backend/src/discogs/](backend/src/discogs/), setup guide at [specs/002-discogs-api-client/quickstart.md](specs/002-discogs-api-client/quickstart.md)
- **Caching**: [TanStack Query](https://tanstack.com/query) for frontend state caching and Redis (via ioredis) for backend Discogs response caching — see [specs/011-tanstack-redis-caching/quickstart.md](specs/011-tanstack-redis-caching/quickstart.md)
- **Resilience**: automatic retry-with-backoff and a circuit breaker on the backend's Discogs catalog client, absorbing transient rate-limit/outage hiccups — see [specs/029-discogs-retry-resilience/quickstart.md](specs/029-discogs-retry-resilience/quickstart.md)
- **Deployment**: Vercel

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for the
project's governing principles and required stack.

## Local setup

Start with feature 001's guide for Firebase console settings and environment
variables, then run both projects locally:

➡️ [specs/001-landing-google-login/quickstart.md](specs/001-landing-google-login/quickstart.md)

## Manage your library

Once signed in, collectors can search Discogs to add records to their
personal library, view/edit/remove them — see
[specs/003-vinyl-library-crud/quickstart.md](specs/003-vinyl-library-crud/quickstart.md)
for the manual validation script covering the full CRUD flow.

Quick summary:

```bash
# Optional: local Redis for backend response caching (see docker-compose.yml).
# Without it, the backend just falls back to uncached direct fetches.
docker compose up -d redis

# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## Testing

```bash
cd frontend && npm test   # Vitest + React Testing Library
cd backend && npm test    # Jest + Supertest — starts/stops the Firebase emulators itself
cd e2e && npm test        # Playwright — real browser, real Google sign-in bridge (no real Google account); see e2e/README.md
```

## Deployment

Backend and frontend deploy as two independent Vercel projects — see
[docs/deployment-vercel.md](docs/deployment-vercel.md) for the full step-by-step
guide (project creation, environment variables, and verification).

## Contributing

Contributions are welcome in the spirit of this project's open-source,
non-commercial license — bug fixes, features, and documentation improvements
that keep Vinylmania free and open are all appreciated. If your idea involves
a commercial or paid derivative, please read the License section below first.

## License

Vinylmania is source-available under the [GNU Affero General Public License
v3.0](https://www.gnu.org/licenses/agpl-3.0.html), modified by the [Commons
Clause](https://commonsclause.com/) License Condition v1.0 — see
[LICENSE](LICENSE) for the full text.

In short: free to use, modify, and redistribute for non-commercial,
non-business purposes, provided any project incorporating this code remains
open source under the same license. Commercial or for-profit use, resale, or
offering it (or a derivative service) as a paid product is not permitted
without a separate commercial license from the copyright holder.

Interested in a commercial license? Open a [GitHub Issue](https://github.com/fortizfe/vinylmania/issues)
or reach out via the [maintainer's GitHub profile](https://github.com/fortizfe)
to discuss terms.
