# Vinylmania

A web application for vinyl record collectors to manage and organize their
personal vinyl library.

## Stack

- **Frontend**: React + TypeScript (Vite) — [frontend/](frontend/)
- **Backend**: Express.js + TypeScript — [backend/](backend/)
- **Auth & data**: Firebase Authentication (Google sign-in) + Firestore
- **Vinyl catalog data**: [Discogs API](https://www.discogs.com/developers/) client — [backend/src/discogs/](backend/src/discogs/), setup guide at [specs/002-discogs-api-client/quickstart.md](specs/002-discogs-api-client/quickstart.md)
- **Caching**: [TanStack Query](https://tanstack.com/query) for frontend state caching and Redis (via ioredis) for backend Discogs response caching — see [specs/011-tanstack-redis-caching/quickstart.md](specs/011-tanstack-redis-caching/quickstart.md)
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
