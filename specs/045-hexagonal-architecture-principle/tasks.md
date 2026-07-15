---

description: "Task list for implementing the Hexagonal Architecture Core Principle"
---

# Tasks: Definir y ratificar la arquitectura Hexagonal como Core Principle

**Input**: Design documents from `/specs/045-hexagonal-architecture-principle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no `contracts/` — this feature exposes no API)

**Tests**: No se solicitan tareas de test automatizado — esta historia es un cambio
normativo/documental sobre `.specify/memory/constitution.md`; su validación es la
guía manual de `quickstart.md` (Polish phase, T013).

**Organization**: El spec define una única User Story (P1); todas las tareas de
implementación quedan bajo esa fase, ya que no hay historias adicionales que
paralelizar en este feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

## Path Conventions

Esta historia no sigue ninguna de las convenciones de código fuente del template
(single/web/mobile): los únicos ficheros afectados son
`.specify/memory/constitution.md` y, condicionalmente,
`.specify/templates/plan-template.md` / `.specify/templates/spec-template.md`. No se
crea código bajo `backend/src` (ver plan.md § Structure Decision).

---

## Phase 1: Setup

**Purpose**: Confirmar el estado base antes de editar la constitution, para que el
diff resultante sea auditable frente al Sync Impact Report existente.

- [ ] T001 Verificar el estado base de `.specify/memory/constitution.md`: versión
  actual `2.4.0`, 7 Core Principles (I-VII), y que el comentario Sync Impact Report
  documenta el cambio `2.3.0 → 2.4.0` (sin editar el fichero todavía; solo confirmar
  baseline antes de T002).

---

## Phase 2: Foundational

**Purpose**: N/A — esta historia tiene una única User Story autocontenida (no hay
infraestructura compartida entre varias historias que construir antes). No se
generan tareas foundational; se pasa directamente a la Fase 3.

---

## Phase 3: User Story 1 - La constitution fija de forma inequívoca qué es "Hexagonal Architecture" (Priority: P1) 🎯 MVP

**Goal**: `.specify/memory/constitution.md` contiene un nuevo Core Principle VIII
(Hexagonal Architecture) que permite, por sí solo, decidir sin ambigüedad si un
fichero de `backend/src` respeta la arquitectura — capas, regla de dependencia,
convención de carpetas, rol de las rutas Express, estatus de módulos transversales,
y el patrón de errores de dominio ya existente citado explícitamente.

**Independent Test**: Leer únicamente `.specify/memory/constitution.md` (sin mirar
código) y ejecutar la prueba de clasificación de `quickstart.md` (paso 4) sobre los 5
ficheros de ejemplo listados allí.

### Implementation for User Story 1

- [ ] T002 [US1] Redactar el encabezado y el cuerpo central del nuevo
  `### VIII. Hexagonal Architecture (Ports & Adapters)` en
  `.specify/memory/constitution.md` (insertado inmediatamente después del Principio
  VII, antes de `## Additional Constraints`): fijar en lenguaje MUST las cuatro capas
  obligatorias (Dominio, Aplicación, Puerto, Adaptador) y la regla de dependencia —
  dominio y aplicación NO DEBEN importar `firebase-admin`, `axios`, `ioredis` ni
  `rss-parser` directamente; solo los adaptadores pueden hacerlo (ver data-model.md §
  Entidad: Capa).
- [ ] T003 [US1] Añadir al cuerpo del Principio VIII (mismo bloque de
  `.specify/memory/constitution.md`) la cláusula sobre adaptadores "driving": las
  rutas Express traducen HTTP ↔ casos de uso de aplicación y NO DEBEN contener
  orquestación de lógica de negocio (depende de T002; mismo fichero, no paralelizable).
- [ ] T004 [US1] Añadir al cuerpo del Principio VIII la convención de carpetas por
  capas globales (`src/domain/`, `src/application/`, `src/ports/`, `src/adapters/`,
  con subcarpeta por dominio dentro de cada una) en
  `.specify/memory/constitution.md` (depende de T002).
- [ ] T005 [US1] Añadir al cuerpo del Principio VIII la cláusula sobre módulos
  transversales sin dependencias de infraestructura (`config/logger.ts`,
  `shared/concurrency.ts`/`mapWithConcurrency`): quedan fuera de la regla de
  dependencia sin necesitar una excepción "shared kernel" declarada, en
  `.specify/memory/constitution.md` (depende de T002).
- [ ] T006 [US1] Añadir al cuerpo del Principio VIII la cláusula de alcance
  explícito: aplica solo a `backend/`, no a `frontend/` ni a `e2e/`, en
  `.specify/memory/constitution.md` (depende de T002).
- [ ] T007 [US1] Redactar el párrafo `**Rationale**:` del Principio VIII en
  `.specify/memory/constitution.md`, citando explícitamente el patrón de errores de
  dominio ya existente (`DiscogsError` con `code` tipado, `DiscogsNotLinkedError`,
  `FieldNotEditableError`, `DiscogsOauthFlowError`, y las funciones de traducción
  `respondCollectionError`/`handleFailure` que solo viven en las rutas) como el
  mecanismo de manejo de errores ya conforme, a preservar y generalizar (depende de
  T002-T006; ver data-model.md § Entidad: Patrón de Error de Dominio).
- [ ] T008 [US1] Bump de versión en `.specify/memory/constitution.md`: actualizar
  `**Version**: 2.4.0` → `2.5.0` y `**Last Amended**` a la fecha real de la amendment
  (depende de T002-T007 estando ya redactados).
