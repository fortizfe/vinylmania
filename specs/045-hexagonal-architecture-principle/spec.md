# Feature Specification: Definir y ratificar la arquitectura Hexagonal como Core Principle

**Feature Branch**: `045-hexagonal-architecture-principle`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Historia 1 de la HU `.hu/backend-hexagonal-architecture-refactor.md`: Como Product Owner de Vinylmania, quiero que exista una definición explícita y obligatoria (capas, regla de dependencia, convención de carpetas, y cómo encajan los errores de dominio ya existentes) de qué significa 'Hexagonal Architecture' para este backend, ratificada como nuevo Core Principle en `.specify/memory/constitution.md`, para que sea la referencia única que gobierna tanto la migración del backend (historias de dominio futuras) como cualquier desarrollo backend futuro."

## Clarifications

### Session 2026-07-15

- Q: FR-005: convención de carpetas para las capas hexagonales en backend/src — ¿capas globales o anidadas por dominio? → A: Capas globales a nivel de backend/src (`src/domain/`, `src/application/`, `src/ports/`, `src/adapters/`), con subcarpetas por dominio dentro de cada una.
- Q: `config/logger.ts` no importa ningún SDK externo — ¿cómo lo trata el nuevo principio? → A: No requiere excepción explícita; al no depender de infraestructura externa, ya cumple la regla de dependencia tal cual queda redactada.
- Q: `shared/concurrency.ts` (`mapWithConcurrency`) es una utilidad pura sin dependencias — ¿en qué capa vive? → A: Utilidad transversal fuera de la separación de capas (carpeta neutral, consumible por cualquier capa).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La constitution fija de forma inequívoca qué es "Hexagonal Architecture" para este backend (Priority: P1)

Como Product Owner de Vinylmania, quiero que `.specify/memory/constitution.md` contenga
un nuevo Core Principle dedicado a la arquitectura Hexagonal del backend (capas
obligatorias, regla de dependencia, y cómo encajan los errores de dominio ya
existentes), para que cualquier persona pueda decidir sin ambigüedad si un fichero de
`backend/src` respeta o no la arquitectura, sin tener que preguntar ni inferir el
criterio caso por caso.

**Why this priority**: Es la única historia de la que dependen todas las demás
migraciones de dominio (library, discogs catalog, discogs oauth+collection, feeds,
auth/users) descritas en la HU. Si esta definición no existe primero, cada dominio se
migraría según un criterio distinto y el resultado no sería una arquitectura
consistente, solo varios refactors incompatibles entre sí.

**Independent Test**: Se puede validar leyendo únicamente
`.specify/memory/constitution.md` (sin mirar código) y comprobando que el nuevo
principio permite, por sí solo, decidir sin ambigüedad si un fichero nuevo o existente
del backend cumple o no la arquitectura Hexagonal.

**Acceptance Scenarios**:

1. **Given** la constitution tiene hoy 7 Core Principles y ninguno regula
   capas/puertos/adaptadores, **When** se entrega esta historia, **Then**
   `.specify/memory/constitution.md` incluye un nuevo Core Principle (siguiente número
   romano tras el VII) dedicado a Hexagonal Architecture, con el mismo formato que los
   principios existentes (enunciado en lenguaje MUST/MUST NOT + un párrafo
   **Rationale**).
2. **Given** el nuevo principio fija las capas obligatorias (dominio, aplicación,
   puertos, adaptadores), **When** alguien lee el fichero de un dominio backend
   cualquiera, **Then** puede determinar sin ambigüedad a qué capa pertenece ese fichero
   y qué puede o no importar directamente.
3. **Given** hoy no existe ningún puerto ni adaptador en `backend/src` y el
   dominio/aplicación importa SDKs de infraestructura directamente
   (`firebase-admin`, `axios`, `ioredis`, `rss-parser`), **When** se redacta el
   principio, **Then** este fija en lenguaje MUST que dominio y aplicación NO DEBEN
   importar esos SDKs directamente — solo los adaptadores pueden hacerlo.
4. **Given** las rutas Express hoy mezclan parsing/validación HTTP con orquestación de
   negocio inline, **When** se redacta el principio, **Then** este fija en lenguaje MUST
   que las rutas Express son adaptadores "driving" que traducen HTTP ↔ casos de uso de
   aplicación y no deben contener orquestación de negocio.
