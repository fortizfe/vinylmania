# Implementation Plan: Definir y ratificar la arquitectura Hexagonal como Core Principle

**Branch**: `045-hexagonal-architecture-principle` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-hexagonal-architecture-principle/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Ratificar un nuevo Core Principle en `.specify/memory/constitution.md` (siguiente
número romano tras el VII) que fije, en lenguaje MUST/MUST NOT, la arquitectura
Hexagonal (Ports & Adapters) obligatoria para `backend/src`: las capas (dominio,
aplicación, puertos, adaptadores), la regla de dependencia (dominio/aplicación no
importan `firebase-admin`/`axios`/`ioredis`/`rss-parser` directamente), la convención
de carpetas (capas globales `src/domain/`, `src/application/`, `src/ports/`,
`src/adapters/`, con subcarpeta por dominio dentro de cada una), el rol de las rutas
Express como adaptadores "driving", el estatus de los módulos transversales
(logger, utilidad de concurrencia) como excepciones fuera de la regla de dependencia,
y la generalización explícita del patrón de errores de dominio ya existente
(`DiscogsError` y afines). El enfoque técnico es puramente documental: no se escribe
ni modifica código de `backend/src`; el entregable es texto normativo en la
constitution (bump 2.4.0 → 2.5.0, Sync Impact Report actualizado) y la revisión de
`.specify/templates/plan-template.md`/`spec-template.md` frente al nuevo principio.

## Technical Context

**Language/Version**: N/A — cambio puramente documental (Markdown); no se escribe
código de `backend/src` en esta historia.

**Primary Dependencies**: N/A — no se añaden ni modifican dependencias de software.

**Storage**: N/A

**Testing**: No aplica un framework de test automatizado — la validación es manual/
textual: cada criterio de aceptación se verifica leyendo `.specify/memory/constitution.md`
(ver `quickstart.md` para los pasos de verificación concretos).

**Target Platform**: N/A — artefacto de gobernanza del repositorio (Markdown), no
ejecuta en ninguna plataforma.

**Project Type**: Documentación/gobernanza — edición de `.specify/memory/constitution.md`
y revisión de `.specify/templates/*.md`. No es un proyecto "single" ni "web
application" en el sentido del template de plan; no se crea código fuente nuevo.

**Performance Goals**: N/A

**Constraints**: El nuevo principio DEBE seguir el mismo formato (enunciado
MUST/MUST NOT + párrafo **Rationale**) que los Principios I-VII existentes; el bump
de versión DEBE seguir la política ya documentada en la propia constitution (MINOR
para "a new principle... is added"); el Sync Impact Report DEBE seguir el formato ya
usado por la entrada 2.3.0 → 2.4.0.

**Scale/Scope**: 1 fichero normativo (`.specify/memory/constitution.md`, +1 Core
Principle) + revisión de 2 plantillas (`plan-template.md`, `spec-template.md`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Aplica a esta historia | Evaluación |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | No — no se introduce código de producto ni lógica ejecutable | PASS (fuera de alcance por naturaleza documental) |
| II. Discogs Integration-First & Modularity | No — no toca integración Discogs | PASS (no aplica) |
| III. Simplicity, YAGNI & KISS | Sí — el principio nuevo debe ser mínimo y no inventar mecanismos no solicitados | PASS — se limita a codificar decisiones ya tomadas (capas, regla de dependencia, convención de carpetas, patrón de errores existente), sin añadir alcance extra |
| IV. SOLID Design | Indirectamente — el principio *exige* SOLID/DIP en el backend futuro | PASS — el nuevo principio es una extensión operativa del IV existente (dependency inversion vía puertos), no una contradicción |
| V. Observability | No directamente — aunque el edge case de `CachePort`/logger toca observabilidad, esta historia no cambia comportamiento de logging | PASS (no aplica) |
| VI. Versioning & Breaking Changes | Sí — el bump 2.4.0 → 2.5.0 de la constitution está gobernado por esta política | PASS — MINOR, sin cambios rompientes de API/esquema |
| VII. Curated Ratings & Music News | No — dominio no relacionado | PASS (no aplica) |
| Development Workflow — Conventional Commits | Sí — el commit de esta historia debe seguir el formato | PASS — se usa `docs(045): ...` |

**Resultado**: Sin violaciones. No se requiere ninguna entrada en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/045-hexagonal-architecture-principle/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: esta historia no expone ni modifica ninguna API pública ni
contrato externo (ver spec, Fuera de alcance / Assumptions).

### Source Code (repository root)

```text
.specify/
├── memory/
│   └── constitution.md      # EDITADO: +1 Core Principle (Hexagonal Architecture),
│                             # bump 2.4.0 → 2.5.0, Sync Impact Report actualizado
└── templates/
    ├── plan-template.md     # REVISADO: comprobar si necesita un gate de
    │                         # cumplimiento arquitectónico para features de backend
    └── spec-template.md     # REVISADO: igual que arriba

backend/src/                 # NO SE MODIFICA en esta historia (ver Fuera de alcance
                              # del spec) — el nuevo principio lo regula, pero la
                              # migración real es objeto de historias posteriores
```

**Structure Decision**: Esta historia no sigue ninguna de las opciones estándar
(single project / web application / mobile+API) del template de plan porque no
introduce código fuente: es un cambio de gobernanza documental confinado a
`.specify/memory/constitution.md` y a la revisión de `.specify/templates/*.md`.
`backend/src` queda explícitamente fuera de alcance (lo regula el principio, no lo
modifica esta historia).

## Complexity Tracking

*Sin violaciones de Constitution Check — tabla no aplica.*
