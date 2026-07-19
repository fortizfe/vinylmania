# Research: Análisis de calidad de código (CodeQL) y actualización de Node.js en CI

**Feature**: `055-ci-codeql-node-upgrade` | **Date**: 2026-07-19

Fuentes consultadas: documentación oficial de GitHub (`docs.github.com/en/code-security/...`,
`docs.github.com/en/rest/code-scanning/code-scanning`), el workflow starter oficial
`actions/starter-workflows/code-scanning/codeql.yml`, los repositorios y páginas de releases de
`github/codeql-action`, `actions/cache`, `actions/setup-java`, `actions/setup-node`,
`actions/checkout`, `actions/upload-artifact` y `actions/github-script`, el changelog oficial de
GitHub sobre la deprecación de Node 20 (`github.blog/changelog/2025-09-19-...`), y el `ci.yml`
actual del repo (`Contexto verificado en el repositorio` en spec.md). El repositorio es **público**
(`fortizfe/vinylmania`), por lo que GitHub Code Scanning/CodeQL está disponible sin coste (GitHub
Advanced Security es gratuito en repos públicos; solo se factura en repos privados).

## 1. Cómo integrar CodeQL como job dentro de `ci.yml` (FR-001, Clarifications Q1)

- **Decision**: Añadir un job nuevo (`code-quality`) a `.github/workflows/ci.yml` usando el patrón
  "Advanced setup" oficial: `github/codeql-action/init@v4` → `github/codeql-action/analyze@v4`,
  en vez del "Default setup" gestionado por GitHub (Settings → Code security → Code scanning →
  Default).
- **Rationale**: Confirmado en Clarifications — el "Default setup" corre como workflow
  independiente (`github-code-scanning/codeql`) fuera del grafo de jobs de `ci.yml`, por lo que los
  jobs de despliegue no podrían depender de él vía `needs` (FR-003 exige exactamente ese mecanismo,
  el mismo que ya usan los tests). El "Advanced setup" es un workflow/job normal, así que sí puede
  vivir dentro de `ci.yml` y ser referenciado por `needs` como cualquier otro job.
- **Alternatives considered**: Default setup + regla de "ruleset" de repositorio
  ("Require code scanning results", disponible como condición de ruleset en GitHub) — descartada:
  bloquea el *merge* del PR vía branch protection/ruleset, no la ejecución de los jobs de
  despliegue del propio workflow; no cubre el caso de push directo a `main` con el mismo mecanismo
  ya usado por los tests (FR-005), e introduce un segundo sistema de gating (rulesets) además del ya
  existente (`needs`), lo que va contra Simplicity/YAGNI (Principio III).

## 2. Lenguaje, build-mode y permisos del job CodeQL (FR-001, FR-004)

- **Decision**: Un único lenguaje `javascript-typescript` (sin matrix — el repo es 100% JS/TS, no
  hace falta la matriz multi-lenguaje del starter workflow), `build-mode: none` (CodeQL para
  JS/TS no necesita compilar el código, solo analizarlo — confirmado en la documentación oficial de
  queries JS/TS), y permisos `security-events: write` + `contents: read` (más `actions: read`, que
  el starter workflow oficial incluye también para repos privados — se mantiene por alineamiento
  con el template oficial aunque el repo sea público).
- **Rationale**: `build-mode: none` evita cualquier paso de instalación/compilación (no hace falta
  `npm ci` dentro de este job), manteniendo el job rápido y sin dependencia de las mismas
  instalaciones que ya hacen `backend-test`/`frontend-test`/`e2e-test` — refuerza la decisión de
  Assumptions de correr `code-quality` en paralelo a los tests sin alargarlos.
- **Alternatives considered**: `build-mode: autobuild` — descartada, es para lenguajes compilados;
  no aporta nada para JS/TS y solo añadiría tiempo de ejecución innecesario.

## 3. Conjunto de queries: `security-and-quality` (FR-004, Clarifications Q2)

