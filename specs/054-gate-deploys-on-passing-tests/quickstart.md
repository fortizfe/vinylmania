# Quickstart: Validar despliegues condicionados al éxito de los tests

**Feature**: `054-gate-deploys-on-passing-tests` | **Date**: 2026-07-19

Guía de validación manual end-to-end, alineada con los `Independent Test` de cada User Story del
spec. No sustituye a `tasks.md` (que definirá los pasos de implementación); esto es lo que hay que
ejecutar para confirmar que la feature ya implementada funciona.

## Prerequisitos

1. Acceso de administración a los proyectos Vercel `backend` y `frontend` (Assumptions del spec).
2. GitHub Secrets creados a nivel de repositorio: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID_BACKEND`, `VERCEL_PROJECT_ID_FRONTEND` (ver `research.md` §3).
3. `git.deploymentEnabled: false` añadido a `backend/vercel.json` y `frontend/vercel.json` (ver
   `contracts/deploy-jobs.md`).
4. Los 4 jobs nuevos (`deploy-preview-backend`, `deploy-preview-frontend`,
   `deploy-production-backend`, `deploy-production-frontend`) añadidos a `.github/workflows/ci.yml`.

## Paso 1 — Producción bloqueada si un test falla (User Story 1, P1)

1. Crear una rama, romper a propósito un test (backend, frontend o e2e — probar al menos uno).
2. Abrir PR y mergear a `main` (o hacer push directo a `main` si el flujo del repo lo permite).
3. En la pestaña Actions, confirmar: el job de test roto termina en `failure`, y
   `deploy-production-backend` / `deploy-production-frontend` aparecen como **Skipped**.
4. Confirmar en el dashboard de Vercel que **no** se creó un deployment de producción para ese commit.

**Esperado**: SC-001 (cero deployments para commits con tests en rojo) cumplido para este caso.

## Paso 2 — Producción se despliega cuando los tests pasan

1. Arreglar el test roto del Paso 1, hacer push a `main`.
2. Confirmar que `backend-test`, `frontend-test`, `e2e-test` terminan en verde.
3. Confirmar que `deploy-production-backend` y `deploy-production-frontend` se ejecutan y terminan en
   `success`.
4. Confirmar en el dashboard de Vercel que ambos proyectos tienen un deployment nuevo en estado
   `Ready` para ese commit.
5. Medir el tiempo entre el push y el estado `Ready` de ambos deployments; comparar contra el
   tiempo histórico actual (antes del cambio) — no debe superarlo en más de un 20% (SC-002).

## Paso 3 — Preview bloqueado si un test falla (User Story 2, P2)

1. Abrir un PR (desde una rama del propio repo, no un fork) con un test roto a propósito.
2. Confirmar que `deploy-preview-backend` / `deploy-preview-frontend` aparecen como **Skipped**.
3. Confirmar que no aparece ningún check/comentario de preview de Vercel en el PR.

## Paso 4 — Preview se genera cuando los tests pasan, y es visible en el PR

1. Arreglar el test del Paso 3, hacer push al mismo PR.
2. Confirmar que los 3 jobs de test y los 2 jobs `deploy-preview-*` terminan en verde.
3. **Punto a verificar manualmente** (research.md §5, el único paso de esta feature con
   incertidumbre operativa real): comprobar que la URL de preview aparece automáticamente como
   check o comentario en el PR, generada por la integración Git de Vercel (sin paso custom).
   - Si **no** aparece automáticamente → ver "Paso 6 (fallback)" más abajo.

## Paso 5 — Motivo de bloqueo visible sin entrar a Vercel (User Story 3, P3)

1. Repetir el Paso 1 o el Paso 3 (test roto).
2. Desde la pestaña Actions → resumen del run, confirmar que el job de deploy correspondiente
   muestra "Skipped" con su dependencia (`needs`) apuntando al job de test que falló.
3. Cronometrar cuánto tarda alguien sin contexto previo en identificar qué test falló mirando solo
   esa pantalla — debe ser menos de 1 minuto (SC-003).

## Paso 6 (fallback, solo si el Paso 4.3 falla)

Si la URL de preview no aparece automáticamente en el PR, añadir un step
`actions/github-script` al final de `deploy-preview-backend`/`deploy-preview-frontend` que capture
la URL de salida de `vercel deploy --prebuilt` y publique un comentario en el PR con esa URL
(patrón documentado en `research.md` §5, "Alternatives considered").

## Edge cases a verificar además de los pasos anteriores

- **Cancelación manual de un test job**: cancelar `e2e-test` manualmente durante un run en `main`;
  confirmar que ambos `deploy-production-*` quedan en Skipped igual que si hubiera fallado.
- **Re-run tras fallo**: sobre un run con un test en rojo, usar "Re-run failed jobs" tras arreglar el
  código; confirmar que los deploy jobs se re-evalúan y proceden si el resultado final es verde.
- **Pushes consecutivos a `main`**: hacer dos pushes seguidos con pocos segundos de diferencia;
  confirmar que los deployments de producción de cada proyecto no se solapan ni terminan fuera de
  orden (grupo de concurrencia `deploy-production-backend`/`deploy-production-frontend`).
- **Commit `[skip ci]` del job `release`**: confirmar que el commit de version-bump que genera
  `release` no dispara una segunda ejecución del workflow ni un deployment adicional.
- **PR desde un fork**: abrir (o simular) un PR desde un fork; confirmar que no se ejecuta ningún
  `deploy-preview-*` para ese PR (fuera de alcance, ver Clarifications del spec).
