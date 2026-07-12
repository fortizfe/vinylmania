# Feature Specification: Changelog único con versionado automático desde la pipeline de CI

**Feature Branch**: `037-unified-changelog-versioning`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Quiero sustituir los dos CHANGELOG.md independientes de backend/ y frontend/ (con versión propia cada uno, actualizados a mano en cada PR) por un único CHANGELOG.md en la raíz del proyecto, con una sola versión para todo el proyecto, que se incremente automáticamente desde la pipeline de CI de GitHub (.github/workflows/ci.yml) a partir de los Conventional Commits ya obligatorios en el proyecto, sin que nadie tenga que editar a mano la versión ni el changelog en cada PR."

## Clarifications

### Session 2026-07-12

- Q: La spec no especifica cómo debe la pipeline de CI mapear cada tipo de
  Conventional Commit calificado a una categoría de Keep a Changelog
  (Added/Changed/Fixed/Removed). ¿Qué regla de mapeo debe usarse? → A:
  `feat`→`Added`, `fix`→`Fixed`, y cualquier otro tipo que genere un
  incremento de versión (breaking change de cualquier tipo, `perf`,
  `revert`, etc.) cae en `Changed` como categoría única de respaldo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Changelog único con el historial fusionado (Priority: P1)

Como responsable del proyecto, quiero un único `CHANGELOG.md` en la raíz que
fusione cronológicamente todo el historial ya existente en
`backend/CHANGELOG.md` y `frontend/CHANGELOG.md`, y que arranque el nuevo
esquema de versión unificada en `0.22.1` (la más alta de las dos versiones
actuales), para tener un único punto de verdad del historial de cambios del
proyecto sin perder lo ya documentado.

**Why this priority**: Es el prerrequisito de datos para todo lo demás — sin
un changelog fusionado y un punto de partida de versión claro, la
automatización de la Historia 2 no tiene un estado base coherente sobre el
que añadir entradas nuevas.

**Independent Test**: Puede probarse revisando el `CHANGELOG.md` resultante
en la raíz del proyecto y verificando que contiene toda la información de
ambos changelogs antiguos, sin ejecutar todavía ninguna automatización de CI.

**Acceptance Scenarios**:

1. **Given** los dos changelogs actuales (`backend/CHANGELOG.md` en `0.13.1`
   y `frontend/CHANGELOG.md` en `0.22.1`), **When** se crea el
   `CHANGELOG.md` único en la raíz, **Then** contiene todas las entradas
   históricas de ambos ficheros, ordenadas cronológicamente por fecha,
   conservando de cada entrada su versión y fecha originales y una
   indicación de a qué paquete pertenecía (`backend`/`frontend`) — el
   historial pasado no se renumera con un esquema unificado que nunca
   existió en ese momento.
2. **Given** el `CHANGELOG.md` único ya fusionado, **When** se marca el
   inicio del nuevo esquema de versión unificada, **Then** queda claramente
   señalado el punto a partir del cual una sola versión (`0.22.1`) aplica al
   proyecto entero, distinguible del historial fusionado anterior.
3. **Given** el nuevo fichero, **When** se compara con el formato ya usado
   hoy, **Then** mantiene la misma convención Keep a Changelog
   (`Added`/`Changed`/`Fixed`/`Removed`) y la referencia a SemVer.
4. **Given** `backend/package.json` y `frontend/package.json`, **When** se
   completa esta historia, **Then** ambos quedan en la versión `0.22.1`
   (versión única, igual en los dos paquetes).
5. **Given** los dos changelogs antiguos, **When** se completa la
   migración, **Then** quedan conservados como archivo histórico (no se
   borran), pero dejan de recibir entradas nuevas a partir de aquí.

---

### User Story 2 - Versión y changelog se actualizan solos desde la CI de GitHub (Priority: P1)

Como responsable del proyecto, quiero que cada vez que se mergea una PR a
`main`, la pipeline de CI de GitHub calcule automáticamente el incremento de
versión que corresponde (patch/minor/major) según los Conventional Commits
de esa PR, actualice la versión única en ambos `package.json` y añada una
entrada nueva al `CHANGELOG.md` único con esos cambios — sin que nadie tenga
que editar versión ni changelog a mano en la PR.

**Why this priority**: Es el valor central de la historia de usuario — sin
esto, el changelog unificado de la Historia 1 sigue requiriendo el mismo
mantenimiento manual que se quiere eliminar.

**Independent Test**: Puede probarse mergeando una PR de prueba con commits
Conventional Commits (`feat:`, `fix:`, etc.) a `main` y verificando que la
pipeline de CI actualiza automáticamente la versión en ambos `package.json`
y añade la entrada correspondiente al `CHANGELOG.md` único, sin edición
manual.

**Acceptance Scenarios**:

