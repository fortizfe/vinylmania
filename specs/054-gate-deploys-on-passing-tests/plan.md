# Implementation Plan: Despliegues de Vercel condicionados al éxito de los tests

**Branch**: `054-gate-deploys-on-passing-tests` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/054-gate-deploys-on-passing-tests/spec.md`

## Summary

Hoy los despliegues de Vercel (preview en cada PR, producción en cada push a `main`) los dispara la
integración nativa Git de Vercel de forma totalmente independiente del pipeline de GitHub Actions —
por eso un test roto no impide un deploy. La solución: (1) desactivar el auto-deploy nativo de cada
proyecto Vercel (`git.deploymentEnabled: false` en `backend/vercel.json` y `frontend/vercel.json`),
y (2) añadir 4 jobs nuevos a `.github/workflows/ci.yml` (`deploy-preview-backend`,
`deploy-preview-frontend`, `deploy-production-backend`, `deploy-production-frontend`), cada uno con
`needs: [backend-test, frontend-test, e2e-test]` —el mismo patrón que ya usa el job `release`— que
despliegan vía Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`) solo cuando
los tres jobs de test han terminado en éxito. El proyecto sigue enlazado a GitHub (solo se apaga el
disparo automático), por lo que los deployments creados por CLI se siguen asociando al commit/PR.

## Technical Context

**Language/Version**: YAML (GitHub Actions workflow syntax) + Node.js 20 (consistente con el resto
de `ci.yml`, usado solo para instalar la Vercel CLI vía npm)

**Primary Dependencies**: Vercel CLI (`vercel@latest`, invocada en cada job nuevo), GitHub Actions
(`actions/checkout`), integración Git de Vercel↔GitHub ya existente (para asociación commit/PR)

**Storage**: N/A

**Testing**: Sin harness de test unitario propio (YAML declarativo). Validación mediante los
`Independent Test` del spec, formalizados como pasos manuales reproducibles en `quickstart.md`
(rama/PR con test roto → confirmar no-deploy → arreglar → confirmar deploy). Ver research.md §8 y
Complexity Tracking más abajo para la justificación frente al Principio I.

**Target Platform**: GitHub Actions (`ubuntu-latest`), Vercel (proyectos `backend` y `frontend`
existentes, spec `005-vercel-separate-projects`)

**Project Type**: Web application — cambio de infraestructura CI/CD, sin tocar código de aplicación
(`backend/src`, `frontend/src`, `e2e/`)

**Performance Goals**: SC-002 — el tiempo total push/apertura-de-PR → deployment `Ready` no debe
superar en más de un 20% el tiempo actual equivalente

**Constraints**: Ningún secret en texto plano ni en logs (FR-007); reutilizar el patrón `needs`
existente del job `release` (FR-005); PRs desde forks fuera de alcance (Clarifications); no romper
la garantía de orden ya provista por `concurrency: group: release-main` para pushes consecutivos a
`main` (Edge Cases)

