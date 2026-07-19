# Contrato: Jobs de despliegue en `.github/workflows/ci.yml`

**Feature**: `054-gate-deploys-on-passing-tests` | **Date**: 2026-07-19

Esta feature no expone una API HTTP; su "interfaz" es el contrato del workflow de GitHub Actions
(qué inputs consume cada job nuevo y qué outputs/efectos produce). Se documenta aquí para que
`/speckit-tasks` pueda derivar tareas concretas sin reinterpretar `research.md`.

## Contrato común a los 4 jobs nuevos

**Inputs**:
- `needs: [backend-test, frontend-test, e2e-test]` — el job solo se ejecuta si los tres terminan en
  `success`; en cualquier otro caso (`failure` o `cancelled` de alguno) GitHub Actions lo marca
  automáticamente como `skipped` sin ejecutar sus steps (FR-003, User Story 3).
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID` (comunes) + `VERCEL_PROJECT_ID_BACKEND` o
  `VERCEL_PROJECT_ID_FRONTEND` según el proyecto (FR-007).
- Checkout del commit que disparó el evento (`actions/checkout`).

**Steps (orden fijo)**:
1. `actions/checkout`
2. `npm install --global vercel@latest` (o versión pinneada, ver research.md §2)
3. `vercel pull --yes --environment=<preview|production> --token=$VERCEL_TOKEN` — variables de
   entorno `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` deben estar seteadas antes de este paso.
4. `vercel build [--prod] --token=$VERCEL_TOKEN`
5. `vercel deploy --prebuilt [--prod] --token=$VERCEL_TOKEN`

**Outputs / efectos observables**:
- Un nuevo deployment en el proyecto Vercel correspondiente, en estado `READY` si el comando termina
  con éxito.
- El resultado del job (`success` / `failure` / `skipped`) visible en el resumen del run (FR-006).
- Asociación automática del deployment al commit/PR vía la Git App de Vercel (research.md §5) — sin
  paso custom adicional, salvo que la verificación manual en `quickstart.md` demuestre lo contrario.

## `deploy-preview-backend` / `deploy-preview-frontend`

| Aspecto | Valor |
|---|---|
| Evento | `pull_request` |
| Condición extra | `github.event.pull_request.head.repo.full_name == github.repository` (excluye forks) |
| `working-directory` / `--cwd` | `backend/` o `frontend/` respectivamente |
| `environment` en `vercel pull` | `preview` |
| Flag `--prod` | No |
| `VERCEL_PROJECT_ID` | `secrets.VERCEL_PROJECT_ID_BACKEND` o `secrets.VERCEL_PROJECT_ID_FRONTEND` |

## `deploy-production-backend` / `deploy-production-frontend`

| Aspecto | Valor |
|---|---|
| Evento | `push` |
| Condición extra | `github.ref == 'refs/heads/main'` (mismo criterio que el job `release`) |
| `working-directory` / `--cwd` | `backend/` o `frontend/` respectivamente |
| `environment` en `vercel pull` | `production` |
| Flag `--prod` | Sí, en `build` y `deploy` |
| `VERCEL_PROJECT_ID` | `secrets.VERCEL_PROJECT_ID_BACKEND` o `secrets.VERCEL_PROJECT_ID_FRONTEND` |
| `concurrency.group` | `deploy-production-backend` / `deploy-production-frontend`, `cancel-in-progress: false` |

## `lint-workflows` (nuevo, mitigación Principio I — ver plan.md Complexity Tracking)

| Aspecto | Valor |
|---|---|
| Evento | `pull_request` y `push` (mismo trigger que los jobs de test, sin `needs`) |
| Propósito | Validar sintaxis/expresiones de `.github/workflows/ci.yml` con `actionlint` en cada cambio, incluidos los 4 jobs de deploy nuevos |
| Steps | `actions/checkout` → ejecutar `actionlint` (binario oficial o `reviewdog/action-actionlint`) sobre `.github/workflows/*.yml` |
| Resultado | `failure` si hay errores de sintaxis/expresión (p. ej. `needs` mal escrito, `if` inválido) — visible en el resumen del run igual que cualquier otro job |
| Relación con `needs` de los deploy jobs | Ninguna — es independiente, no bloquea ni es bloqueado por los jobs de test o deploy |

## Contrato de configuración: `vercel.json` (backend y frontend)

**Antes** (ambos ficheros, estado actual):
```json
{
  "rewrites": [ { "source": "/(.*)", "destination": "..." } ]
}
```

**Después** (campo añadido, resto sin cambios):
```json
{
  "git": { "deploymentEnabled": false },
  "rewrites": [ { "source": "/(.*)", "destination": "..." } ]
}
```

Este cambio es el único requisito para satisfacer FR-004: el proyecto permanece enlazado a GitHub
(no se toca la conexión Git en el dashboard), pero deja de auto-desplegar en cada push/PR.
