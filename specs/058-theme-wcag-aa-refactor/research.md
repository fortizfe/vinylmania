# Phase 0 Research: Refactor de tema claro/oscuro para cumplimiento estricto WCAG 2.1 AA

> **Nota de corrección (post-descubrimiento)**: la versión inicial de este documento proponía construir un mecanismo de verificación nuevo bajo `frontend/tests/unit/theme/` que parseaba `global.css` como texto. Al inspeccionar `e2e/` para `/speckit-tasks` se descubrió que el proyecto **ya tiene** infraestructura de verificación WCAG automatizada funcionando en producción de tests (`@axe-core/playwright` y un helper propio de contraste). Este documento queda reescrito para apoyarse en esa infraestructura existente en vez de duplicarla.

## 1. Mecanismo de verificación automatizada (FR-010/FR-011)

**Decision**: Reutilizar y extender la infraestructura de accesibilidad automatizada que el proyecto ya tiene en `e2e/`:

- **`@axe-core/playwright`** (ya es devDependency de `e2e/package.json` y ya se usa en `e2e/tests/sign-in.spec.ts:69` — `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()`, filtrando violaciones `serious`/`critical`) se amplía para escanear todas las pantallas principales de la aplicación, en ambos temas, no solo la landing page.
- **El helper propio `e2e/helpers/contrast.ts`** (`relativeLuminance`, `getContrastRatio`, ya usado en `e2e/tests/dark-mode-contrast.spec.ts` para verificar contraste de texto en modo oscuro sobre 4 pantallas) se amplía con aserciones específicas para límites de componentes de UI (bordes de botones/inputs/toggles/badges) e indicadores de foco — casos que el ruleset automático de axe no cubre de forma fiable (WCAG 1.4.11 sigue estando parcialmente fuera del alcance de la detección automática de axe-core, algo que la propia documentación de axe reconoce).

No se crea ningún mecanismo nuevo de cálculo de contraste ni ningún test bajo `frontend/`.

