---

description: "Task list template for feature implementation"
---

# Tasks: Refactor de tema claro/oscuro para cumplimiento estricto WCAG 2.1 AA

**Input**: Design documents from `/specs/058-theme-wcag-aa-refactor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/contrast-pairing-registry.md](./contracts/contrast-pairing-registry.md), [quickstart.md](./quickstart.md)

**Tests**: Esta funcionalidad es, en esencia, la construcción del propio test automatizado (FR-010/FR-011), así que cada historia incluye tareas de test explícitas que deben fallar antes de las tareas de implementación (Principio I, Test-First).

**Organization**: Las tareas están agrupadas por historia de usuario (US1/US2/US3, según `spec.md`) para permitir implementación y verificación independientes de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (ficheros distintos, sin dependencias entre sí)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Cada tarea incluye rutas de fichero exactas

## Path Conventions

- **Frontend** (valores de color, componentes): `frontend/src/...`
- **e2e** (comprobación automatizada WCAG): `e2e/tests/...`, `e2e/helpers/...`
- Todas las rutas son relativas a la raíz del repositorio

---

## Phase 1: Setup

**Purpose**: Confirmar que no hace falta añadir ninguna dependencia nueva (research.md §1 descartó explícitamente construir infraestructura propia).

- [X] T001 Ejecutar `npm ls @axe-core/playwright @playwright/test` en `e2e/` y confirmar que ambas ya están instaladas (sin cambios en `e2e/package.json`); ejecutar `cd e2e && npm test` una vez para capturar la línea base actual (specs que ya pasan, para no confundir después una regresión propia con un fallo preexistente).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extraer y ampliar los helpers ya existentes en `e2e/helpers/` para que las historias de usuario puedan reutilizarlos sin duplicar lógica de cálculo de contraste.

**⚠️ CRITICAL**: Ninguna tarea de las historias de usuario puede empezar hasta completar esta fase.

- [X] T002 [P] Extraer `toRgb`, `getResolvedComputedStyle` y `assertReadableContrast` (hoy definidas de forma local en `e2e/tests/dark-mode-contrast.spec.ts`) a funciones exportadas en `e2e/helpers/contrast.ts`, junto a las ya existentes `relativeLuminance`/`getContrastRatio`; actualizar `dark-mode-contrast.spec.ts` para importarlas. Es un refactor puro — los dos tests existentes del fichero deben seguir pasando exactamente igual.
- [X] T003 [P] Crear `e2e/helpers/axe.ts` con una función exportada `runAxeScan(page, options?)` que envuelva el patrón ya usado en `e2e/tests/sign-in.spec.ts:63-73` (`new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()` + filtro de violaciones `serious`/`critical`) y devuelva la lista filtrada; actualizar `sign-in.spec.ts` para usarla en su test `has no automatically detectable WCAG 2.1 AA violations`. Refactor puro — ese test debe seguir pasando igual.
- [X] T004 Añadir a `e2e/helpers/contrast.ts` dos funciones nuevas exportadas: `assertUiComponentContrast(page, elementLocator, comparisonLocator, label)` (compara `borderColor`/`backgroundColor` computados de un elemento contra la superficie adyacente y exige ratio ≥ 3:1) y `assertFocusIndicatorContrast(page, elementLocator, label)` (enfoca el elemento con `Tab`/`.focus()`, lee el color de `outline`/`box-shadow` de foco resultante y exige ratio ≥ 3:1 contra la superficie adyacente), reutilizando `toRgb`/`getContrastRatio` de T002. Es capacidad nueva sin consumidores todavía — se ejercitará a partir de la Fase 4 (US2).
- [X] T005 Generalizar `e2e/tests/dark-mode-contrast.spec.ts` para que su test `primary text meets WCAG 2.1 AA contrast (>=4.5:1) on major screens` recorra ambos temas (`for (const theme of ['light', 'dark'] as const)`), no solo oscuro, usando `page.emulateMedia({ colorScheme: theme })`; conservar intacta la segunda prueba (`card surfaces are darkened...`, específica de modo oscuro). (depende de T002)

**Checkpoint**: Helpers listos y verificados sin regresión — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Lectura de texto con contraste suficiente en ambos temas (Priority: P1) 🎯 MVP

**Goal**: Que todo el texto de la aplicación cumpla los ratios WCAG 2.1 AA (4.5:1 normal, 3:1 grande) frente a su fondo, en ambos temas, en todas las pantallas existentes.

**Independent Test**: Ejecutar `cd e2e && npm test` tras esta fase y comprobar que todos los escaneos axe añadidos (light + dark) devuelven cero violaciones `serious`/`critical` — verificable sin depender de las historias 2 y 3.

### Tests for User Story 1 ⚠️

> Escribir estos escaneos PRIMERO y comprobar que fallan contra el estado actual de la app antes de tocar ningún color.

- [X] T006 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/sign-in.spec.ts` (ya cubre light desde la feature 032 — añadir dark) y a `e2e/tests/landing-page-responsive.spec.ts`.
- [X] T007 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/header-responsive-nav.spec.ts`.
- [X] T008 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/dashboard-feed-grid.spec.ts`.
- [X] T009 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/library-list-responsive.spec.ts`, `e2e/tests/library-filters.spec.ts`, `e2e/tests/search-results-responsive.spec.ts` y `e2e/tests/search-result-filters.spec.ts`.
- [X] T010 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/release-detail.spec.ts`, `e2e/tests/release-detail-responsive.spec.ts`, `e2e/tests/master-release-detail.spec.ts`, `e2e/tests/master-release-detail-responsive.spec.ts` y `e2e/tests/record-detail-responsive.spec.ts`.
- [X] T011 [P] [US1] Añadir escaneo `runAxeScan` (light + dark) a `e2e/tests/discogs-account-link.spec.ts`, `e2e/tests/discogs-callback-responsive.spec.ts`, `e2e/tests/discogs-catalog-relink.spec.ts`, `e2e/tests/library-discogs-sync.spec.ts`, `e2e/tests/profile-responsive.spec.ts` y `e2e/tests/wishlist-responsive.spec.ts`.

