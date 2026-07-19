# Feature Specification: Análisis de calidad de código (CodeQL) y actualización de Node.js en CI

**Feature Branch**: `055-ci-codeql-node-upgrade`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Para esta especificación quiero trabajar en dos cosas. La primera, me gustaría que añadamos uin sistema de calidad del código a la cadena de ci que ya tenemos. Creo que la mejor altenativa es code scanning con GitHub CodeQL. Quiero que lo habilites y lo añadas como un paso más a la cadena de CI. Creo que el orden debería ser -> build -> code quality -> test -> deploy. Cada paso bloquea la ejecución del siguiente si falla. Propón un orden mejor si lo consideras. La segunda cosa que quiero revisar es la versión de node.js. Estoy teniendo un warning en la fase e2e que dice lo siguiente: E2E tests / Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4, actions/setup-java@v4. Me gustaría corregir esto también."

## Contexto verificado en el repositorio

- `.github/workflows/ci.yml` define hoy tres jobs de test en paralelo (`backend-test`, `frontend-test`, `e2e-test`), un job `release` y cuatro jobs de despliegue (`deploy-production-backend`, `deploy-production-frontend`, `deploy-preview-backend`, `deploy-preview-frontend`), todos con `needs: [backend-test, frontend-test, e2e-test]` (spec `054-gate-deploys-on-passing-tests`). **No existe hoy ningún job de "build" independiente**: la compilación ocurre dentro de cada job de despliegue vía `vercel build`, y los jobs de test se limitan a `npm ci` + `npm test`.
- No existe ningún paso de análisis de calidad/seguridad de código (SAST) en el pipeline. El único chequeo estático hoy es `lint-workflows` (actionlint), que valida la sintaxis de los propios workflows de GitHub Actions, no el código de la aplicación.
- El repositorio no tiene habilitado GitHub Code Scanning / CodeQL (no existe workflow `codeql.yml` ni configuración en `.github/`).
- El proyecto es 100% JavaScript/TypeScript (`backend/`, `frontend/`, `e2e/`, `scripts/`), sin lenguajes compilados que requieran un paso de "autobuild" para que CodeQL pueda analizarlos.
- El warning reportado ("Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4, actions/setup-java@v4") proviene del job `e2e-test`, que usa `actions/cache@v4` (dos veces, para el caché de binarios del emulador de Firebase y de navegadores Playwright) y `actions/setup-java@v4`. Este aviso es independiente de `actions/setup-node`: aunque `e2e-test` ya usa `node-version: 24` para el runtime del propio proyecto, las acciones `actions/cache@v4` y `actions/setup-java@v4` están implementadas internamente sobre el runtime Node 20 de GitHub Actions (deprecado), por lo que GitHub las fuerza a ejecutarse sobre Node 24 y emite el aviso hasta que se actualicen a versiones que declaren nativamente Node 24.
- Los demás jobs (`backend-test`, `frontend-test`, `release`, y los cuatro jobs de despliegue) usan `actions/setup-node@v5` con `node-version: 20` para el runtime propio del proyecto — solo `e2e-test` usa ya `node-version: 24`. Esto es una inconsistencia adicional a la del warning, ya que Node.js 20 está en fase de deprecación frente a Node.js 24 (LTS actual).

## Clarifications

### Session 2026-07-19

- Q: ¿Cómo debe integrarse CodeQL en el pipeline para poder bloquear los despliegues igual que hacen los tests (FR-003, mecanismo `needs`)? → A: Workflow Advanced/custom — un job de CodeQL dentro del mismo grafo de jobs que `ci.yml`, de forma que los jobs de despliegue puedan depender de él vía `needs`.
- Q: ¿Qué conjunto de queries de CodeQL debe usarse? → A: `security-and-quality` — cubre tanto vulnerabilidades de seguridad como problemas de mantenibilidad/calidad, no solo seguridad.
- Q: ¿Qué severidad de alerta CodeQL debe bloquear el despliegue? → A: Critical + High. Las alertas de severidad medium/low se reportan pero no bloquean.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bloquear despliegues cuando el análisis de calidad de código falla (Priority: P1)

Como responsable del proyecto, quiero que cada pull request y cada push a `main` pase por un análisis automático de calidad y seguridad del código (CodeQL), de forma que no se pueda desplegar código con vulnerabilidades o problemas de calidad detectables automáticamente.

**Why this priority**: Es el objetivo principal de esta especificación — añadir una puerta de calidad que hoy no existe, con el mismo poder de bloqueo que ya tienen los tests sobre el despliegue.