**Rationale**:
- **Consistencia con lo ya establecido**: el propio comentario de `e2e/tests/sign-in.spec.ts:63` referencia explícitamente "FR-010/SC-006" de una feature anterior (032 — landing page refresh) resolviendo el mismo tipo de requisito con esta misma herramienta. Repetir el patrón evita divergencia de enfoque para el mismo problema (Principio III, YAGNI/KISS: no reinventar lo que ya funciona).
- **Corrección técnica**: Tailwind CSS v4 resuelve sus colores internamente en el espacio `oklch`, no en el hex literal declarado en el `@theme` block (documentado en el propio comentario de `e2e/helpers/contrast.ts`'s consumidor, `dark-mode-contrast.spec.ts:14-19`, que por eso normaliza el color pintándolo en un canvas de 1×1 en vez de parsear el string). Un mecanismo que parseara `frontend/src/styles/global.css` como texto (la idea original de este documento) leería el valor hex *declarado*, no el color *realmente renderizado* tras la conversión de espacio de color, cascada CSS y estados (`hover`, `disabled`, `dark:`) — pudiendo dar falsos positivos o negativos. Leer `getComputedStyle` sobre una página real (lo que ya hace el helper existente) es la única forma fiable de verificar el color que un usuario ve de verdad.
- **Cumple el requisito de "hard merge gate"**: la constitución ya exige ejecutar el conjunto e2e como parte de las quality gates del pipeline de despliegue (no como paso obligatorio en cada iteración local); extender los specs de `e2e/tests/` existentes encaja exactamente en ese gate ya vigente, sin necesidad de un paso de CI nuevo y dedicado.

**Alternatives considered**:
- **Unit test en `frontend/` que parsea `global.css`** (propuesta original de este documento): rechazada por la razón técnica de arriba (oklch vs. hex) y porque duplicaría infraestructura de verificación de contraste que el proyecto ya tiene en `e2e/`, violando el Principio III.
- **Librería externa de contraste en el unit test** (`wcag-contrast`, etc.): rechazada por el mismo motivo — el problema no es la fórmula de contraste (que el proyecto ya implementa correctamente en `e2e/helpers/contrast.ts`), sino de dónde se leen los colores a comparar.
- **Sustituir axe-core existente por un test unitario propio**: rechazada — `@axe-core/playwright` ya está adoptado, probado y referenciado por una feature anterior; retirarlo introduciría una regresión de cobertura (axe cubre reglas WCAG 2a/2aa más allá del contraste: nombres accesibles, estructura de landmarks, etc., aunque esas no sean el foco de esta feature) sin ningún beneficio.

## 2. Alcance de pantallas a cubrir con el escaneo axe + helper de contraste

**Decision**: Ampliar el escaneo axe (`wcag2a`/`wcag2aa`, solo violaciones `serious`/`critical`, igual que en `sign-in.spec.ts`) y las aserciones de contraste de texto de `dark-mode-contrast.spec.ts` a todas las rutas/pantallas autenticadas y no autenticadas listadas en `plan.md` (landing, dashboard, búsqueda, biblioteca, detalle de release/master release, perfil, wishlist, cabecera/navegación), en **ambos** temas (`page.emulateMedia({ colorScheme: 'light' | 'dark' })`), no solo en oscuro como hace hoy `dark-mode-contrast.spec.ts`.

**Rationale**: FR-001/FR-002/FR-009 exigen cobertura de "cada pantalla existente" en "ambos temas"; hoy el escaneo axe solo cubre la landing page (modo claro, feature 032) y el helper de contraste manual solo cubre 4 elementos en modo oscuro (feature 043) — ninguno de los dos cubre el árbol completo de pantallas en ambos temas, que es precisamente el hueco que motivó esta funcionalidad.

**Alternatives considered**:
- **Dejar el alcance como está y solo añadir pares sueltos**: rechazado, no cumple FR-009 (cobertura de todas las pantallas existentes) ni resuelve el patrón de "parcheado pantalla a pantalla" que motivó la petición original.

## 3. Cobertura de contraste de componentes de UI no cubierta por axe (WCAG 1.4.11)

**Decision**: Para bordes/rellenos de componentes interactivos (botones, inputs, checkboxes, toggles, badges) e indicadores de foco visible, añadir aserciones explícitas reutilizando el patrón de `assertReadableContrast` de `dark-mode-contrast.spec.ts` (leer `getComputedStyle` de dos elementos/pseudo-estados reales vía Playwright y calcular el ratio con `getContrastRatio`), en vez de depender de que axe las detecte automáticamente.

**Rationale**: axe-core documenta que buena parte de WCAG 1.4.11 (contraste de componentes no textuales) requiere revisión manual o reglas más limitadas que el contraste de texto; apoyarse solo en axe dejaría sin cubrir exactamente la User Story 2 de esta feature. El helper ya existente resuelve el problema de "cómo leer el color real renderizado" (oklch → canvas → sRGB), por lo que extenderlo a más elementos es una ampliación incremental, no una herramienta nueva.

**Alternatives considered**:
- **Confiar íntegramente en axe para 1.4.11**: rechazado — cobertura insuficiente y no verificable de antemano sin ejecutar el escaneo, lo que dejaría la User Story 2 sin una forma fiable de saber si "ya pasa".

## 4. Tratamiento de pares ya "corregidos" en features anteriores

**Decision**: Ninguno de los tokens/usos documentados como corregidos en investigaciones anteriores (`--color-primary` en 032, bandas `--color-rating-*` en 017, `--color-accent-text` en 039, contraste de texto en modo oscuro en 043) se excluye de la verificación ampliada; se re-verifican con el escaneo/aserciones ampliadas igual que cualquier otra pantalla.

**Rationale**: Es lo que exige FR-006 y lo que valida SC-006 — la garantía deja de depender de un comentario histórico y pasa a depender de un test e2e que se ejecuta en cada cambio relevante.

**Alternatives considered**: N/A — no existe una alternativa razonable que siga cumpliendo "estrictamente WCAG 2.1 AA".
