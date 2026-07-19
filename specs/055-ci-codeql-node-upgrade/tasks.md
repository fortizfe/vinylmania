---

description: "Task list for feature 055-ci-codeql-node-upgrade"
---

# Tasks: Análisis de calidad de código (CodeQL) y actualización de Node.js en CI

**Input**: Design documents from `/specs/055-ci-codeql-node-upgrade/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/code-quality-job.md, quickstart.md

**Tests**: No se solicitan tests automatizados nuevos que cubran el *comportamiento* de gating (el
spec no los pide y `plan.md` documenta, en Complexity Tracking, por qué esta feature no tiene
equivalente unitario para eso: es YAML declarativo de CI, no código de aplicación — mismo
razonamiento que spec `054`). El job `lint-workflows` (actionlint) ya existente desde spec `054`
cubre automáticamente la sintaxis de los cambios de esta feature sin ninguna tarea adicional. La
validación de comportamiento real es manual vía los pasos de `quickstart.md`, referenciados como
tareas explícitas dentro de cada fase.

**Organization**: Tareas agrupadas por user story (US1 = P1, US2 = P2), según spec.md. No hay fases
Setup/Foundational: ambas user stories son independientes entre sí y no requieren ningún recurso
externo nuevo (CodeQL usa el `GITHUB_TOKEN` por defecto; el repo ya es público, por lo que Code
Scanning está disponible sin configuración previa — ver quickstart.md, Prerequisitos).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (fichero distinto, sin dependencias)
- **[Story]**: A qué user story pertenece (US1, US2)
- Todas las tareas de esta feature modifican el **mismo fichero** (`.github/workflows/ci.yml`), así
  que ninguna lleva `[P]` entre sí aunque varias sean lógicamente independientes (mismo criterio ya
  usado en spec `054`, para evitar conflictos de edición secuencial sobre el mismo fichero)

## Path Conventions

Este repo es una web app con `backend/` + `frontend/` + `e2e/` ya existentes (ver plan.md). Esta
feature no añade código de aplicación: modifica únicamente `.github/workflows/ci.yml` y, en Polish,
`docs/deployment-vercel.md` (ver plan.md → Project Structure).

---

## Phase 3: User Story 1 - Bloquear despliegues cuando el análisis de calidad de código falla (Priority: P1) 🎯 MVP

**Goal**: Cada pull request y cada push a `main` pasa por un análisis CodeQL (`security-and-quality`)
que bloquea los 4 jobs de despliegue si detecta alertas abiertas de severidad Critical o High.

**Independent Test**: Introducir en una rama una vulnerabilidad detectable por CodeQL (p. ej. una
construcción de "Command Injection" conocida) y abrir un PR; confirmar que el check de CodeQL
aparece en rojo y que ningún job de despliegue se ejecuta para ese commit. Corregir el problema y
confirmar que el check pasa a verde y los despliegues preview se ejecutan.

### Implementation for User Story 1

- [X] T001 [US1] Añadir el job `code-quality` a `.github/workflows/ci.yml`: trigger igual que
      `backend-test`/`frontend-test`/`e2e-test` (sin `needs` propio); `permissions:
      security-events: write, contents: read, actions: read`; steps `actions/checkout@v5` →
      `github/codeql-action/init@v4` (`languages: javascript-typescript`, `build-mode: none`,
      `queries: security-and-quality`) → `github/codeql-action/analyze@v4`
      (`category: /language:javascript-typescript`) (contracts/code-quality-job.md, job
      `code-quality`, steps 1-3)
- [X] T002 [US1] Añadir el step "Fail on Critical/High CodeQL alerts" al final del job `code-quality`
      en `.github/workflows/ci.yml`: `gh api "repos/${{ github.repository }}/code-scanning/alerts?
      ref=${{ github.ref }}&state=open" --paginate` con `env: GH_TOKEN: ${{ github.token }}`, filtrar
      con `jq` por `.rule.security_severity_level == "critical" or .rule.security_severity_level ==
      "high"`, imprimir `rule.description` + `html_url` de cada alerta encontrada y terminar con
      `exit 1`; sin resultados, el step termina en éxito (contracts/code-quality-job.md, job
      `code-quality`, step 4 — depende de T001 por ser el mismo job)
- [X] T003 [US1] Actualizar `needs` de `deploy-production-backend`, `deploy-production-frontend`,
      `deploy-preview-backend` y `deploy-preview-frontend` en `.github/workflows/ci.yml`, de
      `[backend-test, frontend-test, e2e-test]` a
      `[backend-test, frontend-test, e2e-test, code-quality]` en los 4 jobs (contracts/
      code-quality-job.md, sección "Deploy jobs — contrato modificado" — depende de que `code-quality`
      exista como job válido, T001)
- [ ] T004 [US1] Ejecutar Paso 1 y Paso 2 de `quickstart.md` (validación manual: confirmar que
      `code-quality` corre en paralelo a los tests y su check es visible en el PR/commit; introducir
      una vulnerabilidad detectable a propósito → confirmar `code-quality` en `failure` y los 4 jobs
      de despliegue en "Skipped" con `needs` apuntando a `code-quality`; revertir el cambio →
      confirmar `success` y que los despliegues preview se ejecutan)
