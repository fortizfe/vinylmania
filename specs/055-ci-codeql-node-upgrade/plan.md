# Implementation Plan: Análisis de calidad de código (CodeQL) y actualización de Node.js en CI

**Branch**: `055-ci-codeql-node-upgrade` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-ci-codeql-node-upgrade/spec.md`

## Summary

Añadir un job nuevo `code-quality` a `.github/workflows/ci.yml` que ejecuta GitHub CodeQL
(Advanced/custom setup, `github/codeql-action/init@v4` + `analyze@v4`, lenguaje
`javascript-typescript`, `build-mode: none`, query set `security-and-quality`) en paralelo a los
tres jobs de test existentes, seguido de un step que consulta la API de Code Scanning Alerts y falla
el job si hay alertas abiertas con `security_severity_level` Critical o High. Los 4 jobs de
despliegue existentes (spec `054`) pasan a depender también de `code-quality` vía `needs`, igual que
ya dependen de los tests. En paralelo, se corrige el warning de deprecación de Node.js 20 reportado
en `e2e-test`: se actualizan las acciones cuyo propio `action.yml` aún declara `node20`
(`actions/cache@v4`→`@v6`, `actions/setup-java@v4`→`@v5`, y dos acciones adicionales identificadas en
research que comparten la misma causa raíz pero no aparecían en el log pegado por el usuario —
`actions/upload-artifact@v4`→`@v6`, `actions/github-script@v7`→`@v8`), y se alinea el input
`node-version` de `actions/setup-node` a `24` en los 7 jobs que aún usaban `20`, igualando a
`e2e-test`.

## Technical Context

**Language/Version**: YAML (GitHub Actions workflow syntax) + Node.js 24 (alineado en todos los
jobs tras esta feature, ver research.md §8)

**Primary Dependencies**: `github/codeql-action` (`init`/`analyze`, v4), GitHub CLI (`gh`,
preinstalado en `ubuntu-latest`, usado para consultar la API de Code Scanning Alerts), GitHub REST
API de Code Scanning (`/repos/{owner}/{repo}/code-scanning/alerts`)

**Storage**: N/A (las alertas CodeQL las persiste y gestiona GitHub, no esta feature)

**Testing**: Sin harness de test unitario propio (YAML declarativo), igual que en spec `054`.
Validación mediante los `Independent Test` del spec, formalizados como pasos manuales reproducibles
en `quickstart.md`. El job `lint-workflows` (actionlint) ya existente desde spec `054` cubre
automáticamente la sintaxis del job nuevo y de los `needs` modificados sin necesidad de una nueva
mitigación (ver Constitution Check).

**Target Platform**: GitHub Actions (`ubuntu-latest`), GitHub Code Scanning (gratuito en este repo
por ser público)

**Project Type**: Web application — cambio de infraestructura CI/CD, sin tocar código de aplicación
(`backend/src`, `frontend/src`, `e2e/`)

**Performance Goals**: SC-003 — el tiempo total del pipeline no debe aumentar en más de un 20%
respecto al actual; se logra ejecutando `code-quality` en paralelo a los tests, no en serie
(research.md §9)

**Constraints**: Solo alertas `security_severity_level` Critical/High bloquean el despliegue
(FR-003); el query set `security-and-quality` también genera alertas de calidad sin ese campo, que
no deben bloquear (research.md §4); cero avisos de deprecación de Node.js en cualquier job (FR-006)

**Scale/Scope**: 1 job nuevo (`code-quality`, 4 steps) en un único fichero de workflow ya existente;
`needs` de 4 jobs de despliegue modificado (+1 elemento cada uno); 4 acciones con versión
actualizada; 7 jobs con `node-version` alineado a `24`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Aplica | Estado |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Sí, pero sin equivalente directo (YAML de CI, no código de app) | **Desviación documentada y aceptada, mismo precedente que spec `054`** — el job `lint-workflows` (actionlint) ya existente cubre automáticamente la sintaxis del job nuevo sin necesidad de una mitigación adicional; ver Complexity Tracking |
| II. Discogs Integration-First & Modularity | No (no toca metadata de catálogo) | N/A |
| III. Simplicity, YAGNI & KISS | Sí | Cumple — reutiliza el patrón `needs` ya existente en vez de un mecanismo de gating nuevo (ruleset); `build-mode: none` evita instalar dependencias del proyecto en el job de análisis (research.md §2); un único job sin matrix, dado que el repo es 100% JS/TS |
| IV. SOLID Design | Parcial (no es código OO, pero aplica el espíritu de responsabilidad única) | Cumple — `code-quality` tiene una única responsabilidad (análisis + gate de severidad), separada de los jobs de test y de despliegue |
| V. Observability | Sí | Cumple — alertas visibles en Security → Code scanning (FR-002) y resultado del job visible en el resumen del run, igual que los tests |
| VI. Versioning & Breaking Changes | No (sin cambios de schema/contrato de datos) | N/A |
| VII. Curated Ratings & Music News | No | N/A |
| VIII. Hexagonal Architecture (backend/) | No (no toca `backend/src`) | N/A |
| IX. Frontend Network Requests — Backend-Only | No (no toca `frontend/src`) | N/A |
| Tech Stack — Deployment (Vercel vía GitHub) | Sí | Sin conflicto — el mecanismo de despliegue en sí (spec `054`) no cambia, solo su precondición `needs` |
| Dev Workflow — e2e obligatorio en PRs que tocan `/frontend` | No aplica: esta feature no modifica `frontend/src`, solo `.github/workflows/ci.yml` | N/A |
| Dev Workflow — Conventional Commits / no CHANGELOG manual | Sí, para la implementación | Aplica sin desviación (gate de PR, no de diseño) |

**Resultado**: Gate superado con una única desviación documentada (Principio I), ya mitigada por el
job `lint-workflows` heredado de spec `054` — no se requiere ninguna mitigación nueva.

## Project Structure

### Documentation (this feature)

```text
specs/055-ci-codeql-node-upgrade/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── code-quality-job.md  # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Esta feature es configuración, no código de aplicación: no se crea ni modifica ningún directorio
`src/`, `models/`, `services/` o `tests/`. El único fichero que cambia es:

