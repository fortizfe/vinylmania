# Research: Despliegues de Vercel condicionados al éxito de los tests

**Feature**: `054-gate-deploys-on-passing-tests` | **Date**: 2026-07-19

Fuentes consultadas: skill `vercel:deployments-cicd`, documentación oficial de Vercel
(`vercel.com/docs/project-configuration/git-configuration`, `vercel.com/docs/git/vercel-for-github`,
`vercel.com/docs/cli/deploy`, `vercel.com/docs/cli/list`) vía búsqueda de documentación de Vercel,
y el `ci.yml` / `vercel.json` actuales del repo (`Contexto verificado en el repositorio` en spec.md).

## 1. Cómo desactivar el auto-deploy nativo de Vercel (FR-004)

- **Decision**: Añadir `"git": { "deploymentEnabled": false }` al `vercel.json` de cada proyecto
  (`backend/vercel.json`, `frontend/vercel.json`).
- **Rationale**: Es la propiedad oficial y soportada (no deprecada) para impedir que *cualquier* rama
  dispare un deployment automático vía la integración Git, manteniendo el proyecto enlazado a GitHub
  (necesario para que los deployments creados por CLI sigan asociándose al commit/PR — ver punto 5).
  La alternativa `github.enabled: false` está marcada como legacy/deprecada en la documentación oficial
  a favor de `git.deploymentEnabled`.
- **Alternatives considered**:
  - `github.enabled: false` (legacy) — descartada por estar deprecada.
  - Desconectar el repositorio Git del proyecto en el dashboard de Vercel — descartada porque rompería
    la asociación commit→deployment que necesitan los checks/comentarios de PR (punto 5) y no es
    versionable en el repo (viviría solo como configuración manual en el dashboard).

## 2. Mecanismo de despliegue desde GitHub Actions (FR-001, FR-002)

- **Decision**: Usar el patrón oficial de Vercel para GitHub Actions: `vercel pull` → `vercel build`
  → `vercel deploy --prebuilt`, con el flag `--prod` añadido a `build`/`deploy` solo en el job de
  producción.
- **Rationale**: Es el patrón documentado explícitamente por Vercel para "custom CI pipelines donde
  necesitas más control sobre la conexión entre Git y los deployments" — exactamente el caso de esta
  feature. Separar `build` de `deploy` (`--prebuilt`) permite que el build ocurra dentro del runner de
  Actions después de que los tests ya han pasado, sin re-depender de un build remoto de Vercel que
  ignore el resultado de los tests.
- **Alternatives considered**:
  - `vercel deploy` sin `--prebuilt` (build remoto en Vercel) — funcionalmente válido pero menos
    control/observabilidad del build desde Actions; descartado por preferir el patrón "prebuilt"
    recomendado para CI custom.
  - Acción de terceros (`amondnet/vercel-action` u otra) — descartada: añade una dependencia externa
    no oficial para replicar lo que la CLI oficial ya hace en 3 comandos; menos control y una
    superficie de confianza adicional (Principio III, Simplicity/YAGNI/KISS).

## 3. Secrets necesarios (FR-007)

- **Decision**: 4 GitHub Secrets a nivel de repositorio:
  - `VERCEL_TOKEN` (compartido, token con permisos de deploy en ambos proyectos)
  - `VERCEL_ORG_ID` (compartido, mismo equipo/scope para ambos proyectos)
  - `VERCEL_PROJECT_ID_BACKEND`
  - `VERCEL_PROJECT_ID_FRONTEND`
- **Rationale**: `vercel pull` requiere `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` como variables de entorno
  para identificar el proyecto sin un `.vercel/project.json` pre-existente en el runner (el repo no
  versiona `.vercel/`, ver `.gitignore`). Al ser dos proyectos Vercel independientes (spec
  `005-vercel-separate-projects`), cada uno necesita su propio `PROJECT_ID`; `ORG_ID` y `TOKEN` son
  compartidos porque ambos proyectos viven en el mismo team/scope de Vercel.
- **Alternatives considered**: un solo secret JSON combinado (`VERCEL_CONFIG`) parseado en cada job —
  descartado por añadir un paso de parsing innecesario frente a usar secrets individuales, que
  GitHub Actions ya expone directamente como `${{ secrets.NOMBRE }}`.

## 4. Granularidad de los nuevos jobs (FR-005, FR-008)

- **Decision**: 4 jobs explícitos y nombrados — `deploy-preview-backend`, `deploy-preview-frontend`,
  `deploy-production-backend`, `deploy-production-frontend` — cada uno con
  `needs: [backend-test, frontend-test, e2e-test]`, en vez de una `strategy: matrix`.
- **Rationale**: GitHub Actions no permite indexar el contexto `secrets` dinámicamente con una
  variable de matrix (`secrets[matrix.algo]` no es válido), así que una matrix real obligaría a un
  paso intermedio de "seleccionar el secret correcto según `matrix.project`" — más indirección que
  cuatro jobs simples y literales. El `ci.yml` actual ya usa jobs nombrados explícitos
  (`backend-test`, `frontend-test`, `e2e-test`) en vez de matrices, así que esto mantiene el mismo
  estilo (Principio III, Simplicity/YAGNI/KISS: preferir lo simple/legible sobre lo "clever").
- **Alternatives considered**: `strategy: matrix: project: [backend, frontend]` con 2 jobs — descartada
  por la indirección de secrets explicada arriba, que además complica la lectura de "por qué falló"
  requerida por FR-006/User Story 3.