- **Decision**: `github/codeql-action/init@v4` con `queries: security-and-quality`.
- **Rationale**: Confirmado en Clarifications — el query pack oficial `security-and-quality` de
  GitHub añade sobre el conjunto de seguridad ampliado (`security-extended`) reglas de
  mantenibilidad/calidad no relacionadas con seguridad, que es lo que pide la spec ("sistema de
  calidad del código"), no solo un escáner de vulnerabilidades.
- **Alternatives considered**: `security-extended` (descartado, sin cobertura de calidad no-seguridad)
  y el conjunto por defecto (descartado, cobertura mínima). Ambos documentados como alternativas en
  la propia Clarifications del spec.

## 4. Cómo bloquear el despliegue solo con alertas Critical/High (FR-003, Clarifications Q3)

- **Decision**: Un paso adicional en el mismo job `code-quality`, después de `analyze`, que consulta
  la API REST de Code Scanning Alerts (`GET /repos/{owner}/{repo}/code-scanning/alerts`) filtrando
  por `ref=${{ github.ref }}` y `state=open`, y falla el step (`exit 1`) si algún resultado tiene
  `rule.security_severity_level` en `critical` o `high`. `github.ref` ya coincide exactamente con el
  formato que Code Scanning usa para asociar alertas a un evento (`refs/heads/main` en push,
  `refs/pull/<n>/merge` en pull_request), así que no hace falta lógica adicional para distinguir
  ambos casos.
- **Rationale**: `codeql-action/analyze` no falla el job por sí solo según severidad (el step
  `analyze` termina en éxito aunque haya alertas — solo falla ante errores de análisis). El campo
  `security_severity_level` (`low`/`medium`/`high`/`critical`/`null`) es el que expone directamente
  la clasificación que pide FR-003, sin tener que derivarla manualmente de scores numéricos del
  SARIF. Es seguro consultar la API inmediatamente después de `analyze` porque ese step usa
  `wait-for-processing: true` por defecto — no retorna hasta que el SARIF subido ha terminado de
  procesarse, evitando una condición de carrera donde el step de verificación consulte alertas que
  aún no existen en el índice.
- **Importante — alcance de "Critical/High"**: dado que el query set es `security-and-quality`
  (decisión #3), el análisis también genera alertas de calidad sin `security_severity_level` (solo
  `rule.severity`: `error`/`warning`/`note`, campo distinto). FR-003, tal como quedó redactado tras
  Clarifications ("severidad Critical o High"), usa la taxonomía de `security_severity_level` —
  **solo alertas de seguridad Critical/High bloquean el despliegue; los hallazgos de calidad
  (aunque tengan `rule.severity: error`) se reportan pero no bloquean**, salvo que una alerta de
  calidad también tenga asignado un `security_severity_level` alto (algo que CodeQL hace en algunas
  queries híbridas). Esto se documenta explícitamente aquí porque es fácil confundir ambas escalas de
  severidad al implementar el step de verificación.
- **Alternatives considered**:
  - Parsear el SARIF localmente (`output` del step `analyze`) con `jq` sobre
    `runs[].results[].properties.security-severity` (score numérico) en vez de consultar la API —
    descartada: obliga a reimplementar manualmente el mismo mapeo score→Critical/High/Medium/Low que
    GitHub ya expone directamente como enum en la API (`security_severity_level`), con más
    superficie de error y sin ninguna ventaja (no evita ninguna llamada de red: los otros steps del
    job ya requieren red para instalar CodeQL/subir el SARIF).
  - Repository ruleset "Require code scanning results" con severidad mínima configurada — mismo
    rechazo que en la decisión #1 (bloquea merge, no ejecución de jobs de deploy).

## 5. Versión de `github/codeql-action` (FR-001)

- **Decision**: `github/codeql-action/init@v4` y `github/codeql-action/analyze@v4`.
- **Rationale**: `v4` es la major actualmente soportada junto a `v3` (últimos releases
  `v4.37.1`/`v3.37.1`, 2026-07-16); ya corre sobre Node 24 nativamente, por lo que además de resolver
  FR-001/003/004 no reintroduce el problema de Node.js 20 que resuelve el User Story 2.
- **Alternatives considered**: `v3` — sigue mantenida en paralelo, pero sin motivo para preferirla
  sobre `v4` al ser una integración nueva (no hay migración que evitar).

## 6. Causa raíz del warning de Node.js 20 (FR-006, FR-007, User Story 2)

- **Decision**: El warning ("Node.js 20 is deprecated...") es cosa de GitHub Actions, no del
  proyecto: cada *acción* de terceros/GitHub usada en el workflow declara en su propio `action.yml`
  con qué runtime de Node.js fue construida (`runs.using: node20` o `node24`). GitHub empezó a forzar
  la ejecución de acciones `node20` sobre el runtime `node24` desde el 16 de junio de 2026 (ver
  changelog oficial), con retirada completa de `node20` prevista para el 16 de septiembre de 2026 —
  hoy (2026-07-19) estamos en la ventana donde el runner solo avisa, no falla. El único arreglo
  correcto y no temporal es actualizar cada acción marcada a una versión mayor cuyo propio
  `action.yml` ya declare `node24`; **no** usar la variable de entorno de contingencia
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, porque hay un bug confirmado en `actions/runner`
  ([actions/runner#4295](https://github.com/actions/runner/issues/4295)) donde el aviso de
  deprecación sigue apareciendo aunque esa variable fuerce correctamente la ejecución sobre Node 24
  — el aviso solo desaparece de raíz si la acción declara `node24` en su propio metadata, no con el
  workaround.
- **Rationale**: Es la única solución consistente con FR-006 ("ningún job MUST mostrar avisos"): un
  workaround que solo cambia el runtime en tiempo de ejecución pero no la declaración de la acción no
  elimina el aviso, según el bug confirmado arriba.
- **Alternatives considered**: `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` / mantenerse en Node
  20 hasta la retirada forzosa (16 sept. 2026) — descartada, es exactamente la deuda que el usuario
  pidió corregir ahora, y deja de funcionar en menos de dos meses desde la fecha de esta spec.

## 7. Acciones concretas a actualizar (FR-006, FR-007)

Verificado versión por versión (no solo las dos que el usuario reportó) porque FR-006 exige cero
avisos en **cualquier** job, y algunas acciones usadas en jobs que no aparecen en el log pegado por
el usuario (p. ej. el step condicional `if: failure()` de `e2e-test`) podrían no haber mostrado el
aviso todavía simplemente porque ese step no llegó a ejecutarse en esa run.

| Acción | Versión actual en `ci.yml` | Runtime declarado | Primera versión con `node24` | Acción a tomar |
|---|---|---|---|---|
| `actions/cache` | `@v4` (e2e-test, 2 usos) | `node20` | `v5.0.0` (estable en `v6.1.0`) | Bump a `@v6` |
| `actions/setup-java` | `@v4` (e2e-test) | `node20` | `v5.0.0` (estable en `v5.6.0`) | Bump a `@v5` |
| `actions/upload-artifact` | `@v4` (e2e-test, `if: failure()`) | `node20` (v5 tuvo soporte "preliminar" pero seguía por defecto en node20) | `v6.0.0` | Bump a `@v6` |
| `actions/github-script` | `@v7` (deploy-preview-backend/frontend) | `node20` | `v8.0.0` | Bump a `@v8` |
| `actions/setup-node` | `@v5` (todos los jobs) | `node24` ya | — | Sin cambio de versión (solo cambia el input `node-version`, ver #8) |
| `actions/checkout` | `@v5` (todos los jobs) | `node24` ya | — | Sin cambio |
| `reviewdog/action-actionlint` | `@v1` (lint-workflows) | Acción Docker/contenedor, no JS | N/A | Sin cambio — no sujeta a este aviso (no declara `runs.using: nodeXX`) |

- **Rationale de por qué se incluyen `upload-artifact` y `github-script` sin que el usuario los
  mencionara**: el warning pegado por el usuario lista solo las acciones que efectivamente se
  ejecutaron en esa run concreta; `upload-artifact` en `e2e-test` solo corre si el job falla
  (`if: failure()`), y `github-script` vive en los jobs `deploy-preview-*`, que no forman parte del
  job `e2e-test` de donde viene el log pegado. Dejarlas en `node20` incumpliría FR-006 la primera vez
  que un e2e falle en CI o se abra un PR interno con preview.

## 8. Alineación de `node-version` del proyecto entre jobs (FR-007)

- **Decision**: Cambiar `node-version: 20` → `node-version: 24` en `actions/setup-node@v5` en los
  jobs `backend-test`, `frontend-test`, `release`, `deploy-production-backend`,
  `deploy-production-frontend`, `deploy-preview-backend`, `deploy-preview-frontend` — alineándolos
  con el valor que `e2e-test` ya usa.
- **Rationale**: Es una variable distinta al runtime de las acciones (ver #6): este `node-version`
  determina la versión de Node.js con la que corren los propios comandos `npm ci`/`npm test`/
  `vercel build` del proyecto, no el runtime interno de una acción de terceros. Node 24 es la LTS
  actual (Node 20 entra en EOL en abril de 2026 según el mismo changelog de GitHub, y el propio
  contexto de este repo ya trata Node 20 como deprecado — ver `e2e-test`, que ya migró por la razón
  documentada en su comentario: soporte nativo de TypeScript type-stripping desde Node 24.12.0).
  Unificar todos los jobs a Node 24 elimina la inconsistencia señalada en "Contexto verificado" del
  spec y reduce el riesgo de comportamientos distintos entre jobs de test/build/deploy.
- **Alternatives considered**: Dejar `backend-test`/`frontend-test`/etc. en Node 20 (solo tocar las
  acciones con warning) — descartada: no resuelve la inconsistencia ya señalada en el spec, dejaría
  al repo con Node 20 (a las puertas de su EOL) en 7 de los 8 jobs sin ninguna razón funcional para
  no unificar, dado que el propio `e2e-test` ya demuestra que Node 24 funciona en este pipeline.
- **Riesgo a validar en `quickstart.md`**: `backend/package.json` y `frontend/package.json` no
  declaran hoy un campo `engines` restrictivo conocido que excluya Node 24 (no se ha detectado en el
  research; se confirma en la fase de implementación/tasks ejecutando `npm ci && npm test`
  localmente con Node 24 antes de mergear, no solo confiando en CI).

## 9. Orden final de jobs en `ci.yml` (Assumptions del spec, no requiere clarificación adicional)

- **Decision**: `code-quality` se añade como un job más en paralelo a `backend-test`,
  `frontend-test`, `e2e-test` (mismo trigger, sin `needs` entre ellos), y se añade a la lista
  `needs` de los 4 jobs de despliegue existentes (`deploy-production-backend`,
  `deploy-production-frontend`, `deploy-preview-backend`, `deploy-preview-frontend`), que pasan de
  `needs: [backend-test, frontend-test, e2e-test]` a
  `needs: [backend-test, frontend-test, e2e-test, code-quality]`. El job `release` no depende de
  `code-quality` (igual que hoy no bloquea su ejecución ningún gate de calidad de código, solo
  calcula versión/changelog tras los tests — sin cambios respecto a spec `054`).
- **Rationale**: Documentado en Assumptions del spec: reutiliza exactamente el patrón `needs` ya
  existente (Principio III, consistencia), bloquea el despliegue tal y como pide FR-003/FR-005, y no
  serializa el pipeline (CodeQL corre en paralelo a los tests, no después).
- **Alternatives considered**: orden estrictamente secuencial `build → code quality → test → deploy`
  tal y como lo propuso el usuario originalmente — evaluado y descartado en la spec (Assumptions),
  aceptando la invitación explícita del usuario a proponer un orden mejor.