- [ ] T009 [US1] Reemplazar el comentario "Sync Impact Report" al inicio de
  `.specify/memory/constitution.md` por uno nuevo que documente `Version change:
  2.4.0 → 2.5.0`, `Modified principles: none`, `Added sections: Principio VIII
  (Hexagonal Architecture)`, dejando pendientes de marcar las entradas de
  `Templates requiring updates` hasta T012 (depende de T008).
- [ ] T010 [P] [US1] Revisar `.specify/templates/plan-template.md` frente al
  Principio VIII: si necesita un gate explícito de "¿esta feature de backend respeta
  el Principio VIII?", añadirlo (siguiendo el patrón ya usado ad-hoc en
  `specs/045-hexagonal-architecture-principle/plan.md` § Constitution Check); si no
  lo necesita, no modificar el fichero.
- [ ] T011 [P] [US1] Revisar `.specify/templates/spec-template.md` frente al
  Principio VIII: aplicar el mismo criterio que T010 (añadir gate si aplica, o dejar
  sin cambios).
- [ ] T012 [US1] Completar la fila `Templates requiring updates` del Sync Impact
  Report en `.specify/memory/constitution.md` con el resultado real de T010 y T011
  (✅ "sin cambios necesarios" o la descripción del gate añadido a cada plantilla)
  (depende de T009, T010, T011).

**Checkpoint**: En este punto, el Principio VIII existe completo, versionado, con su
Sync Impact Report cerrado y las plantillas revisadas — la User Story 1 (única
historia de este feature) es completa y verificable de forma independiente.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validación final end-to-end de la historia completa.

- [ ] T013 Ejecutar los 6 pasos de `specs/045-hexagonal-architecture-principle/quickstart.md`
  contra el `.specify/memory/constitution.md` final y registrar el resultado de cada
  paso (versión/fecha, Sync Impact Report, existencia y formato del Principio VIII,
  prueba de clasificación sin ambigüedad sobre los 5 ficheros de ejemplo, cláusula de
  alcance, plantillas revisadas).
- [ ] T014 Si algún paso de T013 falla o queda ambiguo, corregir la redacción
  correspondiente del Principio VIII en `.specify/memory/constitution.md` y repetir
  T013 hasta que los 6 pasos pasen.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar inmediatamente.
- **Foundational (Phase 2)**: No aplica — no hay tareas.
- **User Story 1 (Phase 3)**: Depende de T001 (Setup). Es la única historia de este
  feature, así que no hay otras historias con las que coordinar prioridad.
- **Polish (Phase 4)**: Depende de que la Fase 3 esté completa (T002-T012).

### Within User Story 1

- T002 bloquea a T003, T004, T005, T006 (todas amplían el mismo bloque de texto que
  T002 crea) — no son paralelizables entre sí porque editan el mismo fichero en el
  mismo bloque.
- T007 depende de que T002-T006 ya estén redactados (el Rationale cierra el
  principio).
- T008 (bump de versión) depende de que el contenido del principio esté cerrado
  (T002-T007).
- T009 (Sync Impact Report, primera pasada) depende de T008.
- T010 y T011 son independientes entre sí (ficheros distintos) y pueden ejecutarse en
  paralelo; no dependen de T002-T009, solo del contenido final del Principio VIII
  (T007) para saber contra qué revisar.
- T012 depende de T009, T010 y T011 (consolida su resultado en el mismo fichero que
  T009 ya tocó).

### Parallel Opportunities

- T010 y T011 pueden ejecutarse en paralelo (ficheros distintos:
  `plan-template.md` vs. `spec-template.md`).
- El resto de tareas de la Fase 3 son secuenciales por tocar el mismo fichero
  (`.specify/memory/constitution.md`) en el mismo bloque de texto.

---

## Parallel Example: User Story 1

```bash
# Una vez el Principio VIII está redactado (tras T007), lanzar en paralelo:
Task: "Revisar .specify/templates/plan-template.md frente al Principio VIII"
Task: "Revisar .specify/templates/spec-template.md frente al Principio VIII"
```

---

## Implementation Strategy

### MVP First (única historia)

1. Completar Fase 1: Setup (T001).
2. Fase 2 (Foundational) no aplica — se salta.
3. Completar Fase 3: User Story 1 (T002-T012) — el Principio VIII queda redactado,
   versionado y con Sync Impact Report cerrado.
4. **STOP and VALIDATE**: ejecutar Fase 4 (T013-T014) contra `quickstart.md`.
5. Con los 6 pasos de `quickstart.md` en verde, la historia está lista para PR/merge
   — esto desbloquea la planificación de las Historias 2-6 (migración por dominio) de
   la HU origen.

### Incremental Delivery

No aplica en el sentido habitual (una sola historia, no hay historias adicionales
que añadir incrementalmente en este feature) — el "incremento" real es que esta
historia, una vez mergeada, desbloquea las siguientes historias de la HU
(`specs/046-...` en adelante, una por dominio), que consumirán el Principio VIII como
referencia normativa.

---

## Notes

- [P] tasks = ficheros distintos, sin dependencias entre sí.
- No hay tareas de test automatizado: esta historia no introduce código ejecutable
  (ver plan.md § Technical Context, Testing: N/A).
- Commitear tras completar cada fase (Setup, User Story 1, Polish), no tarea por
  tarea, dado que T002-T009 son ediciones incrementales del mismo bloque de texto en
  el mismo fichero.
- Evitar: reabrir el debate sobre nombres de puertos concretos (`LibraryRepositoryPort`,
  `DiscogsCatalogPort`, `CachePort`, etc.) — están fuera de alcance de esta historia
  (ver spec.md § Assumptions).