### Implementation for User Story 1

- [X] T012 [P] [US1] Corregir las violaciones de contraste de texto detectadas por T006 en `frontend/src/pages/LandingPage.tsx` y `frontend/src/components/{LandingHeader.tsx,LandingHero.tsx,LandingPillarSection.tsx,landingPillarIcons.tsx,GoogleSignInButton.tsx}`. (depende de T006)
- [X] T013 [P] [US1] Corregir las violaciones detectadas por T007 en `frontend/src/components/{AppHeader.tsx,HamburgerMenu.tsx,HeaderNavIcons.tsx,HeaderSearchBox.tsx}` y `frontend/src/components/headerNavLinks.ts`. (depende de T007)
- [X] T014 [P] [US1] Corregir las violaciones detectadas por T008 en `frontend/src/pages/DashboardPage.tsx` y `frontend/src/components/{FeedArticleBoard.tsx,FeedArticleCard.tsx,FeedArticleCardSkeleton.tsx,FeedCategoryFilterBar.tsx,FeedSourceFilterBar.tsx,FeedSourceStatusBanner.tsx}`. (depende de T008)
- [X] T015 [P] [US1] Corregir las violaciones detectadas por T009 en `frontend/src/pages/{LibraryListPage.tsx,SearchResultsPage.tsx}`, `frontend/src/components/{SearchResultCard.tsx,SearchResultCardSkeleton.tsx,SearchResultListRow.tsx,SearchResultListRowSkeleton.tsx,RecordCard.tsx,RecordCardSkeleton.tsx,RecordListRow.tsx,RecordListRowSkeleton.tsx,ResultCardActions.tsx,FiltersControl.tsx}` y `frontend/src/components/filters/{CollapsibleFilterPanel.tsx,FilterActions.tsx,SelectableListFilter.tsx}`. (depende de T009)
- [X] T016 [P] [US1] Corregir las violaciones detectadas por T010 en `frontend/src/pages/{ReleaseDetailPage.tsx,MasterReleaseDetailPage.tsx,RecordDetailPage.tsx}`, `frontend/src/components/{MasterReleaseDetailsSection.tsx,MasterReleaseOtherDetailsSection.tsx,MasterVersionsTable.tsx,MasterVersionsTableSkeleton.tsx,MyCopySection.tsx,ReleaseAdditionalInfoSection.tsx,ReleaseDetailsSection.tsx,ReleaseImageGallery.tsx,ReleaseTracklistSection.tsx,GalleryFullscreenViewer.tsx,RecordDetailSkeleton.tsx}` y `frontend/src/components/ui/InlineEditableField.tsx`. (depende de T010)
- [X] T017 [P] [US1] Corregir las violaciones detectadas por T011 en `frontend/src/pages/{ProfilePage.tsx,WishlistPage.tsx,DiscogsCallbackPage.tsx,LoginCallbackPage.tsx}` y `frontend/src/components/{DiscogsConnectionCard.tsx,DiscogsConnectionCardSkeleton.tsx,DiscogsRelinkNotice.tsx,LibraryLinkRequired.tsx,UnderConstruction.tsx}`. (depende de T011)
- [X] T018 [US1] Corregir cualquier violación restante en los átomos de UI compartidos que no pertenezcan a una sola pantalla: `frontend/src/components/ui/{Badge.tsx,Button.tsx,Card.tsx,Input.tsx,Checkbox.tsx,Avatar.tsx,BackLink.tsx,Modal.tsx,Skeleton.tsx,StarRating.tsx,ReleaseRatingBadge.tsx}`, ajustando tokens compartidos en `frontend/src/styles/global.css` solo cuando el arreglo deba aplicarse a todos los consumidores del token. (depende de T012-T017)
- [X] T019 [US1] Ejecutar `cd e2e && npm test` y confirmar cero violaciones axe `serious`/`critical` en todos los escaneos de T006-T011, en ambos temas. (depende de T018)