- [ ] T005 [US1] Ejecutar Paso 3 de `quickstart.md` (validación manual: introducir un hallazgo de
      calidad sin `security_severity_level` — p. ej. una variable sin usar — y confirmar que aparece
      en Security → Code scanning pero que `code-quality` termina en `success` y los despliegues
      preview se ejecutan con normalidad; FR-003 solo bloquea Critical/High)

**Checkpoint**: User Story 1 (P1) completa y verificable de forma independiente — MVP entregable.

---

## Phase 4: User Story 2 - Eliminar los avisos de deprecación de Node.js en CI (Priority: P2)

**Goal**: Ningún job de `.github/workflows/ci.yml` muestra avisos de deprecación de Node.js 20, y
todos los jobs que definen `node-version` para el runtime del proyecto usan la misma versión (24).

**Independent Test**: Ejecutar el workflow completo (incluido, si es posible, provocar a propósito un
fallo del e2e para disparar el step condicional de artefactos) y revisar el log de cada job;
confirmar que no aparece ningún mensaje "Node.js 20 is deprecated" ni equivalente en ninguno.

### Implementation for User Story 2

- [X] T006 [US2] En el job `e2e-test` de `.github/workflows/ci.yml`, bump `actions/cache@v4` →
      `actions/cache@v6` en los dos steps que lo usan (caché de binarios del emulador Firebase y
      caché de navegadores Playwright) (research.md §7, contracts/code-quality-job.md, "Contrato de
      versiones de acciones")
- [X] T007 [US2] En el job `e2e-test` de `.github/workflows/ci.yml`, bump `actions/setup-java@v4` →
      `actions/setup-java@v5` (research.md §7)
- [X] T008 [US2] En el job `e2e-test` de `.github/workflows/ci.yml`, bump `actions/upload-artifact@v4`
      → `actions/upload-artifact@v6` en el step "Upload e2e failure artifacts" (`if: failure()`) —
      acción no mencionada en el warning original del usuario porque ese step solo corre si el e2e
      falla, pero comparte la misma causa raíz (research.md §7)
- [X] T009 [US2] En los jobs `deploy-preview-backend` y `deploy-preview-frontend` de
      `.github/workflows/ci.yml`, bump `actions/github-script@v7` → `actions/github-script@v8` en el
      step "Comment preview URL on PR" — acción no mencionada en el warning original del usuario
      porque vive en jobs distintos de `e2e-test`, pero comparte la misma causa raíz (research.md §7)
- [X] T010 [US2] En `.github/workflows/ci.yml`, cambiar el input `node-version: 20` → `node-version:
      24` de `actions/setup-node@v5` en los jobs `backend-test`, `frontend-test`, `release`,
      `deploy-production-backend`, `deploy-production-frontend`, `deploy-preview-backend` y
      `deploy-preview-frontend` (7 jobs); `e2e-test` ya usa `24`, sin cambios ahí (research.md §8)
- [ ] T011 [US2] Ejecutar Paso 4 de `quickstart.md` (validación manual: revisar el log de los 10 jobs
      del pipeline —cubriendo tanto un PR (7 jobs) como un push a `main` (3 jobs adicionales:
      `release`, `deploy-production-backend`, `deploy-production-frontend`), incluidos el step
      condicional "Upload e2e failure artifacts" forzando un fallo de e2e, y el step "Comment preview
      URL on PR" de un PR interno— y confirmar cero avisos "Node.js 20 is deprecated"; confirmar que
      `backend-test`, `frontend-test` y los 4 deploy jobs corren ahora con `node-version: 24` en el
      log de `actions/setup-node`)
- [ ] T012 [US2] Ejecutar Paso 5.2 de `quickstart.md` (validación manual: correr `npm ci && npm test`
      localmente en `backend/` y `frontend/` con Node 24 instalado, para descartar el riesgo señalado
      en research.md §8 de un `engines` restrictivo no detectado en el research)

**Checkpoint**: User Stories 1 y 2 (P1 + P2) completas y verificables de forma independiente.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Consistencia documental y validación integral de edge cases y criterios de éxito medidos
en ventana temporal, tras completar ambas user stories.

- [X] T013 [P] Actualizar `docs/deployment-vercel.md` (sección "Deployments are gated on CI, not on
      Git push"): donde dice que el despliegue ocurre "only after the three test jobs
      (`backend-test`, `frontend-test`, `e2e-test`) have all passed" y que `needs` referencia esos
      tres jobs, añadir `code-quality` a la lista y enlazar a
      [specs/055-ci-codeql-node-upgrade](../specs/055-ci-codeql-node-upgrade/) junto a la referencia
      ya existente a spec `054`
- [ ] T014 Ejecutar la sección "Edge cases a verificar" de `quickstart.md` completa (PR desde un fork
      ejecuta `code-quality` pero no dispara despliegues; medir el tiempo total del pipeline frente al
      histórico para SC-003; gestionar alertas Critical/High preexistentes que pudiera revelar la
      primera ejecución de `code-quality` sobre el código actual, antes de que cualquier despliegue
      vuelva a funcionar)
- [ ] T015 Verificar SC-001, SC-002 y SC-004 (100% de PRs/pushes con check de `code-quality`; cero
      despliegues para commits con alertas Critical/High; cero avisos de deprecación de Node.js)
      durante las 2 semanas posteriores al cambio: revisar periódicamente el historial de runs de
      Actions — seguimiento operativo, no una tarea de código puntual (mismo patrón que T015/T016 de
      spec `054`)
- [ ] T016 Ejecutar Paso 5, punto 1, de `quickstart.md` (validación manual, FR-008 / User Story 2
      Acceptance Scenario 3 — hallazgo E1 de `/speckit-analyze`: sin esta tarea, la comprobación de
      "cero regresión funcional" no tenía ninguna tarea asociada, solo el sub-punto de `engines`
      cubierto por T012): con un PR "limpio" (sin alertas Critical/High, tests en verde), confirmar
      que el comportamiento completo del pipeline es idéntico al de antes del cambio — los 3 test
      jobs + `code-quality` pasan, los 4 deploy jobs se ejecutan y llegan a `Ready`/`success`, y
      `release` calcula versión/changelog en push a `main` sin verse afectado por `code-quality`

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 3)**: Sin dependencias externas — puede empezar de inmediato. Sin dependencia
  de US2.
- **User Story 2 (Phase 4)**: Sin dependencias externas — puede empezar de inmediato. Sin dependencia
  de US1, aunque comparte el mismo fichero `ci.yml` — implementar en secuencia evita conflictos de
  edición, no por dependencia funcional.
- **Polish (Phase 5)**: Depende de que ambas user stories estén completas. T015 en concreto solo puede
  cerrarse 2 semanas después del despliegue del cambio a `main`.

### Within Each User Story

- **US1**: T001 → T002 (mismo job, el step de verificación se añade al final del job creado en T001)
  → T003 (necesita que `code-quality` exista como nombre de job válido antes de referenciarlo en
  `needs`) → T004 → T005 (validación manual, tras el código).
- **US2**: T006-T010 son ediciones independientes entre sí (jobs/steps distintos), pero secuenciales
  por tocar el mismo fichero (sin `[P]`, mismo criterio que spec `054`) → T011 → T012 (validación
  manual, tras el código).

### Parallel Opportunities

- Ninguna dentro de `ci.yml` (todas las tareas de código de esta feature tocan el mismo fichero, ver
  "Format" arriba).
- T013 (Polish, docs) puede ejecutarse en paralelo con T014/T015/T016 — fichero distinto (`docs/` vs.
  validación manual sin fichero).
- US1 (Phase 3) y US2 (Phase 4) son independientes entre sí y podrían implementarse en cualquier
  orden, o por dos personas distintas coordinando el orden de sus commits sobre `ci.yml`.

---

## Parallel Example: Polish

```bash
Task: "Actualizar docs/deployment-vercel.md para mencionar code-quality en needs"
Task: "Ejecutar la sección 'Edge cases a verificar' de quickstart.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 3: User Story 1 (job `code-quality` + gate de severidad + `needs` de los 4 deploy
   jobs)
2. **STOP y VALIDAR**: ejecutar quickstart.md Paso 1, 2 y 3 de forma independiente
3. Nota: la primera ejecución de `code-quality` sobre el código ya existente puede revelar alertas
   Critical/High preexistentes que bloqueen los despliegues hasta resolverse — ver T014 y
   quickstart.md, "Edge cases a verificar"

### Incremental Delivery

1. User Story 1 → gate de calidad de código → validar → MVP entregable
2. + User Story 2 → cero avisos de Node.js, `node-version` alineado → validar
3. Polish → documentación + validación de edge cases + regresión funcional completa (T016) +
   seguimiento de SC-001/SC-002/SC-004 a 2 semanas

---

## Notes

- Todas las tareas de código de esta feature (T001-T003, T006-T010) tocan el mismo fichero
  (`ci.yml`) — sin `[P]` entre ellas a propósito, para evitar conflictos de edición, aunque US1 y US2
  son independientes funcionalmente entre sí.
- Principio I (Test-First) es NON-NEGOTIABLE en la constitución; esta feature no tiene equivalente
  unitario de comportamiento (ver plan.md → Complexity Tracking), pero hereda el gate automatizado de
  sintaxis (`lint-workflows`, `actionlint`) ya existente desde spec `054` sin trabajo adicional.
- Verificar manualmente cada Independent Test antes de dar una user story por completa (no hay suite
  automatizada que valide el comportamiento real, ver plan.md → Complexity Tracking).
- Recordatorio de research.md §4: solo alertas con `security_severity_level` Critical/High bloquean
  el despliegue (T002); alertas de calidad con solo `rule.severity` (`error`/`warning`/`note`) no
  bloquean, aunque el query set `security-and-quality` sí las genere (T005 lo valida explícitamente).
- Hacer commit tras cada tarea o grupo lógico de tareas.
