# Research: Definir y ratificar la arquitectura Hexagonal como Core Principle

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No quedan `NEEDS CLARIFICATION` en el Technical Context del plan (todos los campos son
N/A por la naturaleza puramente documental de esta historia). Las clarificaciones de
alcance ya se resolvieron en `/speckit-clarify` (ver `spec.md` § Clarifications). Este
documento consolida las decisiones de redacción/formato necesarias para escribir el
nuevo Core Principle de forma consistente con la constitution existente.

## Decisión 1: Numeración y formato del nuevo principio

- **Decision**: El nuevo principio se añade como **VIII. Hexagonal Architecture
  (Ports & Adapters)**, inmediatamente después del Principio VII, con el mismo
  formato exacto que I-VII: encabezado `### VIII. <Título>`, cuerpo en lenguaje
  MUST/MUST NOT, y un párrafo final `**Rationale**:`.
- **Rationale**: Los 7 principios existentes siguen ese patrón sin excepción
  (verificado leyendo `constitution.md` completo); romper el formato en el primer
  principio nuevo que se añade sentaría un precedente inconsistente.
- **Alternatives considered**: Insertarlo como sub-sección del Principio IV (SOLID
  Design) — rechazado explícitamente por decisión previa del usuario (ver HU origen:
  "no como ampliación del Principio IV existente"), ya que SOLID es un principio de
  diseño de código en general, mientras que Hexagonal Architecture es una decisión de
  arquitectura de capas/dependencias más amplia y específica del backend.

## Decisión 2: Convención de carpetas por capas

- **Decision**: Capas globales a nivel de `backend/src` (`src/domain/`,
  `src/application/`, `src/ports/`, `src/adapters/`), con una subcarpeta por dominio
  dentro de cada una (p. ej. `src/domain/library/`, `src/adapters/library/`,
  `src/ports/library/`).
- **Rationale**: Decisión ya tomada explícitamente por el usuario en
  `/speckit-clarify` (ver `spec.md` § Clarifications). Mantiene una separación de
  capas visible a nivel de todo el backend, coherente con el resto de historias de
  migración por dominio (2-6), que añadirán su propia subcarpeta dentro de cada capa
  global sin reestructurar las de otros dominios ya migrados.
- **Alternatives considered**: Capas anidadas dentro de cada carpeta de dominio
  (`library/domain`, `library/adapters`, ...) — más alineada con la organización
  actual del código (por dominio), pero descartada por el usuario a favor de la
  visibilidad de capas a nivel global. Híbrido (solo puertos/adaptadores
  transversales globales, dominio/aplicación por dominio) — descartado por añadir una
  regla de excepción adicional que la opción elegida no necesita.

## Decisión 3: Estatus de módulos transversales sin dependencias de infraestructura

- **Decision**: `config/logger.ts` y `shared/concurrency.ts` (`mapWithConcurrency`)
  no requieren una excepción "shared kernel" declarada expresamente en el principio;
  se documentan como utilidades transversales que ya cumplen la regla de dependencia
  por no importar ningún SDK de infraestructura, consumibles desde cualquier capa sin
  pasar por un puerto.
- **Rationale**: Decisión ya tomada en `/speckit-clarify`. Introducir un concepto de
  excepción declarada para algo que ya cumple la regla general violaría Simplicity/
  YAGNI (Principio III) — no hay necesidad real de una categoría nueva.
- **Alternatives considered**: Declarar explícitamente un "shared kernel" con reglas
  propias — descartado por sobre-especificar algo que no genera ambigüedad real.

## Decisión 4: Cómo referenciar el patrón de errores de dominio ya existente

- **Decision**: El principio cita por nombre la jerarquía `DiscogsError` (con `code`
  tipado: `not_found`/`rate_limited`/`unavailable`/`validation_error`/`auth_failed`),
  `DiscogsNotLinkedError`, `FieldNotEditableError`, `DiscogsOauthFlowError`, y las
  funciones de traducción a HTTP que solo viven en las rutas
  (`respondCollectionError`, `handleFailure`) como el patrón de referencia ya conforme
  con Ports & Adapters para el manejo de errores de dominio.
- **Rationale**: La HU origen verifica (leyendo código real) que este patrón ya
  separa correctamente errores de dominio de su mapeo HTTP; codificarlo explícitamente
  evita que las historias de migración de dominio (2-6) inventen un mecanismo
  alternativo de manejo de errores.
- **Alternatives considered**: Describir el patrón de forma genérica sin citar los
  nombres concretos — rechazado porque el criterio de aceptación 5 de la Historia 1
  exige citarlo explícitamente para que sea verificable sin ambigüedad.

## Decisión 5: Formato del Sync Impact Report

- **Decision**: Reemplazar el comentario existente al principio de
  `constitution.md` (que documenta 2.3.0 → 2.4.0) por uno nuevo que documente
  2.4.0 → 2.5.0, con las mismas secciones: `Version change`, `Modified principles`,
  `Added sections`, `Changed sections`, `Removed sections`, `Templates requiring
  updates` (con ✅/⚠ por plantilla), `Follow-up TODOs`.
- **Rationale**: Es el formato que el propio fichero ya usa consistentemente (única
  entrada visible documenta el bump anterior); reutilizarlo mantiene el historial de
  amendments legible y auditable.
- **Alternatives considered**: Mantener ambas entradas (2.3.0→2.4.0 y 2.4.0→2.5.0) en
  el comentario — rechazado porque el patrón actual solo conserva la entrada más
  reciente (el historial completo vive en `git log`, no en el comentario).

## Decisión 6: Revisión de plantillas (`plan-template.md`, `spec-template.md`)

- **Decision**: Revisar si alguna de las dos plantillas necesita un gate explícito de
  "¿esta feature de backend respeta el Principio VIII (Hexagonal Architecture)?" en su
  sección de Constitution Check / Requirements. Este mismo `plan.md` ya incorpora ese
  gate de forma ad-hoc en su tabla de Constitution Check (ver arriba); si el patrón se
  repite en próximas features de backend, se añadirá una fila fija en
  `plan-template.md`.
- **Rationale**: Igual que el resto de Sync Impact Reports existentes, que
  comprueban explícitamente cada plantilla y documentan "sin cambios necesarios"
  cuando no aplica.
- **Alternatives considered**: Añadir el gate a las plantillas ya en esta historia —
  se decide en Phase 1 / al redactar el Sync Impact Report definitivo, no en research,
  para evaluarlo con el texto final del principio ya escrito.

## Resumen

Todas las decisiones necesarias para redactar el Core Principle están tomadas. No
quedan puntos abiertos que bloqueen Phase 1 (data-model.md, quickstart.md) ni la
redacción final del principio durante la implementación (`/speckit-tasks` →
`/speckit-implement`).