**Independent Test**: Introducir en una rama una vulnerabilidad detectable por CodeQL (p. ej. una construcción insegura conocida, como concatenar entrada de usuario en una consulta) y abrir un PR; confirmar que el check de CodeQL aparece en rojo en el PR y que ningún job de despliegue se ejecuta para ese commit. Corregir el problema y confirmar que el check pasa a verde.

**Acceptance Scenarios**:

1. **Given** un pull request o un push a `main`, **When** se ejecuta el pipeline de CI, **Then** se ejecuta un análisis CodeQL sobre el código JavaScript/TypeScript del repositorio (backend, frontend, e2e, scripts) y su resultado queda visible como check del commit/PR.
2. **Given** un análisis CodeQL que reporta al menos una alerta de severidad bloqueante, **When** el pipeline evalúa si procede el despliegue, **Then** ningún job de despliegue (preview ni producción) se ejecuta para ese commit, de la misma forma en que hoy se bloquean si fallan los tests.
3. **Given** un análisis CodeQL sin alertas bloqueantes y tests en verde, **When** el pipeline finaliza, **Then** los despliegues proceden con normalidad, sin retrasos significativos añadidos por el análisis de calidad.

---

### User Story 2 - Eliminar los avisos de deprecación de Node.js en CI (Priority: P2)

Como responsable del proyecto, quiero que ningún job del pipeline de CI muestre avisos de deprecación relacionados con Node.js 20, para tener confianza en que el pipeline seguirá funcionando cuando GitHub retire por completo ese runtime.

**Why this priority**: Es un aviso, no un fallo — el pipeline funciona hoy — pero es una deuda que puede convertirse en una rotura real cuando GitHub deje de forzar la ejecución sobre Node 24 y simplemente retire el soporte a Node 20.

**Independent Test**: Ejecutar el workflow completo tras el cambio y revisar el log de cada job; confirmar que no aparece ningún mensaje de "Node.js 20 is deprecated" ni equivalente en ninguno de los jobs.

**Acceptance Scenarios**:

1. **Given** el job `e2e-test` tras el cambio, **When** se ejecuta en CI, **Then** no aparece el aviso de deprecación de Node.js asociado a `actions/cache` ni a `actions/setup-java`.
2. **Given** el resto de jobs del pipeline (`backend-test`, `frontend-test`, `release`, jobs de despliegue), **When** se ejecutan en CI, **Then** todos usan una versión de Node.js para el runtime del proyecto consistente con la ya usada en `e2e-test`, sin mezclar versiones deprecadas y no deprecadas entre jobs.
3. **Given** el pipeline completo tras el cambio, **When** se compara su comportamiento funcional (tests, build, despliegue) con el actual, **Then** no hay ninguna regresión: mismos jobs, mismo resultado esperado, solo cambia la versión de Node.js y las acciones usadas.

---

### Edge Cases

- ¿Qué ocurre si CodeQL reporta únicamente alertas de severidad Medium/Low (no bloqueantes)? El pipeline no debe bloquear el despliegue por estas; solo las alertas de severidad Critical/High deben impedirlo (ver FR-003).
- ¿Qué ocurre con pull requests abiertos desde forks? El análisis CodeQL debe poder ejecutarse igualmente sobre el código (no requiere secrets, a diferencia de los despliegues), pero el resultado debe seguir bloqueando solo los despliegues de PRs internos, coherente con el alcance ya definido en la spec `054-gate-deploys-on-passing-tests` (los forks no generan despliegue).
- ¿Qué ocurre si el análisis CodeQL tarda sensiblemente más que los jobs de test actuales? No debe convertirse en el cuello de botella del pipeline; de ahí la recomendación de ejecutarlo en paralelo a los tests (ver sección "Orden del pipeline" en Assumptions) en vez de forma estrictamente secuencial.
- ¿Qué ocurre si una versión más nueva de `actions/cache` o `actions/setup-java` no está disponible o introduce cambios incompatibles? Debe evaluarse en la fase de planificación; el requisito funcional es la ausencia del aviso de deprecación, no una versión concreta de la acción.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El pipeline de CI MUST ejecutar un análisis de calidad y seguridad de código (GitHub CodeQL, mediante un workflow Advanced/custom — no el "Default setup" gestionado por GitHub — para que el job forme parte del mismo grafo de dependencias que `ci.yml`) sobre el código JavaScript/TypeScript del repositorio en cada pull request y en cada push a `main`.
- **FR-002**: El resultado del análisis CodeQL MUST quedar visible como check independiente del commit/PR en GitHub, igual que hoy ocurre con los checks de test.
- **FR-003**: Si el análisis CodeQL detecta alertas de severidad **Critical** o **High**, el sistema MUST impedir que se ejecute cualquier job de despliegue (preview o producción) para ese commit, con el mismo mecanismo de bloqueo (`needs`) ya usado para los tests. Las alertas de severidad Medium o Low MUST quedar registradas y visibles, pero MUST NOT bloquear el despliegue.
- **FR-004**: El análisis CodeQL MUST cubrir tanto el backend como el frontend (y el resto de código JavaScript/TypeScript del repositorio: `e2e/`, `scripts/`), usando el conjunto de queries `security-and-quality` (seguridad + mantenibilidad/calidad), no únicamente el conjunto por defecto o `security-extended`.
- **FR-005**: El pipeline MUST mantener el comportamiento ya existente de bloqueo de despliegues ante fallo de tests (spec `054-gate-deploys-on-passing-tests`); el nuevo análisis de calidad se añade como condición adicional, no sustituye a las existentes.
- **FR-006**: Ningún job del pipeline de CI MUST mostrar avisos de deprecación de Node.js en su log de ejecución.
- **FR-007**: Todos los jobs del pipeline que definen una versión de Node.js para el runtime del proyecto MUST usar una versión consistente y actualmente soportada (no deprecada) entre sí.
- **FR-008**: Los cambios de esta especificación MUST NOT introducir regresiones en el comportamiento actual de build, test y despliegue (mismos jobs, mismo resultado esperado ante el mismo código).

