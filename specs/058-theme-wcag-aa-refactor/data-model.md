# Data Model: Refactor de tema claro/oscuro para cumplimiento estricto WCAG 2.1 AA

No hay persistencia ni base de datos implicada en esta funcionalidad (ver Technical Context, Storage: N/A). Las siguientes entidades son **conceptuales**: describen la estructura de las comprobaciones e2e ampliadas (`e2e/tests/*.spec.ts`) que implementan FR-010/FR-011, apoyadas en la infraestructura ya existente (`@axe-core/playwright`, `e2e/helpers/contrast.ts` — ver research.md §1).

## ScreenScan

Representa una comprobación de accesibilidad automatizada (vía `AxeBuilder(...).withTags(['wcag2a', 'wcag2aa'])`, patrón ya usado en `e2e/tests/sign-in.spec.ts`) sobre una pantalla concreta en un tema concreto.

| Campo | Tipo | Descripción |
|---|---|---|
| `route` | `string` | Ruta de la pantalla (p. ej. `/`, `/app`, `/app/search`, `/app/library`, `/app/profile`). |
| `authState` | `"anonymous" \| "authenticated"` | Si la pantalla requiere sesión (usa `signInAsFakeGoogleUser`, ya disponible en `e2e/helpers/fakeGoogleSignIn.ts`). |
| `theme` | `"light" \| "dark"` | Tema emulado con `page.emulateMedia({ colorScheme })` antes del escaneo. |
| `specFile` | `string` | Spec e2e existente que aloja esta comprobación (p. ej. `e2e/tests/sign-in.spec.ts`, `e2e/tests/dashboard-feed-grid.spec.ts`). |
| `allowedViolations` | `string[]` | Vacío por defecto; solo admite un id de regla axe si hay una excepción documentada con rationale (Development Workflow — "Any deviation... MUST be documented"). |

**Reglas de validación**:
- Toda `ScreenScan` DEBE filtrar violaciones por `impact` (`serious`/`critical`), igual que `sign-in.spec.ts:70-73`, y afirmar que la lista resultante está vacía.
- Cada pantalla listada en FR-009 DEBE tener al menos una `ScreenScan` por tema (2 por pantalla como mínimo).

## ComponentContrastCheck

Representa una comprobación de contraste puntual (patrón `assertReadableContrast`/`getContrastRatio` de `e2e/helpers/contrast.ts`, ya usado en `e2e/tests/dark-mode-contrast.spec.ts`) para un par que axe no cubre de forma fiable: bordes/rellenos de componentes de UI y indicadores de foco (WCAG 1.4.11).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador legible (p. ej. `button-primary-border-on-surface`, `input-focus-ring`). |
| `elementLocator` | `string` | Descripción del locator Playwright del elemento evaluado (p. ej. `getByRole('button', { name: /sign in with google/i })`). |
| `comparisonSurface` | `string` | Qué se usa como "fondo" de comparación: la superficie adyacente real (vía `getComputedStyle` del padre/página), no un valor hardcodeado. |
| `theme` | `"light" \| "dark" \| "both"` | Tema(s) en los que se evalúa. |
| `kind` | `"ui-component" \| "focus-indicator"` | Determina que el umbral exigido es 3:1 (FR-003/FR-004). |
| `specFile` | `string` | Spec e2e donde se añade (existente o nuevo, agrupado por pantalla). |

**Reglas de validación**:
- El ratio se calcula siempre sobre colores leídos con `getComputedStyle` en la página real (nunca sobre un valor declarado en CSS/TS), consistente con research.md §1.
- Todo `ComponentContrastCheck` DEBE corresponder a un componente/página real de `frontend/src/components/ui/*` o superficie de navegación — no se admiten comprobaciones "teóricas" sin un elemento renderizable real.

## StateSignal (verificación manual, US3)

No es una entidad automatizable (WCAG 1.4.1 "Use of Color" no es fiablemente detectable por axe ni por un cálculo de contraste); se documenta como checklist de revisión manual, ejecutada según `quickstart.md`, no como parte del test suite.

| Campo | Tipo | Descripción |
|---|---|---|
| `component` | `string` | Componente/página que comunica un estado (p. ej. `ReleaseRatingBadge`, `FeedSourceStatusBanner`). |
| `signalBeyondColor` | `string` | Señal no-color ya presente o añadida (texto, icono, patrón). |
| `verifiedBy` | `string` | Cómo se confirmó (p. ej. "emulador de daltonismo de Chrome DevTools", revisión manual per `quickstart.md` paso 3). |

## Relaciones

```text
Screen/Componente (frontend/src) ──< se escanea con >── ScreenScan (e2e/tests/*.spec.ts)
Componente de UI interactivo    ──< se verifica con >── ComponentContrastCheck (e2e/helpers/contrast.ts)
Componente con estado           ──< se revisa con >──── StateSignal (manual, quickstart.md)
```

No hay transiciones de estado: `ScreenScan` y `ComponentContrastCheck` son comprobaciones deterministas que se ejecutan en cada corrida de la suite e2e (gate de la constitución para PRs de `/frontend`); `StateSignal` es un checklist de revisión, no un artefacto ejecutable.
