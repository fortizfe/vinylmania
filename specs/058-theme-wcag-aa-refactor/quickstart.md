# Quickstart: Validar el cumplimiento WCAG 2.1 AA del tema claro/oscuro

## Prerrequisitos

- Dependencias instaladas en `frontend/` (`npm install`) y en `e2e/` (`npm install`).
- Emuladores de Firebase disponibles para la suite e2e (ya requerido por el resto de specs de `e2e/`, sin cambios de esta funcionalidad).
- Haber ampliado los specs e2e descritos en `data-model.md` / `contracts/contrast-pairing-registry.md` (tareas de `/speckit-tasks`).

## 1. Ejecutar la suite e2e completa (incluye los escaneos WCAG ampliados)

```bash
cd e2e
npm test
```

**Resultado esperado tras el refactor**: todos los specs pasan, incluidos los escaneos axe (`wcag2a`/`wcag2aa`, 0 violaciones `serious`/`critical`) y las aserciones de contraste de `e2e/helpers/contrast.ts` ampliadas, en ambos temas. Antes del refactor, los specs ampliados deben fallar mostrando explícitamente qué pantalla/tema/elemento no cumple — es la prueba en rojo del ciclo TDD (Principio I).

Para ejecutar solo los specs relevantes de esta funcionalidad durante el desarrollo (más rápido que la suite completa):

```bash
cd e2e
npx playwright test dark-mode-contrast sign-in <otros-specs-ampliados>
```

## 2. Ejecutar la suite de frontend (regresión de componentes)

```bash
cd frontend
npm test
```

**Resultado esperado**: sin regresiones en tests de componentes existentes que hagan aserciones sobre clases de color (p. ej. badges de rating, estados de error de formulario).

## 3. Verificación visual manual (ambos temas, incluye US3 — no automatizable)

```bash
cd frontend
npm run dev
```

1. Abrir la app en el navegador.
2. Usar el `ThemeToggle` (`src/components/ui/ThemeToggle.tsx`) para alternar entre tema claro y oscuro.
3. Recorrer al menos: `LandingPage`, `DashboardPage`, `SearchResultsPage` (con filtros abiertos), `LibraryListPage`, `ReleaseDetailPage`/`MasterReleaseDetailPage`, `ProfilePage`, `WishlistPage`, y la cabecera/menú de navegación.
4. Confirmar visualmente (con el emulador de daltonismo de Chrome DevTools, p. ej. "Protanopia"/"Deuteranopia" en el panel Rendering):
   - Ningún texto se percibe "lavado" o de bajo contraste en ninguno de los dos temas.
   - Las bandas de rating (`ReleaseRatingBadge`) siguen siendo distinguibles entre sí incluso en escala de grises.
   - Los estados de sincronización/relink de Discogs y los mensajes de error de formulario son identificables sin depender del color.
   - El indicador de foco (navegando con `Tab`) es visible sobre botones, inputs y toggles en ambos temas.

## 4. Verificar que el gate se dispara ante una regresión

Como comprobación de que FR-011 se cumple de verdad:

1. Cambiar temporalmente un valor de `--color-*` en `frontend/src/styles/global.css` a algo que rompa el contraste (p. ej. aclarar `--color-primary`).
2. Ejecutar de nuevo el spec e2e correspondiente (p. ej. `npx playwright test sign-in` desde `e2e/`).
3. Confirmar que el escaneo axe o la aserción de contraste falla señalando la violación/elemento afectado.
4. Revertir el cambio (`git checkout -- frontend/src/styles/global.css` o deshacer manualmente).

## Referencias

- Criterios evaluados: WCAG 2.1 — [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html), [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html), [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).
- Infraestructura reutilizada: [e2e/tests/sign-in.spec.ts](../../e2e/tests/sign-in.spec.ts) (patrón axe), [e2e/tests/dark-mode-contrast.spec.ts](../../e2e/tests/dark-mode-contrast.spec.ts) y [e2e/helpers/contrast.ts](../../e2e/helpers/contrast.ts) (patrón de contraste manual).
- Contrato de cobertura por pantalla: [contracts/contrast-pairing-registry.md](./contracts/contrast-pairing-registry.md)
- Modelo conceptual: [data-model.md](./data-model.md)
- Decisiones técnicas: [research.md](./research.md)