**Scale/Scope**: 2 proyectos Vercel × 2 entornos (preview/producción) = 4 jobs de deploy nuevos + 1
job `lint-workflows` (mitigación de Principio I) en un único fichero de workflow ya existente; 2
ficheros `vercel.json` modificados (1 línea cada uno); 1 fichero de documentación actualizado
(`docs/deployment-vercel.md`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Aplica | Estado |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Sí, pero sin equivalente directo (YAML de CI, no código de app) | **Desviación documentada y aceptada explícitamente por el responsable del proyecto** (Fernando Ortiz, 2026-07-19) — mitigada parcialmente con un job `actionlint` automatizado; ver Complexity Tracking |
| II. Discogs Integration-First & Modularity | No (no toca metadata de catálogo) | N/A |
| III. Simplicity, YAGNI & KISS | Sí | Cumple — 4 jobs explícitos en vez de `matrix` + indirección de secrets (research.md §4); reutiliza el patrón `needs`/`concurrency` de `release` en vez de inventar uno nuevo |
| IV. SOLID Design | Parcial (no es código OO, pero aplica el espíritu de responsabilidad única) | Cumple — cada job tiene una única responsabilidad (un proyecto × un entorno) |
| V. Observability | Sí | Cumple — FR-006 exige visibilidad del resultado (éxito/fallo/skipped) en el resumen del run |
| VI. Versioning & Breaking Changes | No (sin cambios de schema/contrato de datos) | N/A |
| VII. Curated Ratings & Music News | No | N/A |
| VIII. Hexagonal Architecture (backend/) | No (no toca `backend/src`) | N/A |
| IX. Frontend Network Requests — Backend-Only | No (no toca `frontend/src`) | N/A |
| Tech Stack — Deployment (Vercel vía GitHub) | Sí | Refuerza el principio: "Deployments SHOULD be triggered from GitHub (e.g., via GitHub integration/CI)" — esta feature es exactamente eso |
| Dev Workflow — e2e obligatorio en PRs que tocan `/frontend` | No aplica: esta feature no modifica `frontend/src`, solo `frontend/vercel.json` (config) | N/A |
| Dev Workflow — Conventional Commits / no CHANGELOG manual | Sí, para la implementación | Aplica sin desviación (gate de PR, no de diseño) |

**Resultado**: Gate superado con una única desviación documentada (Principio I), justificada en
Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/054-gate-deploys-on-passing-tests/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── deploy-jobs.md   # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Esta feature es configuración, no código de aplicación: no se crea ni modifica ningún directorio
`src/`, `models/`, `services/` o `tests/`. Los ficheros existentes que cambian son:

```text
.github/workflows/
└── ci.yml                # MODIFICADO: + 4 jobs de deploy (deploy-preview-backend,
                           #   deploy-preview-frontend, deploy-production-backend,
                           #   deploy-production-frontend) + 1 job lint-workflows
                           #   (actionlint, mitigación de Principio I); jobs de test
                           #   (backend-test, frontend-test, e2e-test) y el job release
                           #   NO cambian

backend/
└── vercel.json            # MODIFICADO: + "git": { "deploymentEnabled": false }

frontend/
└── vercel.json            # MODIFICADO: + "git": { "deploymentEnabled": false }

docs/
└── deployment-vercel.md   # MODIFICADO: documentar el nuevo flujo de despliegue vía
                           #   Actions, git.deploymentEnabled: false, y los 4 secrets
                           #   nuevos (ver tasks.md T013)
```

**Structure Decision**: No aplica ninguna de las opciones estándar (single project / web app con
`backend`+`frontend` fuente / mobile+API) porque esta feature no añade código de aplicación — solo
extiende el workflow de CI ya existente y la configuración de despliegue de los dos proyectos
Vercel ya creados por la spec `005-vercel-separate-projects`. La estructura `backend/` + `frontend/`
+ `e2e/` del repo permanece intacta.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principio I (Test-First) no se aplica en su forma literal (Red-Green-Refactor con un test automatizado que falle antes del cambio) | `.github/workflows/ci.yml` es YAML declarativo interpretado por GitHub Actions; no hay ningún framework de test en este repo capaz de ejecutar/simular un workflow de Actions con `needs`/`if`/`concurrency` reales de forma unitaria | Escribir un test "unitario" a mano (p. ej. parsear el YAML y aserciones sobre su estructura) validaría sintaxis, no el comportamiento real de gating (que depende de la evaluación de GitHub Actions en runners reales) — daría falsa confianza sin cubrir lo que el spec realmente exige. La validación real solo es observable ejecutando el workflow, que es exactamente lo que documentan los `Independent Test` de cada User Story del spec y los pasos reproducibles de `quickstart.md` (push/PR con test roto → confirmar no-deploy → arreglar → confirmar deploy). Como mitigación parcial (dado que Principio I está marcado NON-NEGOTIABLE), se añade un job `lint-workflows` (`actionlint`) a `ci.yml` que sí corre en cada push/PR y falla de forma automática ante errores de sintaxis/expresión en los jobs nuevos — no sustituye la validación de comportamiento real, pero da al menos un gate automatizado donde antes no había ninguno. Desviación aceptada explícitamente por el responsable del proyecto tras la revisión de `/speckit-analyze` (2026-07-19) |