## 5. Visibilidad del preview en el PR (User Story 2, Acceptance Scenario 1)

- **Decision**: No se añade un paso custom de comentario en el PR. Se confía en que, como el proyecto
  Vercel permanece enlazado a GitHub (solo se desactiva `deploymentEnabled`, no el enlace Git), la
  GitHub App de Vercel sigue asociando cualquier deployment creado por la CLI dentro de un
  `actions/checkout` del PR (que trae consigo el commit SHA y la rama) al PR correspondiente, y
  publica su check/comentario igual que en el flujo nativo — este es precisamente el flujo que la
  documentación oficial de "Vercel for GitHub Actions" describe y promueve para CI custom.
- **Rationale**: Evita reimplementar (y mantener) manualmente algo que la integración Git ya
  resuelve, alineado con Principio III (YAGNI). Es el único punto de este research con incertidumbre
  operativa real (depende del comportamiento observado de la GitHub App de Vercel en este repo
  concreto), así que se marca explícitamente como paso a **verificar manualmente** en
  `quickstart.md` antes de dar la User Story 2 por completa.
- **Alternatives considered**: Paso explícito con `actions/github-script` que comente la URL de
  preview en el PR (patrón documentado también por Vercel como fallback) — se deja documentado como
  **fallback de contingencia** en `quickstart.md` (Paso 6), a añadir solo si la verificación manual
  muestra que el check/comentario automático no aparece.

## 6. Orden relativo entre `deploy-production-*` y `release` (Assumption, plan-level per spec)

- **Decision**: `deploy-production-backend` y `deploy-production-frontend` se ejecutan **en paralelo**
  con `release`, no en secuencia — los tres comparten el mismo `needs: [backend-test, frontend-test,
  e2e-test]` y el mismo `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, sin
  depender entre sí.
- **Rationale**: El commit que se despliega a producción es el que ya pasó los tests (el push
  original), no el commit de version-bump que genera `release` (que además lleva `[skip ci]` y no
  contiene cambios de comportamiento, solo `CHANGELOG.md`/`version`). No hay ninguna relación de
  datos entre ambos jobs que justifique una dependencia secuencial, y añadirla incrementaría
  innecesariamente el tiempo hasta "Ready" (relevante para SC-002).
- **Alternatives considered**: `deploy-production-*` con `needs` incluyendo también `release` —
  descartada porque ataría el despliegue a un job cuyo único propósito es metadata de versión, sin
  beneficio funcional, y violaría el margen de SC-002 sin necesidad.

## 7. Orden entre pushes consecutivos a `main` (Edge Case, FR alineado con SC-002)

- **Decision**: Cada uno de los dos jobs de producción (`deploy-production-backend`,
  `deploy-production-frontend`) usa su propio grupo de concurrencia:
  `concurrency: { group: deploy-production-backend, cancel-in-progress: false }` (análogo para
  frontend), replicando el patrón ya usado por el job `release` (`group: release-main,
  cancel-in-progress: false`).
- **Rationale**: Garantiza que dos pushes seguidos a `main` no produzcan deployments de producción
  solapados o fuera de orden para el mismo proyecto, consistente con la garantía que ya ofrece
  `release`. Un grupo por proyecto (no uno compartido entre backend y frontend) evita que un deploy
  lento de un proyecto bloquee innecesariamente al otro.
- **Alternatives considered**: un único grupo `deploy-production` compartido por ambos proyectos —
  descartado porque serializaría sin necesidad dos despliegues independientes (proyectos Vercel
  separados, spec `005`), penalizando SC-002 sin aportar ninguna garantía adicional.

## 8. Validación tipo "Test-First" para un cambio de infraestructura CI (Principio I)

- **Decision**: Dado que `.github/workflows/ci.yml` no tiene un harness de test unitario en este repo
  (es YAML declarativo, no código ejecutable de la aplicación), la validación "test-first" de esta
  feature se satisface con los **Independent Test** ya descritos en cada User Story del spec
  (ejecutados manualmente contra una rama/PR real antes de dar la feature por completa: romper un
  test a propósito → confirmar ausencia de deployment → arreglarlo → confirmar que el deployment
  ocurre), documentados como pasos reproducibles en `quickstart.md`.
- **Rationale**: Aplicar literalmente Red-Green-Refactor a YAML de CI no tiene equivalente directo;
  el propio repo ya trata `scripts/release/*` como código testeable con `node --test` porque es JS
  ejecutable, pero `ci.yml` no lo es. Se documenta esta desviación explícitamente en
  `plan.md` → Complexity Tracking, tal como exige la constitución para cualquier desviación de un
  principio.
- **Update (post `/speckit-analyze`, 2026-07-19)**: Dado que Principio I está marcado
  **NON-NEGOTIABLE** en la constitución, la desviación puramente manual se consideró insuficiente en
  el análisis de consistencia. Se adopta `actionlint` como job `lint-workflows` en `ci.yml` (corre en
  cada push/PR): mitigación parcial pero real y automatizada, aceptada explícitamente por el
  responsable del proyecto junto con la propia desviación documentada. Sigue sin cubrir el
  comportamiento real de gating (eso solo es observable ejecutando el workflow), pero deja de ser
  "cero automatización".
- **Alternatives considered**: Dejar la validación puramente manual (vía `quickstart.md`) sin ningún
  gate automatizado — descartado tras el análisis de consistencia por la etiqueta NON-NEGOTIABLE del
  principio, que pide más que una desviación silenciosa aunque esté documentada.