1. **Given** una PR con commits en formato Conventional Commits mergeada a
   `main`, **When** se ejecuta la pipeline de CI, **Then** calcula
   automáticamente si el incremento es patch, minor o major según el tipo
   de commit(s) de esa PR, sin intervención manual.
2. **Given** el incremento calculado, **When** se aplica, **Then** el mismo
   número de versión nuevo se escribe en `backend/package.json` y
   `frontend/package.json` a la vez (versión única, lockstep) y se añade
   una entrada nueva al `CHANGELOG.md` único con la fecha y un resumen del
   cambio, categorizado como `Added`/`Changed`/`Fixed`/`Removed`.
3. **Given** una PR que combina varios tipos de commit (p. ej. un `feat` y
   un `fix` en la misma PR), **When** se calcula el incremento, **Then**
   gana el de mayor impacto (breaking > feat > fix), igual que ya dicta el
   Principio VI de la constitution.
4. **Given** una PR cuyos commits son solo de tipos que no representan un
   cambio de cara al usuario (p. ej. `chore`, `docs`, `test`, `ci`, `style`,
   `refactor` sin `!`), **When** se procesa en CI, **Then** no se genera un
   incremento de versión ni una entrada de changelog para esa PR.
5. **Given** el proceso automático completado, **When** el cambio llega a
   `main`, **Then** el despliegue a Vercel sigue ocurriendo igual que hoy
   (push a `main` → deploy), sin pasos manuales adicionales.
6. **Given** dos PRs mergeadas en sucesión rápida, **When** sus respectivas
   ejecuciones de CI calculan versión, **Then** no se pisan entre sí ni
   producen un `CHANGELOG.md` o una versión inconsistente (sin condiciones
   de carrera).

---

### Edge Cases

- ¿Qué pasa si una PR mergeada tiene un commit que no sigue Conventional
  Commits (a pesar de que la constitution ya lo exige)? La pipeline no debe
  romperse silenciosamente ni bloquear el deploy — como mínimo debe quedar
  registrado/visible que esa PR no pudo clasificarse automáticamente.
- ¿Qué pasa si una PR toca solo `backend/` o solo `frontend/`? Con versión
  única (lockstep), igualmente se incrementa la versión del proyecto entero
  y se refleja en ambos `package.json`, aunque uno de los dos paquetes no
  haya cambiado — comportamiento esperado del esquema unificado (ver
  Supuestos).
- ¿Qué pasa si se mergea con un merge commit que preserva varios commits
  individuales en vez de squash-merge? La pipeline debe evaluar todos los
  commits de ese rango, no solo el último (ver Supuestos).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST sustituir `backend/CHANGELOG.md` y
  `frontend/CHANGELOG.md` como changelogs vivos por un único
  `CHANGELOG.md` en la raíz del proyecto que fusione cronológicamente todo
  el historial existente de ambos, conservando la versión y fecha
  originales de cada entrada histórica y una indicación de a qué paquete
  pertenecía.
- **FR-002**: El `CHANGELOG.md` único MUST señalar de forma clara el punto a
  partir del cual arranca el nuevo esquema de versión unificada (`0.22.1`),
  distinguiéndolo del historial fusionado anterior.
