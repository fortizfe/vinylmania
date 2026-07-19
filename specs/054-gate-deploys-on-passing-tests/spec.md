# Feature Specification: Despliegues de Vercel condicionados al éxito de los tests

**Feature Branch**: `054-gate-deploys-on-passing-tests`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Quiero que la pipeline CI de GitHub Actions actual, solo haga los despliegues (tanto preview como producción) si se han superado primero las 3 fases de test. Actualmente se hace en paralelo y aunque fallen los tests el despliegue se realiza."

## Contexto verificado en el repositorio

- `.github/workflows/ci.yml` define tres jobs de test en paralelo: `backend-test`, `frontend-test` y `e2e-test`. Un cuarto job, `release` (cálculo de versión/changelog en `main`), ya depende de los tres vía `needs: [backend-test, frontend-test, e2e-test]` — es el precedente a seguir para el nuevo comportamiento.
- **No existe ningún job de despliegue en `ci.yml`.** Los despliegues de Vercel (preview en cada pull request, producción en cada push a `main`) los dispara la integración nativa de Vercel con GitHub (`backend/vercel.json` y `frontend/vercel.json`, ambos sin `git.deploymentEnabled: false`), de forma independiente y en paralelo al workflow de Actions, sin ninguna dependencia del resultado de los tests. Esto explica el problema reportado.
- El commit de versión que genera el job `release` usa `[skip ci]` (`scripts/release/run-release.js`), por lo que no dispara una segunda ejecución del workflow.

## Clarifications

### Session 2026-07-19

- Q: SC-002 dice que el tiempo entre "tests en verde" y "deployment Ready" no debe empeorar "de forma perceptible" respecto al tiempo actual push→deployment. ¿Qué margen concreto se considera aceptable? → A: Margen de ±20% sobre el tiempo actual push→Ready.
- Q: FR-002 exige preview tras un evento de pull request usando secrets de Vercel (FR-007), pero GitHub Actions no expone secrets a PRs desde forks en el evento `pull_request` estándar. ¿Debe soportarse preview para PRs desde forks? → A: No. Solo PRs desde ramas internas (mismo repo) generan preview; PRs desde forks quedan fuera de alcance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bloquear el despliegue a producción si los tests fallan (Priority: P1)

Como responsable del proyecto, quiero que el despliegue a producción (proyectos Vercel de backend y frontend) solo se dispare cuando los tres jobs de test hayan pasado en un push a `main`, para no publicar código roto en el entorno que usan los usuarios reales.

**Why this priority**: Producción es el entorno de mayor impacto; es el caso que más daño causa si sigue fallando.

**Independent Test**: Hacer push a `main` con un test roto a propósito (en backend, frontend o e2e) y confirmar que no se genera ningún deployment de producción en Vercel para ese commit. Arreglar el test y confirmar que el despliegue sí se produce.

**Acceptance Scenarios**:

1. **Given** un push a `main` donde los tres jobs de test terminan en verde, **When** el workflow finaliza, **Then** se crea un deployment de producción para los proyectos backend y frontend y llega a estado Ready.
2. **Given** un push a `main` donde al menos uno de los tres jobs de test falla, **When** el workflow finaliza, **Then** no se crea ningún deployment de producción para ese commit.
3. **Given** los tests de un push a `main` aún en ejecución, **When** antes se habría disparado el auto-deploy de Vercel, **Then** ningún despliegue arranca hasta que los tres jobs de test hayan reportado éxito.

---

### User Story 2 - Bloquear el despliegue preview si los tests fallan (Priority: P2)

Como revisor de un pull request, quiero que el despliegue preview solo se genere si los tres jobs de test pasan, para no revisar ni probar una build sobre código que no pasa los tests.

**Why this priority**: Menor impacto que producción, pero evita perder tiempo revisando previews de código roto y mantiene la misma lógica de bloqueo en todos los entornos.

**Independent Test**: Abrir un PR con un test roto a propósito y confirmar que no aparece ningún deployment preview de Vercel en los checks del PR. Arreglar el test y confirmar que el preview sí aparece.

**Acceptance Scenarios**:

1. **Given** un PR donde los tres jobs de test terminan en verde, **When** el workflow finaliza, **Then** se crea un deployment preview y su URL queda visible en los checks/comentarios del PR.
2. **Given** un PR donde al menos uno de los tres jobs de test falla, **When** el workflow finaliza, **Then** no se crea ningún deployment preview para ese commit.
3. **Given** un PR con un push nuevo mientras los tests anteriores seguían corriendo, **When** los nuevos tests aún no han terminado, **Then** no se genera un preview nuevo hasta que los tests de ese commit concreto pasen (no debe quedar un preview "viejo" que confunda a quien revisa pensando que corresponde al código actual).

---

### User Story 3 - Visibilidad del motivo de bloqueo (Priority: P3)

Como responsable del proyecto, quiero ver claramente en GitHub Actions por qué no se ha desplegado, para diagnosticar sin tener que entrar al dashboard de Vercel.

**Why this priority**: Reduce tiempo de diagnóstico, pero no bloquea el valor principal (que no se despliegue código roto), por eso es la de menor prioridad.

**Independent Test**: Forzar el fallo de un job de test y comprobar que el job de despliegue aparece como "Skipped" (con la dependencia visible hacia el job de test que falló) en el resumen del workflow run, en vez de simplemente no aparecer.

**Acceptance Scenarios**:

1. **Given** un job de test en fallo, **When** se consulta el resumen del workflow run en GitHub Actions, **Then** el job de despliegue correspondiente muestra estado "Skipped" con su dependencia (`needs`) señalando el job de test que impidió su ejecución.

