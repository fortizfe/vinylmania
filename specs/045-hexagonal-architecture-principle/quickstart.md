# Quickstart: Validar el nuevo Core Principle de Hexagonal Architecture

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md)

No hay código que ejecutar ni servidor que levantar: esta historia es un cambio
normativo sobre `.specify/memory/constitution.md`. La validación consiste en leer el
fichero resultante y comprobar, uno a uno, los criterios de aceptación del spec.

## Prerrequisitos

- Tener la rama `045-hexagonal-architecture-principle` con los cambios de
  implementación ya aplicados sobre `.specify/memory/constitution.md` y (si aplica)
  `.specify/templates/plan-template.md` / `.specify/templates/spec-template.md`.

## Pasos de validación

1. **Versión y fecha de amendment**

   ```bash
   grep -E '\*\*Version\*\*|\*\*Last Amended\*\*' .specify/memory/constitution.md
   ```

   Esperado: `**Version**: 2.5.0 | **Ratified**: 2026-07-03 | **Last Amended**: <fecha real>`.

2. **Sync Impact Report actualizado**

   ```bash
   sed -n '1,40p' .specify/memory/constitution.md
   ```

   Esperado: el comentario documenta `Version change: 2.4.0 → 2.5.0`, con
   `Added sections` listando el nuevo Core Principle VIII, y `Templates requiring
   updates` mostrando el resultado de la comprobación de `plan-template.md` y
   `spec-template.md` (✅ si no requieren cambio, o la actualización aplicada).

3. **El nuevo principio existe con el formato correcto**

   ```bash
   grep -n '^### VIII\.' .specify/memory/constitution.md
   ```

   Esperado: una línea `### VIII. Hexagonal Architecture (Ports & Adapters)` (o título
   equivalente), seguida de un cuerpo en lenguaje MUST/MUST NOT y un párrafo
   `**Rationale**:` — mismo formato que los Principios I-VII.

4. **Prueba de "clasificación sin ambigüedad"** (criterio de aceptación 2 /
   SC-001 del spec): leer solo el texto del nuevo principio (sin mirar código) y
   clasificar estos 5 ficheros reales de `backend/src` en Dominio/Aplicación/
   Puerto/Adaptador, en menos de 1 minuto cada uno:

   | Fichero | Clasificación esperable tras leer el principio |
   |---|---|
   | `library/libraryService.ts` (hoy con `import { getFirestoreDb } from '../config/firebase-admin'`) | Dominio/Aplicación tras migrar — hoy viola la regla; el principio debe hacer evidente que esta línea es una violación |
   | `middleware/requireAuth.ts` (hoy con `getFirebaseAuth()` directo) | Adaptador driving que hoy viola la regla — el principio debe hacer evidente que debería depender de un puerto |
   | `config/logger.ts` | Módulo transversal, fuera de la regla de dependencia (ver data-model.md) |
   | `shared/concurrency.ts` | Utilidad transversal, fuera de la separación de capas (ver data-model.md) |
   | `discogs/discogsErrors.ts` | Dominio — jerarquía de errores tipados, patrón ya conforme citado explícitamente por el principio |

   Si alguna clasificación queda dudosa solo con el texto del principio (sin inferir
   ni preguntar), el principio no cumple SC-001 y debe reescribirse antes de cerrar la
   historia.

5. **Alcance explícito (`backend/` vs `frontend/`/`e2e/`)**

   ```bash
   grep -n 'frontend\|e2e' .specify/memory/constitution.md | grep -i hexagonal
   ```

   Esperado: el nuevo principio (o su Rationale) deja explícito que no aplica a
   `frontend/` ni a `e2e/`.

6. **Plantillas revisadas**

   Confirmar en el Sync Impact Report (paso 2) que ambas plantillas aparecen con
   ✅ ("sin cambios necesarios") o con la actualización real aplicada — no deben
   quedar sin mencionar.

## Resultado esperado

Todos los pasos 1-6 pasan sin necesidad de ejecutar tests automatizados ni levantar
el backend: la historia se considera completa cuando `constitution.md` (y, si aplica,
las plantillas) reflejan exactamente lo verificado arriba.
