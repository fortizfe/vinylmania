# Quickstart: Validar CodeQL como puerta de calidad y la actualización de Node.js en CI

**Feature**: `055-ci-codeql-node-upgrade` | **Date**: 2026-07-19

Guía de validación manual end-to-end, alineada con los `Independent Test` de cada User Story del
spec. No sustituye a `tasks.md` (que definirá los pasos de implementación); esto es lo que hay que
ejecutar para confirmar que la feature ya implementada funciona.

## Prerequisitos

1. Code Scanning / CodeQL disponible en el repositorio (gratuito en repos públicos, sin
   configuración previa en Settings necesaria para el flujo Advanced/custom — el propio workflow lo
   habilita al ejecutarse por primera vez).
2. Job `code-quality` añadido a `.github/workflows/ci.yml` (ver `contracts/code-quality-job.md`).
3. `needs` de los 4 jobs de despliegue actualizado para incluir `code-quality`.
4. Versiones de acciones actualizadas (`actions/cache@v6`, `actions/setup-java@v5`,
   `actions/upload-artifact@v6`, `actions/github-script@v8`) y `node-version: 24` alineado en todos
   los jobs que usan `actions/setup-node` (ver `contracts/code-quality-job.md`, última sección).

## Paso 1 — El análisis CodeQL se ejecuta y es visible (User Story 1, Acceptance Scenario 1)

1. Abrir un PR cualquiera (o hacer push a `main`).
2. En la pestaña Actions, confirmar que el job `code-quality` aparece y se ejecuta junto a
   `backend-test`/`frontend-test`/`e2e-test`, sin esperarlos (en paralelo).
3. Confirmar que el check de `code-quality` queda visible en los checks del commit/PR, igual que los
   de test.

## Paso 2 — Una alerta Critical/High bloquea el despliegue (User Story 1, Acceptance Scenarios 2 y 3)

1. En una rama de prueba, introducir una construcción insegura conocida y detectable por CodeQL
   (p. ej. en un endpoint Express del backend, concatenar un parámetro de request directamente en una
   llamada a `child_process.exec` sin sanitizar — patrón clásico de "Command Injection" que las
   queries de seguridad de CodeQL para JS/TS detectan).
2. Abrir un PR con ese cambio.
3. Confirmar que el job `code-quality` termina en `failure` (step "Fail on Critical/High CodeQL
   alerts") y que la alerta aparece en Security → Code scanning con severidad Critical o High.
4. Confirmar que los 2 jobs de despliegue preview de este PR (`deploy-preview-backend`,
   `deploy-preview-frontend`) aparecen como **Skipped**, con su dependencia (`needs`) señalando a
   `code-quality`.
5. Revertir el cambio inseguro en el mismo PR (push nuevo).
6. Confirmar que `code-quality` pasa a `success` y que los jobs de despliegue preview se ejecutan.
7. **Nota sobre el path de producción** (`deploy-production-backend`/`deploy-production-frontend`):
   este paso no lo ejercita directamente porque esos jobs solo disparan en push a `main`, no en PR.
   No se considera necesario repetir el paso 1-6 contra un push a `main` porque T003 aplica el mismo
   diff de `needs` (`+ code-quality`) a los 4 jobs de despliegue por igual (contracts/
   code-quality-job.md) y GitHub Actions evalúa `needs` de forma idéntica para cualquier job,
   independientemente de su evento disparador — verificar el comportamiento en los 2 jobs preview es
   evidencia suficiente de que los 2 jobs de producción se comportan igual ante el mismo `needs`.

## Paso 3 — Alertas Medium/Low o de calidad no bloquean (Edge Case)

1. Introducir a propósito un hallazgo de calidad sin severidad de seguridad asociada (p. ej. una
   variable declarada y nunca usada, detectable por las queries de `security-and-quality`).
2. Abrir un PR con ese cambio.
3. Confirmar que la alerta aparece en Security → Code scanning, pero que el job `code-quality`
   termina en `success` y los despliegues preview se ejecutan con normalidad.

## Paso 4 — Cero avisos de deprecación de Node.js (User Story 2, todos los Acceptance Scenarios)

1. Ejecutar el pipeline completo en sus dos contextos de disparo: abrir un PR (dispara los 7 jobs que
   corren en `pull_request`: `backend-test`, `frontend-test`, `e2e-test`, `code-quality`,
   `lint-workflows`, `deploy-preview-backend`, `deploy-preview-frontend`) y, por separado, hacer push
   a `main` (dispara además los 3 jobs que solo corren en `push`: `release`,
   `deploy-production-backend`, `deploy-production-frontend`) — entre ambos eventos se cubren los 10
   jobs del pipeline. Si es posible, provocar a propósito un fallo del e2e en la ejecución del PR
   para que se ejecute también el step condicional "Upload e2e failure artifacts".
2. Revisar el log de los 10 jobs (`backend-test`, `frontend-test`, `e2e-test`, `code-quality`,
   `release`, los 4 deploy jobs, `lint-workflows`) y confirmar que no aparece ningún mensaje
   "Node.js 20 is deprecated" ni equivalente.
3. Confirmar específicamente el step "Upload e2e failure artifacts" (solo visible si el e2e falla) y
   el step "Comment preview URL on PR" de los jobs `deploy-preview-*`, ya que son los dos puntos que
   el research identificó como riesgo de warning latente no cubierto por el log original pegado por
   el usuario (research.md §7).
4. Confirmar que `backend-test`, `frontend-test` y los 4 deploy jobs corren ahora con
   `node-version: 24` (visible en el log del step `actions/setup-node`), igual que `e2e-test`.

## Paso 5 — No hay regresión funcional (FR-008, User Story 2 Acceptance Scenario 3)

1. Con un PR "limpio" (sin alertas Critical/High, tests en verde), confirmar que el comportamiento
   completo del pipeline es idéntico al de antes del cambio: los 3 test jobs + `code-quality` pasan,
   los 4 deploy jobs se ejecutan y llegan a `Ready`/`success`, `release` calcula versión/changelog en
   push a `main` sin verse afectado por `code-quality`.
2. Confirmar que `npm ci && npm test` sigue funcionando localmente en `backend/` y `frontend/` con
   Node 24 (mitigación del riesgo de `engines` señalado en research.md §8).

## Edge cases a verificar además de los pasos anteriores

- **PR desde un fork**: confirmar que `code-quality` se ejecuta igualmente (no depende de secrets),
  pero que los deploy jobs siguen sin ejecutarse para PRs de fork, por el alcance ya definido en la
  spec `054` (no relacionado con `code-quality`, sigue aplicando el filtro de `deploy-preview-*`).
- **Tiempo total del pipeline**: medir el tiempo entre apertura de PR/push y el estado `Ready` de los
  despliegues; comparar contra el tiempo histórico (antes del cambio) — no debe superarlo en más de
  un 20% (SC-003), validando que ejecutar `code-quality` en paralelo (no en serie) cumple su
  propósito.
- **Primera ejecución sobre código ya existente**: la primera vez que `code-quality` corre sobre el
  histórico actual del repo puede revelar alertas preexistentes no relacionadas con el PR que las
  dispara; si aparece alguna Critical/High preexistente, deberá resolverse (o marcarse como
  falso positivo/dismissed en Security → Code scanning) antes de que cualquier despliegue vuelva a
  funcionar — esto es esperado la primera vez, no un fallo de la implementación.