---

### Edge Cases

- ¿Qué ocurre si un job de test es cancelado manualmente en vez de fallar? El despliegue tampoco debe ejecutarse (dependencia `needs` no satisfecha = Skipped).
- ¿Qué ocurre si se hace "re-run failed jobs" en GitHub Actions sobre un run cuyo test había fallado? El despliegue debe re-evaluarse tras el re-run y proceder solo si el resultado final de los tres jobs es verde.
- ¿Qué ocurre con varios pushes seguidos a `main` en poco tiempo? Debe evitarse que dos despliegues de producción se solapen o terminen fuera de orden (el job `release` ya usa `concurrency: group: release-main, cancel-in-progress: false`; el nuevo comportamiento de despliegue debe ser coherente con esa misma garantía de orden).
- ¿Qué ocurre con el commit `[skip ci]` que genera el propio job `release`? No debe interpretarse como una ejecución "sin tests" que dispare un despliegue: al llevar `[skip ci]`, GitHub Actions no relanza el workflow para ese commit, por lo que no debe generar un despliegue adicional fuera del run que ya validó los tests.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST disparar el despliegue de producción (backend y frontend) únicamente tras un push a `main` en el que los tres jobs `backend-test`, `frontend-test` y `e2e-test` hayan finalizado en éxito.
- **FR-002**: El sistema MUST disparar el despliegue preview (backend y frontend) únicamente tras un evento de pull request originado desde una rama interna del propio repositorio (no un fork) en el que los tres jobs de test hayan finalizado en éxito. Los PRs originados desde forks quedan fuera de alcance de esta funcionalidad (no generan preview automático), dado que GitHub Actions no expone los secrets del repositorio a ese tipo de PR.
- **FR-003**: Si cualquiera de los tres jobs de test falla o se cancela, el sistema MUST NOT crear ningún deployment (preview ni producción) para ese commit.
- **FR-004**: El auto-deploy nativo de Vercel vía integración Git MUST quedar desactivado para ambos proyectos (backend y frontend), de forma que el despliegue solo pueda originarse desde el workflow de GitHub Actions tras la validación de tests.
- **FR-005**: El nuevo comportamiento MUST seguir el mismo patrón de dependencia (`needs: [backend-test, frontend-test, e2e-test]`) ya usado por el job `release` existente, para mantener consistencia dentro del pipeline.
- **FR-006**: El resultado de cada intento de despliegue (éxito, fallo u omitido por dependencia no satisfecha) MUST quedar visible en el resumen del workflow run de GitHub Actions.
- **FR-007**: Las credenciales necesarias para desplegar desde Actions MUST almacenarse como GitHub Secrets del repositorio, nunca en texto plano en el código ni en logs.
- **FR-008**: El comportamiento MUST cubrir ambos proyectos Vercel (backend y frontend) de forma equivalente, sin que uno quede desprotegido mientras el otro sí está condicionado a los tests.

### Key Entities *(include if feature involves data)*

- **Test job**: unidad de validación existente (`backend-test`, `frontend-test`, `e2e-test`) que ya corre en paralelo dentro de `ci.yml`; su resultado (éxito/fallo) es la condición de entrada para el despliegue.
- **Deploy job**: nueva unidad de trabajo a incorporar en `ci.yml` (una para preview, otra para producción), responsable de generar el deployment en Vercel solo cuando los test jobs lo permitan.
- **Proyecto Vercel**: backend y frontend, cada uno desplegado de forma independiente (según spec `005-vercel-separate-projects`), con sus propias credenciales/identificadores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cero despliegues (preview o producción) se generan para commits/PRs en los que al menos uno de los tres test jobs falla, verificado en las primeras 2 semanas tras el cambio.
- **SC-002**: El tiempo total entre el push/apertura del PR y el deployment en estado Ready no supera en más de un 20% el tiempo actual equivalente (no-regresión de rendimiento del pipeline), medido sobre el promedio de los despliegues de las 2 semanas posteriores al cambio.
- **SC-003**: Ante un despliegue que no se produce, cualquier persona del equipo puede identificar el motivo (qué test falló) en menos de 1 minuto consultando únicamente la pestaña Actions de GitHub, sin entrar al dashboard de Vercel.

## Assumptions

- Se asume acceso de administración a los dos proyectos Vercel (backend, frontend) para desactivar su auto-deploy por integración Git.
- Se asume que se pueden crear los GitHub Secrets necesarios para desplegar vía Vercel CLI desde Actions (token de Vercel, org id, project id por proyecto) — el mecanismo concreto se define en la fase de plan, no en esta spec.
- "Producción" se refiere a los despliegues resultantes de un push a `main`; "preview" a los resultantes de un pull request — mismo criterio que ya usa el job `release` existente (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`).
- El job `release` (cálculo de versión y changelog) sigue existiendo y ejecutándose con el mismo `needs`; el orden relativo entre `release` y el nuevo `deploy-production` dentro del mismo run es una decisión de diseño a resolver en `plan.md`, no bloquea esta especificación.
- Fuera de alcance de esta HU: cambiar qué se testea en cada job, añadir nuevos tests, o modificar el comportamiento de rollback ante un despliegue fallido.
- Fuera de alcance de esta HU: generar despliegues preview para pull requests originados desde repositorios forkeados, dado que GitHub Actions no expone secrets del repositorio a ese tipo de evento por defecto; el repositorio no tiene histórico de contribuciones externas por fork.
