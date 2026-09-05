# Contrato: Cobertura WCAG por pantalla en la suite e2e

Esta funcionalidad no expone una API HTTP ni un contrato externo. El "contrato" relevante es interno: la convención que debe seguir cada spec de `e2e/tests/*.spec.ts` para que la cobertura WCAG siga siendo la fuente de verdad exigida por FR-011 ("DEBE ejecutarse en cada cambio futuro que modifique los tokens de color compartidos o su uso"). Cualquier PR futura que añada una pantalla nueva o modifique el sistema de color debe respetar este contrato.

## Patrón obligatorio por pantalla

Toda pantalla cubierta por FR-009 DEBE tener, en su spec e2e correspondiente (existente o nuevo):

1. **Un escaneo axe por tema**, reutilizando el patrón ya establecido en `e2e/tests/sign-in.spec.ts:63-73`:

   ```ts
   import AxeBuilder from '@axe-core/playwright';

   test('has no automatically detectable WCAG 2.1 AA violations', async ({ page }) => {
     await page.emulateMedia({ colorScheme: 'light' }); // y repetir con 'dark'
     await page.goto(ROUTE);
     // ... llegar al estado renderizado real de la pantalla (login si aplica) ...

     const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
     const seriousOrCritical = results.violations.filter(
       (v) => v.impact === 'serious' || v.impact === 'critical',
     );
     expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
   });
   ```

2. **Aserciones de contraste de componentes de UI/foco donde aplique** (botones, inputs, toggles, badges propios de esa pantalla), reutilizando `getContrastRatio`/`relativeLuminance` de `e2e/helpers/contrast.ts` y el patrón `assertReadableContrast`/`getResolvedComputedStyle` de `e2e/tests/dark-mode-contrast.spec.ts:44-71`, comparando siempre colores leídos con `getComputedStyle` sobre la página real — nunca un valor hardcodeado.

## Reglas del contrato

1. **Toda pantalla o componente de UI nuevo con color propio DEBE añadir su escaneo/aserción en la misma PR que lo introduce.** Un componente nuevo no se considera conforme con el Principio X de la constitución si no tiene cobertura en `e2e/`.
2. **El filtro de violaciones axe se mantiene en `serious`/`critical`**, igual que el precedente de `sign-in.spec.ts`, salvo excepción documentada por escrito (Development Workflow de la constitución).
3. **Las aserciones de contraste de componentes de UI NUNCA comparan un valor hardcodeado**: siempre leen el color real vía `getComputedStyle`/canvas (helper existente), para no reintroducir el riesgo de duplicación/drift que motivó research.md §1.
4. **Eliminar una `ScreenScan`/`ComponentContrastCheck` de un spec solo es válido si la pantalla o el componente desaparece del código** — no como forma de silenciar un fallo de contraste.
5. **La ejecución sigue el gate ya vigente**: la suite e2e completa (`e2e/`) se ejecuta como quality gate del pipeline de despliegue (regla ya existente de la constitución), sin necesidad de un paso de CI nuevo y dedicado para esta funcionalidad.

## Consumidores de este contrato

- Cada spec de `e2e/tests/*.spec.ts` que cubra una pantalla dentro del alcance de FR-009.
- Cualquier desarrollador (o agente `frontend-agent`/`qa-agent`) que añada o modifique una pantalla o componente de UI con color nuevo — este contrato define qué debe añadir a `e2e/` para mantener vigente el gate del Principio X.