- **FR-003**: El `CHANGELOG.md` único MUST mantener el formato
  [Keep a Changelog](https://keepachangelog.com) (categorías
  `Added`/`Changed`/`Fixed`/`Removed`) y la referencia a
  [SemVer](https://semver.org).
- **FR-004**: `backend/package.json` y `frontend/package.json` MUST quedar
  ambos en la versión `0.22.1` como resultado de la migración inicial.
- **FR-005**: Los dos changelogs antiguos por paquete MUST conservarse como
  archivo histórico (no se eliminan del repositorio) pero MUST dejar de
  recibir entradas nuevas desde la finalización de esta historia.
- **FR-006**: La pipeline de CI de GitHub (`.github/workflows/ci.yml`) MUST
  calcular automáticamente, para cada PR mergeada a `main`, el incremento de
  versión (patch/minor/major) que corresponde según los Conventional
  Commits de esa PR, sin intervención manual.
- **FR-007**: Cuando una PR combina varios tipos de commit, el sistema MUST
  aplicar el incremento de mayor impacto presente en esa PR (breaking >
  `feat` > `fix`), consistente con la clasificación SemVer ya definida en
  el Principio VI de la constitution.
- **FR-008**: El sistema MUST escribir el mismo número de versión nuevo en
  `backend/package.json` y `frontend/package.json` de forma simultánea
  (versionado lockstep de un único número para todo el proyecto).
- **FR-009**: El sistema MUST añadir automáticamente una entrada nueva al
  `CHANGELOG.md` único por cada incremento de versión, con fecha y un
  resumen del cambio, categorizado según Keep a Changelog con la siguiente
  regla de mapeo: commits `feat` → `Added`; commits `fix` → `Fixed`;
  cualquier otro tipo de commit que genere un incremento de versión
  (breaking change de cualquier tipo, `perf`, `revert`, etc.) → `Changed`
  como categoría única de respaldo.
- **FR-010**: El sistema MUST NOT generar incremento de versión ni entrada
  de changelog para una PR cuyos commits sean únicamente de tipos que no
  representan cambio de cara al usuario (`chore`, `docs`, `test`, `ci`,
  `style`, `refactor` sin `!`).
- **FR-011**: El sistema MUST continuar desplegando a Vercel de la misma
  forma que hoy (push a `main` → deploy) sin pasos manuales adicionales
  introducidos por esta automatización.
- **FR-012**: El sistema MUST procesar ejecuciones de CI de PRs mergeadas en
  sucesión rápida sin condiciones de carrera que produzcan un
  `CHANGELOG.md` o una versión inconsistente entre sí.
- **FR-013**: Cuando una PR mergeada contiene un commit que no sigue
  Conventional Commits, el sistema MUST NOT fallar silenciosamente ni
  bloquear el despliegue; MUST dejar constancia visible de que esa PR no
  pudo clasificarse automáticamente.
- **FR-014**: Ni la actualización de versión ni la entrada de changelog
  posteriores a esta historia MUST requerir edición manual por parte de
  quien abre o revisa la PR.

### Key Entities

- **CHANGELOG.md (raíz)**: Fichero único de historial de cambios de todo el
  proyecto; contiene el historial fusionado histórico (con versión, fecha y
  paquete de origen por entrada) seguido de las entradas del esquema de
  versión unificada generadas automáticamente desde `0.22.1` en adelante.
- **Versión de proyecto (lockstep)**: Número de versión SemVer único que se
  refleja de forma idéntica en `backend/package.json` y
  `frontend/package.json` en todo momento.
- **Entrada de changelog**: Registro individual dentro de `CHANGELOG.md` con
  versión, fecha, categoría (`Added`/`Changed`/`Fixed`/`Removed`) y resumen
  del cambio; para el historial fusionado además indica el paquete de
  origen (`backend`/`frontend`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Existe un único `CHANGELOG.md` en la raíz del proyecto, con
  todo el historial fusionado y el nuevo esquema de versión unificada
  arrancando en `0.22.1`.
- **SC-002**: `backend/package.json` y `frontend/package.json` muestran
  siempre la misma versión entre sí, en todo momento posterior a la
  migración.
- **SC-003**: Ninguna PR mergeada a `main` que incluya un `feat`/`fix`/
  cambio incompatible requiere edición manual de versión ni de changelog
  para que ambos queden correctos.
- **SC-004**: El 100% de los incrementos de versión posteriores a esta
  historia son trazables a los Conventional Commits que los originaron.

## Out of Scope

- Cambiar el contenido o la redacción de las entradas históricas ya escritas
  en `backend/CHANGELOG.md` o `frontend/CHANGELOG.md` durante la fusión.
- Modificar el pipeline de despliegue de Vercel en sí (push a `main` →
  deploy sigue igual).
- Generar release notes públicas fuera del propio `CHANGELOG.md` único.
- Cambiar la política de Conventional Commits ya vigente en la constitution
  — esta historia la reutiliza y automatiza, no la redefine.

## Assumptions

- Cada PR mergeada a `main` corresponde a un único commit en `main` (flujo
  de squash-merge), consistente con el historial de commits ya observado en
  el repositorio; si en el futuro se mergea con merge commit preservando
  varios commits individuales, la pipeline debe evaluar todos los commits
  de ese rango, no solo el último.
- El versionado único es "lockstep": toda la app (backend + frontend)
  comparte un solo número de versión, aunque solo uno de los dos paquetes
  haya cambiado en una PR concreta.
- Los tipos de commit que no representan cambio de cara al usuario
  (`chore`, `docs`, `test`, `ci`, `style`, `refactor` sin `!`) no generan
  incremento de versión ni entrada de changelog, siguiendo la convención
  habitual de herramientas de versionado automático basadas en Conventional
  Commits.
- La fusión del historial (Historia 1) es un trabajo puntual de migración;
  no es algo que la automatización de la Historia 2 tenga que repetir ni
  mantener.
- Esta historia no prescribe qué herramienta o script concreto calcula la
  versión y genera el changelog — es una decisión de la fase de
  planificación, no de esta especificación.
- La constitution del proyecto (v2.3.0) ya no exige changelogs
  independientes por paquete actualizados a mano; esta historia implementa
  el reemplazo por el esquema unificado y automático que esa enmienda
  habilitó.