**Checkpoint**: User Story 1 completa y verificable de forma independiente.

---

## Phase 4: User Story 2 - Componentes interactivos y elementos de UI identificables en ambos temas (Priority: P2)

**Goal**: Que los bordes/rellenos de los componentes interactivos y los indicadores de foco cumplan un ratio ≥3:1 frente a la superficie adyacente, en ambos temas.

**Independent Test**: Ejecutar `cd e2e && npm test` tras esta fase y comprobar que todas las aserciones `assertUiComponentContrast`/`assertFocusIndicatorContrast` añadidas pasan en ambos temas — verificable sin depender de las historias 1 y 3.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Añadir aserciones `assertUiComponentContrast` y `assertFocusIndicatorContrast` (light + dark) para `Button`/`Input`/`Checkbox` en `e2e/tests/sign-in.spec.ts` (botón "Sign in with Google") y `e2e/tests/record-detail-inline-edit.spec.ts` (input/checkbox de edición inline).
- [X] T021 [P] [US2] Añadir aserciones `assertUiComponentContrast` (light + dark) para `ThemeToggle` y `ViewModeToggle` en `e2e/tests/theme-preference.spec.ts` y `e2e/tests/view-mode-toggle.spec.ts`.
- [X] T022 [P] [US2] Añadir aserciones `assertUiComponentContrast` (light + dark) para los límites de `Badge`/`ReleaseRatingBadge` en `e2e/tests/search-results-responsive.spec.ts` y `e2e/tests/release-detail-responsive.spec.ts`.
- [X] T023 [P] [US2] Añadir aserciones `assertUiComponentContrast` (light + dark) para los controles de filtro (chips, checkboxes, panel) en `e2e/tests/library-filters.spec.ts` y `e2e/tests/search-result-filters.spec.ts`.
- [X] T024 [P] [US2] Añadir aserciones `assertFocusIndicatorContrast` (light + dark) para las acciones principales de cabecera/navegación en `e2e/tests/header-responsive-nav.spec.ts`.

### Implementation for User Story 2

