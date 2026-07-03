# Vinylmania

A web application for vinyl record collectors to manage and organize their
personal vinyl library.

## Stack

- **Frontend**: React + TypeScript (Vite) — [frontend/](frontend/)
- **Backend**: Express.js + TypeScript — [backend/](backend/)
- **Auth & data**: Firebase Authentication (Google sign-in) + Firestore
- **Deployment**: Vercel

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for the
project's governing principles and required stack.

## Local setup

The current feature (landing page + Google sign-in) has a full setup guide,
including which Firebase console settings and environment variables you need
and how to run both projects locally:

➡️ [specs/001-landing-google-login/quickstart.md](specs/001-landing-google-login/quickstart.md)

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
cd backend && npm test    # Jest + Supertest (needs the Firebase emulators running)
cd backend && npm run test:emulators  # runs the emulators and the test suite together
```
