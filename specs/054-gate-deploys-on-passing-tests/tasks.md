---

description: "Task list for feature 054-gate-deploys-on-passing-tests"
---

# Tasks: Despliegues de Vercel condicionados al éxito de los tests

**Input**: Design documents from `/specs/054-gate-deploys-on-passing-tests/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/deploy-jobs.md, quickstart.md

**Tests**: No se solicitan tests automatizados nuevos que cubran el *comportamiento* de gating (el
spec no los pide y `plan.md` documenta, en Complexity Tracking, por qué esta feature no tiene
equivalente unitario para eso: es YAML declarativo de CI, no código de aplicación). Como mitigación
parcial de que Principio I está marcado NON-NEGOTIABLE en la constitución (hallazgo C1 de
`/speckit-analyze`), sí se añade un gate automatizado de sintaxis (`actionlint`, T004) — no sustituye
la validación de comportamiento real, que sigue siendo manual vía los pasos de `quickstart.md`,
referenciados como tareas explícitas dentro de cada fase.

**Organization**: Tareas agrupadas por user story (US1 = P1, US2 = P2, US3 = P3), según spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (fichero distinto, sin dependencias)
- **[Story]**: A qué user story pertenece (US1, US2, US3)
- Las tareas de job nuevo en `.github/workflows/ci.yml` (T005, T006, T009, T010) tocan el **mismo
  fichero**, así que ninguna de ellas lleva `[P]` entre sí aunque sean lógicamente independientes
  (evitar conflictos de edición secuencial sobre el mismo fichero)

## Path Conventions

Este repo es una web app con `backend/` + `frontend/` + `e2e/` ya existentes (ver plan.md). Esta
feature no añade código de aplicación: modifica `.github/workflows/ci.yml`, `backend/vercel.json`,
`frontend/vercel.json` y `docs/deployment-vercel.md` (ver plan.md → Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prerrequisitos externos (fuera del repo) sin los que ningún job nuevo puede autenticarse.

- [X] T001 Crear los GitHub Secrets del repositorio (Settings → Secrets and variables → Actions):
      `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_BACKEND`, `VERCEL_PROJECT_ID_FRONTEND`
      (valores obtenidos del dashboard de Vercel / `vercel project ls` con acceso de administración
      a ambos proyectos — ver research.md §3 y Assumptions del spec)

**Checkpoint**: Secrets disponibles para que cualquier job de `ci.yml` pueda autenticarse contra Vercel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Desactivar el auto-deploy nativo de Vercel en ambos proyectos (bloqueante para que los
nuevos jobs de Actions sean la única vía de despliegue, FR-004) y añadir un gate automatizado de
sintaxis sobre `ci.yml` (mitigación del hallazgo C1 de `/speckit-analyze`: Principio I es
NON-NEGOTIABLE en la constitución y esta feature no tiene equivalente unitario de comportamiento —
ver plan.md → Complexity Tracking).

**⚠️ CRITICAL**: Tras completar T002/T003 y antes de que exista al menos el job de US1 (producción),
**no habrá ningún deployment posible** (ni preview ni producción) para ese proyecto, porque
`deploymentEnabled: false` apaga el disparo automático de forma global (no hay distinción nativa
preview/producción en ese flag — ver research.md §1). **Recomendación de rollout**: no dejar esta
fase mergeada en solitario por más tiempo del necesario; agrupar Setup + Foundational + Phase 3 (US1)
en el mismo PR/merge para minimizar la ventana sin despliegues.

- [X] T002 [P] Añadir `"git": { "deploymentEnabled": false }` a `backend/vercel.json`
      (contracts/deploy-jobs.md, sección "Contrato de configuración")
- [X] T003 [P] Añadir `"git": { "deploymentEnabled": false }` a `frontend/vercel.json`
      (contracts/deploy-jobs.md, sección "Contrato de configuración")
- [X] T004 Añadir el job `lint-workflows` a `.github/workflows/ci.yml`: trigger en `pull_request` y
      `push` (sin `needs`), step de checkout + ejecución de `actionlint` sobre
      `.github/workflows/*.yml`, para detectar errores de sintaxis/expresión (p. ej. en el `needs`
      o el `if` de los jobs de deploy que se añaden en las fases siguientes) de forma automática en
      cada cambio (contracts/deploy-jobs.md, sección `lint-workflows`; mitigación de C1)

**Checkpoint**: Auto-deploy nativo desactivado en ambos proyectos y gate de sintaxis activo sobre
`ci.yml` — el workflow de Actions es ahora la única vía de despliegue posible (aunque todavía no
existe ningún job que lo dispare).

---

## Phase 3: User Story 1 - Bloquear el despliegue a producción si los tests fallan (Priority: P1) 🎯 MVP

**Goal**: El despliegue a producción (backend y frontend) solo se dispara tras un push a `main` en
el que los tres jobs de test han terminado en éxito.

**Independent Test**: Push a `main` con un test roto a propósito → confirmar que no se genera
deployment de producción para ese commit; arreglar el test → confirmar que sí se genera.

### Implementation for User Story 1

- [X] T005 [US1] Añadir el job `deploy-production-backend` a `.github/workflows/ci.yml`:
      `needs: [backend-test, frontend-test, e2e-test]`; `if: github.event_name == 'push' &&
      github.ref == 'refs/heads/main'`; `concurrency: { group: deploy-production-backend,
      cancel-in-progress: false }`; steps: checkout → `actions/setup-node` (Node 20) → instalar
      Vercel CLI → `vercel pull --yes --environment=production --token=$VERCEL_TOKEN` →
      `vercel build --prod --token=$VERCEL_TOKEN` → `vercel deploy --prebuilt --prod
      --token=$VERCEL_TOKEN`; env `VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}`,
      `VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_BACKEND }}`; **sin** `working-directory`/
      `--cwd` en los steps de Vercel CLI — se ejecutan desde la raíz del repo, el `rootDirectory`
      ya configurado en el proyecto Vercel resuelve la subcarpeta (ver research.md §2 "Corrección":
      añadir `working-directory: backend` rompía `vercel build` con `spawn npm ENOENT` por doble
      concatenación de `backend/backend`)
      (contracts/deploy-jobs.md, tabla `deploy-production-backend` / `deploy-production-frontend`)
- [X] T006 [US1] Añadir el job `deploy-production-frontend` a `.github/workflows/ci.yml`, igual que
      T005 pero `concurrency.group: deploy-production-frontend`, `VERCEL_PROJECT_ID: ${{
      secrets.VERCEL_PROJECT_ID_FRONTEND }}` (mismo `rootDirectory: frontend` resuelto por Vercel,
      sin `working-directory` en el job)
- [ ] T007 [US1] Ejecutar Paso 1 y Paso 2 de `quickstart.md` (validación manual: test roto en push a
      `main` → confirmar ambos jobs `deploy-production-*` en "Skipped" y sin deployment nuevo en
      Vercel; arreglar el test → confirmar `success` y deployment `Ready` en ambos proyectos; medir
      SC-002). Incluye confirmar que los logs de ambos jobs no muestran el valor de `VERCEL_TOKEN`
      ni de los `VERCEL_PROJECT_ID_*` en texto plano (FR-007)

**Checkpoint**: User Story 1 (P1) completa y verificable de forma independiente — MVP entregable.

---

## Phase 4: User Story 2 - Bloquear el despliegue preview si los tests fallan (Priority: P2)

**Goal**: El despliegue preview (backend y frontend) solo se dispara tras un evento de pull request
interno (no fork) en el que los tres jobs de test han terminado en éxito.

**Independent Test**: Abrir un PR con un test roto a propósito → confirmar que no aparece ningún
deployment preview en los checks del PR; arreglar el test → confirmar que sí aparece.

### Implementation for User Story 2

- [X] T008 [US2] Añadir el job `deploy-preview-backend` a `.github/workflows/ci.yml`:
      `needs: [backend-test, frontend-test, e2e-test]`; `if: github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository`; steps: checkout →
      `actions/setup-node` (Node 20) → instalar Vercel CLI → `vercel pull --yes
      --environment=preview --token=$VERCEL_TOKEN` → `vercel build --token=$VERCEL_TOKEN` →
      `vercel deploy --prebuilt --token=$VERCEL_TOKEN`; env `VERCEL_ORG_ID: ${{
      secrets.VERCEL_ORG_ID }}`, `VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_BACKEND }}`;
      **sin** `working-directory`/`--cwd` (mismo motivo que T005)
      (contracts/deploy-jobs.md, tabla `deploy-preview-backend` / `deploy-preview-frontend`)
- [X] T009 [US2] Añadir el job `deploy-preview-frontend` a `.github/workflows/ci.yml`, igual que
      T008 pero `VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_FRONTEND }}`
- [ ] T010 [US2] Ejecutar Paso 3 y Paso 4 de `quickstart.md` (validación manual: test roto en PR
      interno → confirmar ambos jobs `deploy-preview-*` en "Skipped" y sin check/comentario de
      preview; arreglar el test → confirmar `success` **y verificar explícitamente si el
      check/comentario de la URL de preview aparece automáticamente en el PR** — este es el único
      comportamiento de esta feature con incertidumbre real, ver research.md §5. Incluye confirmar
      que los logs de ambos jobs no muestran el valor de `VERCEL_TOKEN` ni de los
      `VERCEL_PROJECT_ID_*` en texto plano (FR-007))
- [ ] T011 [US2] **Condicional** — solo si T010 confirma que el check/comentario de preview NO
      aparece automáticamente: añadir un step `actions/github-script` al final de
      `deploy-preview-backend` y `deploy-preview-frontend` en `.github/workflows/ci.yml` que capture
      la URL de salida de `vercel deploy --prebuilt` y publique un comentario en el PR (patrón de
      fallback documentado en research.md §5 y quickstart.md Paso 6)

**Checkpoint**: User Stories 1 y 2 (P1 + P2) completas y verificables de forma independiente.

---

## Phase 5: User Story 3 - Visibilidad del motivo de bloqueo (Priority: P3)

**Goal**: Cuando un despliegue no se produce, el motivo (qué test falló) es identificable en menos
de 1 minuto desde la pestaña Actions, sin entrar al dashboard de Vercel.

**Independent Test**: Forzar el fallo de un job de test y comprobar que el job de despliegue
correspondiente aparece como "Skipped" con su dependencia (`needs`) visible en el resumen del run.

### Implementation for User Story 3

- [ ] T012 [US3] Ejecutar Paso 5 de `quickstart.md` (validación manual: repetir un test roto de
      Phase 3 o Phase 4; confirmar en el resumen del run de Actions que el job de deploy
      correspondiente muestra "Skipped" con la dependencia `needs` apuntando al job de test que
      falló; cronometrar que la identificación del motivo toma menos de 1 minuto — SC-003). No
      requiere cambios de código adicionales: el estado "Skipped" es un comportamiento nativo de
      GitHub Actions ya garantizado por los `needs` añadidos en T005/T006/T008/T009.

**Checkpoint**: Las tres user stories (P1, P2, P3) completas y verificables de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistencia documental, seguimiento de los criterios de éxito medidos en ventana
temporal, y validación integral de edge cases tras completar las 3 user stories.

- [X] T013 [P] Actualizar `docs/deployment-vercel.md`: documentar que el auto-deploy nativo de Git
      está desactivado (`git.deploymentEnabled: false`) para ambos proyectos, que los despliegues
      ahora los dispara `.github/workflows/ci.yml` tras los 3 jobs de test, y listar los 4 GitHub
      Secrets nuevos (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_BACKEND`,
      `VERCEL_PROJECT_ID_FRONTEND`) junto a su procedencia (mismo formato que la tabla de secrets
      ya existente en ese fichero)
- [ ] T014 Ejecutar la sección "Edge cases a verificar" de `quickstart.md` completa (cancelación
      manual de un test job, re-run tras fallo, pushes consecutivos a `main`, commit `[skip ci]`
      del job `release`, PR desde un fork)
- [ ] T015 Verificar SC-001 (cero deployments para commits/PRs con al menos un test job en rojo)
      durante las 2 semanas posteriores al cambio: revisar periódicamente el historial de runs de
      Actions y de deployments en Vercel (ambos proyectos) para confirmar que ningún commit/PR con
      un test job fallido generó un deployment — seguimiento operativo, no una tarea de código
      puntual (gap G1 de `/speckit-analyze`: sin esta tarea, SC-001 solo quedaba validado en el
      momento puntual de T007/T010, no durante toda su ventana de medición de 2 semanas)
- [ ] T016 Verificar SC-002 (margen ±20% de tiempo push→Ready) comparando el promedio de las 2
      semanas posteriores al cambio contra el tiempo histórico equivalente — seguimiento operativo,
      no una tarea de código puntual

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato (es trabajo fuera del repo)
- **Foundational (Phase 2)**: T002/T003 dependen de que los secrets de T001 existan antes de que
  cualquier job nuevo (Phase 3+) pueda ejecutarse con éxito, aunque T002/T003/T004 en sí mismos no
  usan esos secrets — BLOQUEA a todas las user stories (ver nota de rollout en Phase 2)
- **User Story 1 (Phase 3)**: Depende de Phase 1 + Phase 2. Sin dependencia de US2/US3.
- **User Story 2 (Phase 4)**: Depende de Phase 1 + Phase 2. Sin dependencia de US1 (T008/T009 no
  requieren que T005/T006 existan), aunque comparten el mismo fichero `ci.yml` — implementar en
  secuencia evita conflictos de merge, no por dependencia funcional.
- **User Story 3 (Phase 5)**: Depende de que exista al menos un job de deploy (T005/T006 o T008/T009)
  contra el que validar el estado "Skipped" — en la práctica, ejecutar después de Phase 3 y/o Phase 4.
- **Polish (Phase 6)**: Depende de que las user stories a incluir en el release estén completas.
  T015/T016 en concreto solo pueden cerrarse 2 semanas después del despliegue del cambio a `main`.

### Within Each User Story

- T005/T006 (US1) y T008/T009 (US2) modifican el mismo fichero (`ci.yml`) → ejecutar de forma
  secuencial, no en paralelo, aunque sean lógicamente independientes. T004 (Foundational) también
  modifica `ci.yml` y debe completarse antes que T005/T006/T008/T009 para evitar conflictos.
- T002/T003 (Foundational) sí son paralelizables entre sí: ficheros distintos
  (`backend/vercel.json` vs `frontend/vercel.json`).

### Parallel Opportunities

- T002 y T003 (Foundational) — ficheros distintos.
- T013 (Polish, docs) puede ejecutarse en paralelo con T014/T015/T016 — fichero distinto (`docs/`
  vs. validación manual sin fichero).

---

## Parallel Example: Foundational

```bash
Task: "Añadir git.deploymentEnabled: false a backend/vercel.json"
Task: "Añadir git.deploymentEnabled: false a frontend/vercel.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (secrets)
2. Completar Phase 2: Foundational (desactivar auto-deploy nativo en ambos proyectos + gate de
   sintaxis `lint-workflows`)
3. Completar Phase 3: User Story 1 (gating de producción)
4. **STOP y VALIDAR**: ejecutar quickstart.md Paso 1 y 2 de forma independiente
5. Nota: tras el paso 4, el preview automático de PRs **deja de funcionar por completo** (efecto
   colateral de Phase 2, ver advertencia ahí) hasta que Phase 4 (US2) se complete — evaluar si este
   MVP se libera solo o junto con US2 antes de mergear a `main`

### Incremental Delivery

1. Setup + Foundational → infraestructura de secrets, auto-deploy nativo desactivado, gate de
   sintaxis activo
2. + User Story 1 → gating de producción → validar → (considerar bundlear con US2 por el efecto
   colateral de Phase 2 sobre previews)
3. + User Story 2 → gating de preview → validar → previews recuperados, ahora gateados
4. + User Story 3 → validación de visibilidad (sin código nuevo) → confirmar SC-003
5. Polish → documentación + validación de edge cases + seguimiento de SC-001 y SC-002 a 2 semanas

---

## Notes

- Todas las tareas de job nuevo en `ci.yml` (T004, T005, T006, T008, T009) tocan el mismo fichero —
  sin `[P]` entre ellas a propósito, para evitar conflictos de edición, aunque son independientes
  funcionalmente.
- El único punto de incertidumbre real de todo el plan (T010/T011) ya tiene su fallback documentado
  de antemano — no debería bloquear la entrega si el comportamiento automático de Vercel no se
  confirma a la primera.
- Principio I (Test-First) es NON-NEGOTIABLE en la constitución; esta feature no tiene equivalente
  unitario de comportamiento (ver plan.md → Complexity Tracking), pero sí incorpora un gate
  automatizado de sintaxis (T004, `actionlint`) como mitigación parcial, tras la revisión de
  `/speckit-analyze`.
- Verificar manualmente cada Independent Test antes de dar una user story por completa (no hay
  suite automatizada que valide el comportamiento real, ver plan.md → Complexity Tracking).
- Hacer commit tras cada tarea o grupo lógico de tareas.