- [X] T025 [P] [US2] Corregir el contraste de borde/relleno detectado por T020 en `frontend/src/components/ui/{Button.tsx,Input.tsx,Checkbox.tsx}`. (depende de T020)
- [X] T026 [P] [US2] Corregir el contraste detectado por T021 en `frontend/src/components/ui/{ThemeToggle.tsx,ViewModeToggle.tsx}`. (depende de T021)
- [X] T027 [P] [US2] Corregir el contraste detectado por T022 en `frontend/src/components/ui/{Badge.tsx,ReleaseRatingBadge.tsx}`. (depende de T022)
- [X] T028 [P] [US2] Corregir el contraste detectado por T023 en `frontend/src/components/FiltersControl.tsx` y `frontend/src/components/filters/{CollapsibleFilterPanel.tsx,FilterActions.tsx,SelectableListFilter.tsx}`. (depende de T023)
- [X] T029 [P] [US2] Corregir el contraste del indicador de foco detectado por T024 en `frontend/src/components/{AppHeader.tsx,HamburgerMenu.tsx}` y `frontend/src/components/ui/BackLink.tsx`, añadiendo/ajustando un token de anillo de foco (`focus-visible:`) en `frontend/src/styles/global.css` si el contorno por defecto no alcanza 3:1 en alguno de los dos temas. (depende de T024)
- [X] T030 [US2] Ejecutar `cd e2e && npm test` y confirmar que todas las aserciones de T020-T024 pasan en ambos temas. (depende de T025-T029)

**Checkpoint**: User Stories 1 y 2 completas e independientemente verificables.

---

## Phase 5: User Story 3 - Información de estado no dependiente únicamente del color (Priority: P3)

**Goal**: Que ningún estado (rating, sincronización, error de validación, selección) se comunique solo mediante color.

**Independent Test**: Revisión manual con el emulador de daltonismo de Chrome DevTools (quickstart.md paso 3) sobre cada componente listado abajo, en ambos temas — verificable sin depender de las historias 1 y 2.

- [X] T031 [P] [US3] Verificar/ajustar `frontend/src/components/ui/ReleaseRatingBadge.tsx` y sus usos en `frontend/src/components/{SearchResultCard.tsx,SearchResultListRow.tsx,RecordCard.tsx,RecordListRow.tsx}` para que la severidad del rating sea identificable sin color (etiqueta numérica/icono). Verificado sin cambios: el badge ya renderiza `{displayValue}` (texto numérico o "—") como contenido visible en las 4 pantallas que lo usan; confirmado en gris/escala de grises via harness manual en el navegador.
- [X] T032 [P] [US3] Verificar/ajustar `frontend/src/components/{FeedSourceStatusBanner.tsx,DiscogsRelinkNotice.tsx,DiscogsConnectionCard.tsx}` para que el estado de sincronización/relink/disponibilidad del feed sea identificable sin color. Verificado sin cambios: los tres ya comunican su estado mediante texto real (mensaje completo, `Badge` con texto "Connected"/"Not connected", enlace "Go to your profile"), nunca solo con color.
- [X] T033 [P] [US3] Verificar/ajustar `frontend/src/components/ui/{Input.tsx,Checkbox.tsx,InlineEditableField.tsx}` para que el estado de validación/error sea identificable sin color (icono/texto, no solo un borde rojo). Verificado sin cambios: `Input`/`Checkbox` no tienen ningún variant/prop de error (no existe lógica de borde rojo que corregir); `InlineEditableField` ya tiene un estado de error con mensaje de texto (`role="alert"`, "Couldn't save — check your connection and try again."). Confirmado además que en el resto de la app (`GoogleSignInButton`, `MasterVersionsTable`, `ReleaseDetailPage`, `SearchResultsPage`, `LibraryListPage`) todo error de validación/carga ya se muestra como texto `role="alert"`, nunca como color aislado — no se inventó ninguna funcionalidad de error nueva.
- [X] T034 [P] [US3] Verificar/ajustar `frontend/src/components/ui/ViewModeToggle.tsx` y `frontend/src/components/filters/SelectableListFilter.tsx` para que el estado seleccionado/activo sea identificable sin color. Verificado sin cambios: `ViewModeToggle` ya distingue la opción activa mediante un relleno sólido (píldora `bg-primary` llena) frente a un fondo transparente (icono suelto) — una diferencia de forma/luminancia visible en escala de grises, no solo de matiz — además de `aria-checked`. Las opciones de `SelectableListFilter` usan `<Checkbox>` nativo, cuyo glifo de marca de verificación nativo del navegador ya es la señal no-color; no hay resaltado adicional que dependa solo de color. Confirmado con un harness manual en el navegador simulando `grayscale(1)` en ambos temas: badges, toggle y checkbox siguen siendo distinguibles.
- [X] T035 [US3] Ejecutar la revisión manual con emulador de daltonismo (quickstart.md paso 3) sobre T031-T034 en ambos temas y dejar constancia del resultado (aprobado, o ajuste adicional aplicado). (depende de T031-T034)