```text
.github/workflows/
└── ci.yml                # MODIFICADO:
                           #   + 1 job nuevo `code-quality` (CodeQL init/analyze +
                           #     step de verificación de severidad)
                           #   + `code-quality` añadido a `needs` de los 4 deploy jobs
                           #     (deploy-preview-backend, deploy-preview-frontend,
                           #     deploy-production-backend, deploy-production-frontend)
                           #   ~ actions/cache@v4 → @v6 (e2e-test)
                           #   ~ actions/setup-java@v4 → @v5 (e2e-test)
                           #   ~ actions/upload-artifact@v4 → @v6 (e2e-test)
                           #   ~ actions/github-script@v7 → @v8 (deploy-preview-*)
                           #   ~ node-version: 20 → 24 en actions/setup-node@v5
                           #     (backend-test, frontend-test, release, 4 deploy jobs;
                           #     e2e-test ya estaba en 24)
                           #   Jobs backend-test, frontend-test, e2e-test y release NO
                           #   cambian su lógica de test/build, solo lo listado arriba
```

**Structure Decision**: No aplica ninguna de las opciones estándar (single project / web app con
`backend`+`frontend` fuente / mobile+API) porque esta feature no añade código de aplicación — solo
extiende el workflow de CI ya existente (modificado por última vez en spec `054`). La estructura
`backend/` + `frontend/` + `e2e/` del repo permanece intacta.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principio I (Test-First) no se aplica en su forma literal (Red-Green-Refactor con un test automatizado que falle antes del cambio) | `.github/workflows/ci.yml` es YAML declarativo interpretado por GitHub Actions; no hay ningún framework de test en este repo capaz de ejecutar/simular un workflow de Actions con `needs`/`if`/permisos reales de forma unitaria — mismo razonamiento ya aceptado en spec `054` | Escribir un test "unitario" a mano (parsear el YAML y aserciones sobre su estructura) validaría sintaxis, no el comportamiento real de gating por severidad (que depende de la API de Code Scanning y de la evaluación de GitHub Actions en runners reales) — daría falsa confianza. La validación real solo es observable ejecutando el workflow, documentada como pasos reproducibles en `quickstart.md`. A diferencia de spec `054` (que tuvo que *añadir* `lint-workflows` como mitigación nueva), esta feature hereda esa mitigación ya existente: `lint-workflows` corre sobre el `ci.yml` completo en cada push/PR, por lo que cubre automáticamente la sintaxis del job `code-quality` y de los `needs` modificados sin trabajo adicional. Desviación aceptada bajo el mismo precedente que spec `054` |
