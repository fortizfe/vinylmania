# Data Model: Despliegues de Vercel condicionados al éxito de los tests

**Feature**: `054-gate-deploys-on-passing-tests` | **Date**: 2026-07-19

Esta feature no introduce datos de aplicación (no hay entidades de dominio, ni colecciones en
Firestore, ni contratos de API de negocio). Las "entidades" son configuración declarativa de CI/CD.
Se documentan aquí como referencia para la fase de tasks, siguiendo el `Key Entities` del spec.

## Test job (existente, sin cambios)

| Campo | Valor |
|---|---|
| Identificadores | `backend-test`, `frontend-test`, `e2e-test` |
| Ubicación | `.github/workflows/ci.yml` |
| Resultado relevante | `success` \| `failure` \| `cancelled` |
| Relación | Es la precondición (`needs`) de cada Deploy job |

## Deploy job (nuevo)

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Uno de: `deploy-preview-backend`, `deploy-preview-frontend`, `deploy-production-backend`, `deploy-production-frontend` |
| `needs` | string[] | Siempre `[backend-test, frontend-test, e2e-test]` (FR-005) |
| `if` | expresión | Condición de disparo (ver tabla siguiente) |
| `environment` (Vercel) | `preview` \| `production` | Determina flags `--prod` en `vercel build`/`vercel deploy` |
| `project` (Vercel) | `backend` \| `frontend` | Determina qué par `VERCEL_PROJECT_ID_*` / directorio de trabajo se usa |
| `concurrency.group` | string | Solo en los jobs de producción: `deploy-production-backend` / `deploy-production-frontend` (FR consistente con Edge Case de pushes consecutivos) |
| Resultado observable | `success` \| `failure` \| `skipped` | `skipped` cuando `needs` no se satisface (User Story 3 / FR-006) |

**Condiciones (`if`) por job**:

| Job | Evento | Condición adicional |
|---|---|---|
| `deploy-preview-backend` / `deploy-preview-frontend` | `pull_request` | `github.event.pull_request.head.repo.full_name == github.repository` (excluye forks, ver Clarifications) |
| `deploy-production-backend` / `deploy-production-frontend` | `push` | `github.ref == 'refs/heads/main'` (mismo criterio que el job `release` existente) |

## Proyecto Vercel (existente, configuración modificada)

| Campo | `backend/vercel.json` | `frontend/vercel.json` |
|---|---|---|
| `git.deploymentEnabled` | `false` (nuevo) | `false` (nuevo) |
| Secrets asociados | `VERCEL_PROJECT_ID_BACKEND` | `VERCEL_PROJECT_ID_FRONTEND` |
| Secrets compartidos | `VERCEL_TOKEN`, `VERCEL_ORG_ID` (ambos proyectos) |

## Relaciones

```
Test job (×3) ──needs──▶ Deploy job (×4)
Deploy job ──autentica con──▶ VERCEL_TOKEN + VERCEL_ORG_ID + VERCEL_PROJECT_ID_{BACKEND|FRONTEND}
Deploy job ──despliega──▶ Proyecto Vercel (backend|frontend) en entorno (preview|production)
```

No hay transiciones de estado persistentes ni almacenamiento: cada ejecución del workflow es
independiente; el único "estado" relevante es el resultado de la ejecución actual, visible en el
resumen del run de GitHub Actions (FR-006).