5. **Given** el patrón ya existente de errores de dominio separados de su mapeo HTTP
   (jerarquía `DiscogsError` con `code` tipado, `DiscogsNotLinkedError`,
   `FieldNotEditableError`, `DiscogsOauthFlowError`, y funciones de traducción como
   `respondCollectionError`/`handleFailure` que solo viven en las rutas), **When** se
   redacta el principio, **Then** este lo cita explícitamente como el patrón de manejo
   de errores ya conforme con la arquitectura, de forma que las migraciones de dominio
   futuras lo generalicen en vez de sustituirlo por un mecanismo distinto.
6. **Given** la política de versionado ya documentada en la propia constitution ("MINOR:
   A new principle... is added"), **When** se añade el principio, **Then** la versión
   del documento sube de 2.4.0 a 2.5.0, y el campo `**Last Amended**` se actualiza a la
   fecha real de la amendment.
7. **Given** el comentario "Sync Impact Report" al principio del fichero documenta hoy
   el cambio 2.3.0 → 2.4.0, **When** se ratifica el nuevo principio, **Then** ese
   comentario se sustituye por uno que documenta 2.4.0 → 2.5.0 (principio añadido,
   secciones afectadas, comprobación de plantillas), siguiendo el mismo formato que ya
   usa el fichero.
8. **Given** `.specify/templates/plan-template.md` y `.specify/templates/spec-template.md`
   no tienen hoy ninguna referencia a capas de arquitectura backend, **When** se ratifica
   el principio, **Then** se comprueba (mismo paso que ya hace cada Sync Impact Report
   existente) si necesitan una actualización — p. ej. un gate explícito de "¿esta
   feature de backend respeta el nuevo Principio?" — y se actualizan si es así, o se
   marcan explícitamente como "sin cambios necesarios" si no.

---

### Edge Cases

- El principio aplica solo a `backend/`; la constitution ya distingue Frontend/Backend
  en su sección "Technology Stack" — debe quedar explícito que esto no afecta a
  `frontend/` ni a `e2e/`.
- `config/logger.ts` no importa ningún SDK externo (solo `console`) — no requiere una
  excepción explícita: al no depender de infraestructura externa, ya cumple la regla
  de dependencia tal cual queda redactada, sin necesidad de mencionarlo como caso
  especial.
- `shared/concurrency.ts` (`mapWithConcurrency`) es una utilidad pura sin dependencias
  externas — se mantiene como utilidad transversal fuera de la separación de capas
  (carpeta neutral, consumible por cualquier capa), no como parte de la capa de
  dominio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La constitution DEBE incluir un nuevo Core Principle dedicado a
  arquitectura Hexagonal del backend, numerado como el siguiente principio romano tras
  el existente Principio VII, con el mismo formato (enunciado MUST/MUST NOT + párrafo
  Rationale) que los seis principios ya existentes.
- **FR-002**: El nuevo principio DEBE fijar las capas obligatorias para
  `backend/src`: dominio, aplicación, puertos (interfaces) y adaptadores
  (implementaciones concretas).
- **FR-003**: El nuevo principio DEBE fijar la regla de dependencia: el código de
  dominio y de aplicación NO DEBE importar directamente SDKs de infraestructura
  (`firebase-admin`, `axios`, `ioredis`, `rss-parser`); solo los adaptadores pueden
  hacerlo.
- **FR-004**: El nuevo principio DEBE fijar que las rutas Express son adaptadores
  "driving" cuya responsabilidad es traducir peticiones/respuestas HTTP hacia y desde
  casos de uso de la capa de aplicación, y que NO DEBEN contener orquestación de lógica
  de negocio.
- **FR-005**: El nuevo principio DEBE fijar una convención de carpetas por capas
  globales a nivel de `backend/src` (`src/domain/`, `src/application/`, `src/ports/`,
  `src/adapters/`), con una subcarpeta por dominio dentro de cada una (p. ej.
  `src/domain/library/`, `src/adapters/library/`), suficientemente concreta para que
  un desarrollador sepa sin ambigüedad dónde colocar un fichero nuevo.
- **FR-006**: El nuevo principio DEBE citar explícitamente el patrón ya existente de
  errores de dominio separados de su traducción a HTTP (jerarquía de errores tipados
  lanzados por el dominio, funciones de traducción a códigos HTTP que solo viven en las
  rutas) como el mecanismo de manejo de errores conforme con la arquitectura, a
  preservar y generalizar en vez de sustituir.
- **FR-007**: El nuevo principio DEBE declarar explícitamente su alcance: aplica solo a
  `backend/`, no a `frontend/` ni a `e2e/`.
- **FR-008**: El nuevo principio DEBE dejar constancia de que los módulos
  transversales sin dependencias de infraestructura (el logger y las utilidades puras
  de concurrencia) quedan fuera del alcance de la regla de dependencia por no
  depender de infraestructura alguna, sin requerir una excepción "shared kernel"
  declarada expresamente: el logger no se menciona como caso especial (ya cumple la
  regla tal cual), y las utilidades puras de concurrencia (p. ej.
  `shared/concurrency.ts`) se mantienen como utilidad transversal fuera de la
  separación de capas, consumible desde cualquier capa.
- **FR-009**: El campo de versión de la constitution DEBE actualizarse de 2.4.0 a
  2.5.0 (bump MINOR, conforme a la política de versionado ya documentada en el propio
  fichero), y el campo `Last Amended` DEBE reflejar la fecha real de la amendment.
- **FR-010**: El comentario "Sync Impact Report" al inicio del fichero de la
  constitution DEBE actualizarse para documentar el cambio 2.4.0 → 2.5.0 (principio
  añadido, secciones afectadas, comprobación de plantillas), en el mismo formato que ya
  usan las entradas anteriores del mismo comentario.
- **FR-011**: Las plantillas `.specify/templates/plan-template.md` y
  `.specify/templates/spec-template.md` DEBEN revisarse frente al nuevo principio; si
  requieren una actualización (p. ej. un gate de cumplimiento arquitectónico para
  features de backend) DEBEN actualizarse, o marcarse explícitamente como "sin cambios
  necesarios" si no la requieren.
- **FR-012**: Esta historia NO DEBE incluir cambios de código de implementación en
  `backend/src` (la migración real de cada dominio queda fuera de alcance de esta
  historia).

### Key Entities

- **Core Principle (Hexagonal Architecture)**: Sección normativa nueva dentro de
  `.specify/memory/constitution.md`; define capas obligatorias, regla de dependencia,
  convención de carpetas y el encaje del patrón de errores de dominio ya existente.
  No introduce ninguna entidad de datos del dominio de negocio de Vinylmania.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cualquier persona que lea únicamente el nuevo Core Principle (sin mirar
  código) puede clasificar correctamente, en menos de un minuto por fichero, a qué capa
  pertenece un fichero backend de ejemplo dado (dominio, aplicación, puerto o
  adaptador).
- **SC-002**: El 100% de los criterios de aceptación de esta historia son verificables
  leyendo exclusivamente `.specify/memory/constitution.md` (versión, Sync Impact
  Report, contenido del principio), sin necesidad de ejecutar código ni tests.
- **SC-003**: Las historias de migración de dominio futuras (library, discogs catalog,
  discogs oauth+collection, feeds, auth/users) pueden comenzar su planificación citando
  el nuevo principio como única referencia normativa, sin requerir clarificaciones
  adicionales sobre qué cuenta como "puerto", "adaptador", "dominio" o "aplicación".
- **SC-004**: Cero ambigüedad reportada en revisión: al presentar el nuevo principio a
  un segundo revisor, este no identifica ningún fichero real de `backend/src` cuya capa
  de pertenencia quede indeterminada por el texto del principio.

## Assumptions

- Esta historia es puramente documental/normativa: no modifica ningún fichero de
  `backend/src`, `backend/tests`, ni ningún contrato de API existente. La migración
  real del código a la convención aquí fijada es objeto de historias posteriores e
  independientes (una por dominio: library, discogs catalog, discogs oauth+collection,
  feeds, auth/users), fuera del alcance de esta especificación.
- Los nombres de trabajo de puertos mencionados en la HU origen (`LibraryRepositoryPort`,
  `DiscogsCatalogPort`, `CachePort`, etc.) no son objeto de esta historia — esta
  historia fija la convención general de capas/carpetas y la regla de dependencia, no
  los nombres concretos de interfaces de cada dominio.
- Se asume que "todo desarrollo futuro del backend" se refiere a nuevas
  features/cambios bajo `backend/`, no a `frontend/` ni a `e2e/` — la constitution ya
  separa ambos stacks en su sección "Technology Stack".
- El bump de versión de la constitution (2.4.0 → 2.5.0) sigue la política de
  versionado ya documentada en el propio fichero ("MINOR: A new principle... is
  added"), sin necesidad de una decisión adicional.