**Checkpoint**: Las tres historias de usuario funcionan de forma independiente — cumplimiento WCAG 2.1 AA de color/contraste completo y protegido por la suite e2e ampliada.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar que no hay regresiones y que el gate automatizado funciona de verdad.

- [X] T036 [P] Ejecutar `cd frontend && npm test` y corregir cualquier regresión en tests de componentes existentes (Vitest/RTL) causada por los cambios de color/clase de T012-T034.
- [X] T037 [P] Ejecutar `cd frontend && npm run lint && npm run build` y confirmar que no se han introducido errores de tipo o de lint.
- [X] T038 Ejecutar la verificación del gate de regresión de `quickstart.md` paso 4 (aclarar temporalmente `--color-primary` en `frontend/src/styles/global.css`, confirmar que el spec e2e correspondiente falla, y revertir) para probar que FR-011 funciona de verdad.
- [X] T039 Ejecutar una última vez `cd e2e && npm test` y `cd frontend && npm test` juntos y confirmar que SC-001 a SC-006 quedan satisfechos.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup — bloquea todas las historias de usuario.
- **User Stories (Phase 3-5)**: todas dependen de Foundational; dentro de cada fase, primero los tests (bloque "Tests"), luego la implementación que los hace pasar.
- **Polish (Phase 6)**: depende de que las historias que se quieran entregar estén completas.

### User Story Dependencies

- **US1 (P1)**: puede empezar tras Foundational — sin dependencia de otras historias.
- **US2 (P2)**: puede empezar tras Foundational — usa componentes que US1 puede haber tocado, pero es verificable de forma independiente (sus propias aserciones de borde/foco).
- **US3 (P3)**: puede empezar tras Foundational — independiente de US1/US2 (su verificación es manual, no depende de los escaneos axe).

### Parallel Opportunities

- T006-T011 (tests de US1) se pueden ejecutar en paralelo entre sí (ficheros distintos).
- T012-T017 (implementación de US1) se pueden ejecutar en paralelo entre sí una vez su test correspondiente existe.
- T020-T024 (tests de US2) en paralelo entre sí; T025-T029 (implementación) en paralelo entre sí.
- T031-T034 (US3) en paralelo entre sí.
- Las tres historias de usuario (Phase 3, 4, 5) pueden trabajarse en paralelo por desarrolladores distintos una vez completada la Fase 2, aunque US1 es el MVP y debe priorizarse si el equipo es de una sola persona.

---

## Parallel Example: User Story 1

```bash
# Lanzar todos los escaneos axe de US1 en paralelo (ficheros de test distintos):
Task: "Añadir runAxeScan (light+dark) a e2e/tests/sign-in.spec.ts y landing-page-responsive.spec.ts"
Task: "Añadir runAxeScan (light+dark) a e2e/tests/header-responsive-nav.spec.ts"
Task: "Añadir runAxeScan (light+dark) a e2e/tests/dashboard-feed-grid.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Fase 1: Setup.
2. Completar Fase 2: Foundational (crítico — bloquea todas las historias).
3. Completar Fase 3: User Story 1.
4. **PARAR y VALIDAR**: `cd e2e && npm test` sin violaciones de contraste de texto en ninguna pantalla/tema.
5. Esto ya constituye una mejora de accesibilidad desplegable por sí sola.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar independientemente → (MVP de esta funcionalidad).
3. US2 → validar independientemente.
4. US3 → validar independientemente.
5. Fase 6 (Polish) → confirmación final de que SC-001 a SC-006 se cumplen.

---

## Notes

- [P] = ficheros distintos, sin dependencias entre sí.
- El label de historia mapea cada tarea a su User Story de `spec.md` para trazabilidad.
- Los tests (escaneos axe / aserciones de contraste) deben fallar antes de aplicar la corrección correspondiente (Principio I).
- Evitar: bajar el umbral de contraste "para que pase el test", eliminar un escaneo en vez de corregir la violación, o silenciar una violación axe sin justificación documentada (ver `contracts/contrast-pairing-registry.md`).
