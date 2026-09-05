# Implementation Plan: Refactor de tema claro/oscuro para cumplimiento estricto WCAG 2.1 AA

**Branch**: `058-theme-wcag-aa-refactor` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/058-theme-wcag-aa-refactor/spec.md`

## Summary

Auditar y corregir todas las combinaciones de color (texto/fondo, bordes de componentes de UI, indicadores de foco) usadas por los temas claro y oscuro existentes de Vinylmania, hasta que cada una cumpla los umbrales WCAG 2.1 AA aplicables (4.5:1 texto normal, 3:1 texto grande y componentes de UI), eliminar cualquier dependencia exclusiva del color para transmitir estado, y ampliar la infraestructura de verificación WCAG que el proyecto **ya tiene** en `e2e/` (`@axe-core/playwright`, usado en `sign-in.spec.ts`, y el helper propio `e2e/helpers/contrast.ts`, usado en `dark-mode-contrast.spec.ts`) a todas las pantallas y ambos temas, para que una futura regresión de contraste falle el build en lugar de reaparecer silenciosamente (como ha ocurrido en features anteriores: 032, 017, 019, 039, 043).

## Technical Context

**Language/Version**: TypeScript ~6.0 / React 19.2 en `frontend/`; TypeScript + Playwright Test en `e2e/` (sin cambios de versión en ninguno de los dos)

**Primary Dependencies**: Tailwind CSS v4 (tokens `@theme` en `frontend/src/styles/global.css`, sin cambios de arquitectura); `@axe-core/playwright` y `@playwright/test` (ambos ya devDependencies de `e2e/package.json`) para el escaneo WCAG 2a/2aa automatizado; el helper existente `e2e/helpers/contrast.ts` (`relativeLuminance`/`getContrastRatio`) para las comprobaciones de contraste que axe no cubre de forma fiable (bordes de componentes de UI, foco). Ninguna dependencia nueva de producción ni de test (Principio III, YAGNI/KISS) — ver research.md §1 para la corrección respecto a la idea inicial de construir un mecanismo propio en `frontend/`.

**Storage**: N/A (no hay modelo de datos ni persistencia; el "dato" de esta funcionalidad son los propios tokens de color en CSS y los colores realmente renderizados)

**Testing**: Vitest + RTL para cualquier test de componente existente que se vea afectado por un cambio de clase de color (regresión); Playwright (`e2e/`) para la verificación WCAG en sí — TDD: los specs e2e ampliados (escaneo axe por pantalla/tema y aserciones de contraste de componentes de UI) se ejecutan primero y deben fallar (rojo) contra el estado actual del tema antes de ajustar ningún valor de color (Principio I)

**Target Platform**: Web (navegador), servido por Vite; el tema se selecciona vía la clase `dark` en `<html>` controlada por `frontend/src/theme/ThemeContext.tsx` / `useThemePreference.ts`, y se emula en los tests e2e con `page.emulateMedia({ colorScheme })` (patrón ya usado en `dark-mode-contrast.spec.ts`)

**Project Type**: Aplicación web — el refactor de color en sí es frontend (`frontend/`); la comprobación automatizada que lo garantiza vive en `e2e/`, ampliando specs ya existentes; no se toca `backend/`

**Performance Goals**: N/A — cambio puramente visual/de color; no se introducen nuevas peticiones de red ni cálculos en runtime del cliente (la comprobación de contraste corre solo en la suite e2e/CI, no en el cliente)

**Constraints**: Debe respetar las reglas ya vigentes de "UI Design System & Styling" de la constitución (configuración CSS-first en `@theme`, sin `tailwind.config.js`, sin CSS custom no justificado, paleta warm-neutral `stone` + los dos acentos de marca); solo existen los dos temas ya soportados (claro/oscuro); los ajustes se hacen sobre los tokens compartidos existentes, no sobre una reconstrucción del sistema de diseño; la comprobación automatizada se apoya en la infraestructura e2e ya existente (`@axe-core/playwright`, `e2e/helpers/contrast.ts`) en vez de crear una nueva

**Scale/Scope**: Todo `frontend/src` (77 componentes/páginas `.tsx` a fecha de esta auditoría): 10 páginas (`src/pages/*`), componentes atómicos compartidos (`src/components/ui/*`: Button, Badge, Card, Input, Checkbox, Modal, ReleaseRatingBadge, ThemeToggle, ViewModeToggle, etc.), componentes de filtros (`src/components/filters/*`) y de marca (`src/components/brand/*`), y el archivo único de tokens `frontend/src/styles/global.css`; en `e2e/`, ampliación de `e2e/tests/sign-in.spec.ts` (patrón axe) y `e2e/tests/dark-mode-contrast.spec.ts` (patrón de contraste manual) a ~26 specs ya existentes que cubren las mismas pantallas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Regla | Aplica | Evaluación |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Sí | El test de contraste (enumera pares de color y falla si no llegan al umbral AA) se escribe antes de tocar ningún valor de color; ajustes visuales existentes se acompañan de/o quedan cubiertos por ese test. PASS. |
| II. Discogs Integration-First & Modularity | No | Sin cambios de integración con Discogs. N/A. |
| III. Simplicity, YAGNI & KISS | Sí | Se descarta construir un mecanismo de verificación nuevo (parseo de `global.css`, librería de contraste) a favor de ampliar la infraestructura de accesibilidad que el proyecto ya tiene y ya usa en `e2e/` (`@axe-core/playwright`, helper propio de contraste) — ver research.md §1. PASS. |
| IV. SOLID Design | Sí | La responsabilidad de "calcular contraste" queda en un módulo único y reutilizable, separado de los componentes de UI; no se modifica la forma en que los componentes consumen los tokens (siguen usando clases Tailwind). PASS. |
| V. Observability | No | No hay operaciones de negocio ni logs nuevos que emitir; el "diagnóstico" de esta funcionalidad es el propio test de contraste (su salida ya es texto greppable). N/A. |
| VI. Versioning & Breaking Changes | Sí | No se rompe ningún contrato de API ni esquema de datos; es un cambio de estilo con corrección de bug de accesibilidad → PATCH/`fix:` (o `refactor:` para reestructuración de tokens sin cambio de comportamiento), sin plan de migración necesario. PASS. |
| VII. Curated Ratings & Music News | Parcial | Las bandas de color de `ReleaseRatingBadge` (low/medium/high) están dentro del alcance de esta auditoría de contraste, pero no se cambia su semántica de negocio (escala, umbrales de rating). PASS. |
| VIII. Hexagonal Architecture — Backend | No | Sin cambios en `backend/`. N/A. |
| IX. Frontend Network Requests — Backend-Only | No | Sin peticiones de red nuevas ni modificadas. N/A. |
| X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE) | Sí | Es el objeto directo de esta funcionalidad: contraste de texto (1.4.3), de componentes de UI (1.4.11) y no dependencia del color (1.4.1) en ambos temas, con gate automatizado (FR-010/FR-011). PASS por diseño. |
| XI. Apple Design Principles Compliance | Sí | Los ajustes de color se mantienen dentro de la paleta warm-neutral + dos acentos de marca ya establecida; donde un valor de marca no alcance AA, el Principio X prevalece según ya establece la propia constitución. PASS. |
| UI Design System & Styling (Tailwind v4) | Sí | Los ajustes se aplican como valores dentro del `@theme` block existente o como sustitución de una clase Tailwind por otra del mismo sistema (p. ej. `stone-700` → `stone-800`); no se crea `tailwind.config.js` ni CSS ad-hoc. PASS. |
| e2e obligatorio para PRs de `/frontend` | Sí | Cambios de color no alteran flujos de usuario, por lo que no se espera e2e nuevo; si algún test e2e existente hace aserciones sobre un valor de color/clase que cambia, se actualiza como parte de esta misma PR. PASS. |

**Resultado**: Sin violaciones. No se requiere la tabla de Complexity Tracking.

**Re-check post Phase 1 (diseño)**: Confirmado tras generar `research.md`, `data-model.md`, `contracts/contrast-pairing-registry.md` y `quickstart.md` — el diseño no añade dependencias nuevas, no introduce `tailwind.config.js` ni CSS ad-hoc, y ancla la comprobación automatizada en la infraestructura e2e ya existente (`@axe-core/playwright`, `e2e/helpers/contrast.ts`) en vez de duplicarla en `frontend/`. Sin nuevas violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/058-theme-wcag-aa-refactor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── styles/
│   │   └── global.css              # Fuente única de los tokens de tema (@theme) — se ajustan aquí los valores de color
│   ├── theme/
│   │   ├── ThemeContext.tsx        # Selección de tema claro/oscuro (sin cambios de comportamiento)
│   │   └── useThemePreference.ts
│   ├── components/
│   │   ├── ui/                     # Button, Badge, Card, Input, Checkbox, Modal, ReleaseRatingBadge,
│   │   │                           # ThemeToggle, ViewModeToggle, Skeleton, StarRating, Avatar, ...
│   │   ├── filters/
│   │   └── brand/
│   └── pages/                      # DashboardPage, LibraryListPage, SearchResultsPage, ReleaseDetailPage,
│                                    # MasterReleaseDetailPage, LandingPage, ProfilePage, WishlistPage, ...
└── tests/
    └── unit/                       # Sin nuevo subdirectorio: solo se tocan tests existentes si una clase de
                                     # color cambiada rompe una aserción (regresión), no se crea infraestructura nueva

e2e/
├── helpers/
│   └── contrast.ts                 # Ya existe (relativeLuminance/getContrastRatio) — se amplía con
│                                    # aserciones de contraste de componentes de UI/foco (US2)
└── tests/
    ├── sign-in.spec.ts             # Ya existe — patrón AxeBuilder(wcag2a/wcag2aa) a replicar en más specs
    ├── dark-mode-contrast.spec.ts  # Ya existe — patrón de contraste de texto a ampliar a ambos temas y más pantallas
    └── ...                        # resto de specs por pantalla (dashboard, library, search-results, release-detail,
                                    # master-release-detail, profile, wishlist, header) reciben el mismo escaneo axe
                                    # + aserciones de contraste ampliadas, en light y dark

# backend/ no se modifica como parte de esta funcionalidad (ver Constitution Check)
```

**Structure Decision**: El refactor de valores de color es exclusivamente frontend; los tokens siguen viviendo únicamente en `frontend/src/styles/global.css` (regla "CSS-first configuration" de la constitución). La comprobación automatizada (FR-010/FR-011) **no** vive en `frontend/`: se implementa ampliando los specs e2e ya existentes en `e2e/tests/` (escaneo `@axe-core/playwright` por pantalla/tema, más el helper `e2e/helpers/contrast.ts` para componentes de UI), consistente con la regla de la constitución de que la suite e2e es el gate de calidad para PRs de `/frontend`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