### Key Entities

- **Job de análisis de calidad (CodeQL)**: nueva unidad de trabajo en `ci.yml`, responsable de escanear el código del repositorio y reportar alertas; su resultado es una condición de entrada adicional para los jobs de despliegue, al mismo nivel que los jobs de test existentes.
- **Alerta CodeQL**: hallazgo individual del análisis, con una severidad asociada (Low/Medium/High/Critical); solo las de severidad Critical/High bloquean el despliegue (FR-003).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los pull requests y pushes a `main` posteriores al cambio muestran un check de análisis de calidad de código junto a los checks de test existentes.
- **SC-002**: Cero despliegues (preview o producción) se generan para commits en los que el análisis de calidad reporta alertas bloqueantes, verificado en las primeras 2 semanas tras el cambio.
- **SC-003**: El tiempo total del pipeline (desde push/apertura de PR hasta despliegue en estado Ready) no aumenta en más de un 20% respecto al tiempo actual, medido sobre el promedio de ejecuciones de las 2 semanas posteriores al cambio.
- **SC-004**: Cero avisos de deprecación de Node.js aparecen en los logs de cualquier job del pipeline, verificado en las 2 semanas posteriores al cambio.

## Assumptions

- **Orden del pipeline**: el usuario propuso el orden `build → code quality → test → deploy`, totalmente secuencial. Dado que hoy no existe un job de "build" independiente (la build de Vercel ocurre dentro de los propios jobs de despliegue) y que CodeQL para JavaScript/TypeScript no requiere una build previa (no es un lenguaje compilado, no necesita el paso "autobuild"), se asume como mejor alternativa ejecutar el análisis de calidad **en paralelo** a los tres jobs de test existentes (`backend-test`, `frontend-test`, `e2e-test`), añadiéndolo como una condición más (`needs`) de los jobs de despliegue junto a los tres tests. Esto conserva el efecto que pide el usuario — nada se despliega si el análisis de calidad falla — sin alargar el pipeline de forma serializada. La disposición exacta de los jobs se define en `plan.md`.
- Se asume acceso de administración al repositorio en GitHub para poder mergear el workflow Advanced/custom y para ver/gestionar (dismissal, etc.) las alertas resultantes en Security → Code scanning. **No** se requiere ningún paso previo de habilitación en Settings → Code security: al ser un repositorio público, y al tratarse de un workflow Advanced/custom (no el "Default setup" gestionado por GitHub), Code Scanning se activa automáticamente la primera vez que el workflow corre y sube resultados — confirmado en research.md y quickstart.md (Prerequisitos).
- La corrección del aviso de Node.js se asume compuesta por dos partes: (a) alinear la versión de Node.js usada por `actions/setup-node` en todos los jobs a la misma ya usada en `e2e-test`, y (b) actualizar `actions/cache` y `actions/setup-java` (y cualquier otra acción que emita el mismo aviso) a versiones que ya no dependan del runtime Node 20 de GitHub Actions, si existen disponibles en el momento de la implementación.
- Fuera de alcance de esta especificación: cambiar el lenguaje o gestor de paquetes del proyecto, añadir otras herramientas de análisis estático (linters de negocio, cobertura, etc.) más allá de CodeQL, o modificar el comportamiento de despliegue ya definido en la spec `054-gate-deploys-on-passing-tests` salvo por la nueva condición de CodeQL.
