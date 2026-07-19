# Data Model: Análisis de calidad de código (CodeQL) y actualización de Node.js en CI

**Feature**: `055-ci-codeql-node-upgrade` | **Date**: 2026-07-19

Esta feature no introduce datos de aplicación (no hay entidades de dominio, ni colecciones en
Firestore). Las "entidades" son configuración declarativa de CI/CD y objetos devueltos por la API de
Code Scanning de GitHub. Se documentan aquí como referencia para la fase de tasks, siguiendo el
`Key Entities` del spec.

## Test job (existente, sin cambios)

| Campo | Valor |
|---|---|
| Identificadores | `backend-test`, `frontend-test`, `e2e-test` |
| Ubicación | `.github/workflows/ci.yml` |
| Resultado relevante | `success` \| `failure` \| `cancelled` |
| Relación | Precondición (`needs`) de cada Deploy job — sin cambios respecto a spec `054` |

## Job de análisis de calidad (`code-quality`, nuevo)

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | `code-quality` |
| Trigger | igual que los test jobs | `pull_request` y `push` a `main` — sin `needs` (corre en paralelo a los tests, ver research.md §9) |
| `permissions` | objeto | `security-events: write`, `contents: read`, `actions: read` (research.md §2) |
| Steps | secuencia fija | `actions/checkout@v5` → `github/codeql-action/init@v4` (`languages: javascript-typescript`, `build-mode: none`, `queries: security-and-quality`) → `github/codeql-action/analyze@v4` (`category: /language:javascript-typescript`, `wait-for-processing: true` por defecto) → step de verificación de severidad (`gh api`) |
| Resultado observable | `success` \| `failure` \| `skipped` | `failure` si el step de verificación detecta alertas Critical/High abiertas para el `ref` actual (FR-003) |
| Relación | Nueva precondición (`needs`) de los 4 Deploy jobs, junto a los 3 test jobs existentes |

## Alerta CodeQL (objeto de la API de Code Scanning, no persistido por esta feature)

| Campo | Tipo | Descripción |
|---|---|---|
| `rule.security_severity_level` | `low` \| `medium` \| `high` \| `critical` \| `null` | Severidad de seguridad; **solo `critical`/`high` bloquean el despliegue** (FR-003). `null` cuando la query no tiene score de seguridad asociado (alertas puramente de calidad). |
| `rule.severity` | `none` \| `note` \| `warning` \| `error` \| `null` | Severidad de calidad/mantenibilidad de la query (independiente de `security_severity_level`, ver research.md §4) — **no bloquea el despliegue** bajo esta especificación, solo se reporta. |
| `state` | `open` \| `closed` \| `dismissed` \| `fixed` | Solo las `open` cuentan para el bloqueo. |
| `most_recent_instance.ref` | string | `refs/heads/main` (push) o `refs/pull/<n>/merge` (pull_request) — usado para filtrar alertas del commit/PR actual (`github.ref`). |
| `html_url` | string | Enlace a la alerta en la pestaña Security del repo — útil para el mensaje de error del step de verificación. |

## Deploy job (existente, `needs` modificado)

| Campo | Cambio |
|---|---|
| `needs` (4 jobs: `deploy-production-backend`, `deploy-production-frontend`, `deploy-preview-backend`, `deploy-preview-frontend`) | `[backend-test, frontend-test, e2e-test]` → `[backend-test, frontend-test, e2e-test, code-quality]` |
| Resto de campos (`if`, `environment`, `concurrency`, steps) | Sin cambios respecto a spec `054-gate-deploys-on-passing-tests` |

## Acción de GitHub Actions (configuración, versión modificada)

| Acción | Antes | Después | Jobs afectados |
|---|---|---|---|
| `actions/cache` | `@v4` | `@v6` | `e2e-test` |
| `actions/setup-java` | `@v4` | `@v5` | `e2e-test` |
| `actions/upload-artifact` | `@v4` | `@v6` | `e2e-test` |
| `actions/github-script` | `@v7` | `@v8` | `deploy-preview-backend`, `deploy-preview-frontend` |
| `actions/setup-node` (input `node-version`) | `20` | `24` | `backend-test`, `frontend-test`, `release`, los 4 deploy jobs (`e2e-test` ya estaba en `24`) |

## Relaciones

```
Test job (×3) ──needs──┐
                        ├──▶ Deploy job (×4)
Code-quality job (nuevo)┘
Code-quality job ──analiza──▶ código JS/TS del repo (backend/, frontend/, e2e/, scripts/)
Code-quality job ──consulta (gh api)──▶ Code Scanning Alerts API ──filtra por──▶ ref + severity (critical|high) + state=open
```

No hay transiciones de estado persistentes ni almacenamiento propio de esta feature: las alertas
CodeQL las persiste y gestiona GitHub (pestaña Security del repo), no la aplicación. El único
"estado" relevante para el pipeline es el resultado (`success`/`failure`/`skipped`) de la ejecución
actual, visible en el resumen del run de GitHub Actions.
