# Feature Specification: Metal Storm Dashboard Images & E2E Suite Stabilization

**Feature Branch**: `036-metalstorm-images-e2e-fixes`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Corregir dos problemas detectados en el estado actual de Vinylmania: (1) las tarjetas de noticias de Metal Storm en el Dashboard no muestran imagen, a diferencia del resto de fuentes; y (2) la suite e2e tiene 9 tests fallando que hay que corregir adaptándolos a la situación actual de la app, agrupados en 4 clústeres: (A) aserción de un heading 'Dashboard' que ya no existe (2 tests); (B) locator 'Stockholm' ambiguo en la página de detalle de disco (5 tests); (C) heading 'Your copy' que no aparece a tiempo tras navegar desde la biblioteca (1 test, requiere investigar si es timing real o ambigüedad de locator); (D) el botón 'Sign out' intercepta un clic sobre 'Search' en viewport estrecho (1 test, sospecha de regresión de layout real en la cabecera introducida por el trabajo reciente de touch targets de 44px)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la imagen de las noticias de Metal Storm en el Dashboard (Priority: P1)

Como collector que visita el Dashboard, quiero que las tarjetas de noticias
de Metal Storm muestren la imagen del artículo cuando el feed original la
proporciona, igual que ya ocurre con Metal Injection, MetalSucks y Louder
Sound, para que el Dashboard se vea consistente y no tenga huecos grises
únicamente en una fuente cuando esa fuente sí tiene imagen disponible.

**Why this priority**: Es un defecto visual visible en cada visita al
Dashboard que rompe la consistencia entre fuentes y es la pieza de mayor
valor de usuario directo de esta historia.

**Independent Test**: Puede probarse cargando el Dashboard con artículos
reales o simulados de Metal Storm cuyo feed original incluya información de
imagen, y verificando que la tarjeta muestra esa imagen en vez del
placeholder gris — de forma independiente a la corrección de la suite e2e.

**Acceptance Scenarios**:

1. **Given** el Dashboard muestra artículos de Metal Storm que sí incluyen
   información de imagen en su feed original, **When** se renderiza su
   tarjeta, **Then** se muestra esa imagen, no el placeholder gris.
2. **Given** un artículo de cualquier fuente (Metal Storm incluida) que
   genuinamente no trae información de imagen en su feed, **When** se
   renderiza su tarjeta, **Then** se sigue mostrando el placeholder gris
   existente — el fix no debe inventar imágenes ni romper el fallback ya
   existente.
3. **Given** las demás fuentes (Metal Injection, MetalSucks, Louder Sound),
   **When** se aplica el fix, **Then** su comportamiento actual de imágenes
   no cambia.

---

### User Story 2 - Corregir los 9 tests e2e rotos para reflejar el estado actual de la app (Priority: P2)

Como responsable del proyecto, quiero que la suite e2e (Playwright) pase al
100%, adaptando cada test a cómo se comporta la app hoy — o corrigiendo la
app cuando la investigación confirme un defecto real — para poder confiar en
la suite como gate de calidad en el pipeline de despliegue, en vez de
convivir con 9 fallos permanentes que ocultarían regresiones futuras reales.

**Why this priority**: Es un problema de confiabilidad de la suite de
calidad, no un defecto visible para el usuario final del producto — de ahí
la prioridad P2 frente a la corrección visual de Historia 1. Sin embargo, es
bloqueante para poder usar la suite como gate fiable de aquí en adelante.

**Independent Test**: Puede probarse ejecutando la suite completa de e2e dos
veces seguidas y verificando que los 9 tests listados abajo pasan de forma
estable, de forma independiente a la corrección de las imágenes de Metal
Storm.

**Acceptance Scenarios**:

*Clúster A — aserción de un heading "Dashboard" que ya no existe (2 tests:
`sign-in.spec.ts`, `returning-session.spec.ts`)*

1. **Given** un usuario completa el inicio de sesión o recarga la página
   estando ya autenticado, **When** el test verifica que llegó al Dashboard,
   **Then** la aserción comprueba contenido real y actual de la pantalla
   autenticada (no un heading "Dashboard" que ya no existe en la UI actual).

*Clúster B — locator "Stockholm" ambiguo (5 tests en
`record-detail-inline-edit.spec.ts`)*

2. **Given** la página de detalle de un disco cuyo título y notas contienen
   ambos la palabra "Stockholm", **When** el test localiza el título del
   release, **Then** lo hace mediante un locator que identifica
   inequívocamente un único elemento (p. ej. por rol de encabezado), sin
   violaciones de "modo estricto" de Playwright.

*Clúster C — heading "Your copy" no aparece a tiempo tras navegar desde la
biblioteca (1 test en `caching-navigation.spec.ts`)*

3. **Given** un usuario navega desde la lista de su biblioteca hasta el
   detalle de un disco, **When** el test espera a que aparezca la sección
   "Your copy", **Then** aparece dentro del tiempo de espera del test —ya
   sea porque el test corrige una ambigüedad de locator equivalente al
   Clúster B, o porque se corrige un problema real de tiempos de
   renderizado detectado en la app durante la investigación.

*Clúster D — el botón "Sign out" intercepta un clic sobre "Search" en
viewport estrecho (1 test en `caching-navigation.spec.ts`)*

4. **Given** un usuario autenticado en un viewport de 375px de ancho,
   **When** intenta pulsar el botón de búsqueda de la cabecera, **Then** el
   clic llega al botón de búsqueda sin que otro control (el botón "Sign
   out") lo intercepte visualmente.

*Estabilidad general*

5. **Given** la suite completa de e2e, **When** se ejecuta dos veces
   seguidas, **Then** los mismos 9 tests pasan en ambas ejecuciones, sin
   introducir inestabilidad (flakiness) nueva en tests que hoy ya pasan.
6. **Given** cualquier test corregido, **When** se revisa su aserción final,
   **Then** verifica comportamiento que existe hoy en la app — ningún test
   queda comprobando una pantalla, texto o elemento que ya no existe.

---

### Edge Cases

- ¿Qué ocurre con las categorías de Metal Storm cuyo feed genuinamente no
  incluye ninguna información de imagen en ningún artículo (a diferencia de
  la categoría de noticias, que sí puede incluirla)? Sus tarjetas deben
  seguir mostrando el placeholder gris existente — esto no es un defecto,
  es el comportamiento correcto cuando la fuente no aporta esa información.
- ¿Qué ocurre si la información de imagen que aporta el feed no resulta en
  una URL de imagen válida y cargable (por ejemplo, una ruta que no puede
  resolverse a una URL absoluta)? La tarjeta debe recurrir al placeholder
  existente en vez de mostrar un icono de imagen rota o dejar hueco en
  blanco.
- ¿Qué ocurre si, durante la investigación del Clúster C, resulta que la
  causa es un problema de rendimiento/tiempos real de la aplicación (no solo
  del test)? Debe corregirse en la aplicación y reportarse como tal, no
  enmascararse alargando el timeout del test.
- ¿Qué ocurre si, durante la investigación del Clúster D, resulta que el
  solape es exclusivo de esa combinación específica de controles y no afecta
  a otras pantallas con cabecera autenticada? La corrección debe validarse
  contra el resto de tests de cabecera ya existentes para confirmar que no
  introduce una regresión nueva en anchos de viewport ya cubiertos.
- ¿Qué ocurre con los tests de cabecera y de touch targets de 44px ya
  existentes (introducidos recientemente) si el Clúster D requiere ajustar
  el layout de la cabecera? Deben seguir pasando tras el ajuste — el fix no
  puede reintroducir controles por debajo del mínimo de 44×44px ni romper el
  comportamiento dual desktop/mobile ya validado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar la imagen del artículo en las tarjetas
  de noticias de Metal Storm en el Dashboard cuando el feed original de esa
  fuente incluya información de imagen para ese artículo.
- **FR-002**: El sistema MUST seguir mostrando el placeholder gris existente
  para cualquier artículo, de cualquier fuente (Metal Storm incluida), cuyo
  feed no incluya información de imagen — el fix no debe inventar ni inferir
  imágenes.
- **FR-003**: El fix de imágenes MUST NOT alterar el comportamiento actual de
  extracción y presentación de imágenes de Metal Injection, MetalSucks ni
  Louder Sound.
- **FR-004**: El fix de imágenes MUST NOT modificar el modelo de datos de
  artículo, el campo de extracto (excerpt), ni ningún otro campo más allá de
  la extracción de la imagen.
- **FR-005**: Los 9 tests e2e identificados como fallando (2 en Clúster A, 5
  en Clúster B, 1 en Clúster C, 1 en Clúster D) MUST pasar tras la
  corrección, sin quedar ninguno en estado de omisión (skip) o pendiente
  (todo).
- **FR-006**: Cada test corregido MUST verificar comportamiento que existe
  hoy en la aplicación; ningún test corregido MUST seguir comprobando una
  pantalla, texto o elemento que ya no existe (p. ej. el heading
  "Dashboard").
- **FR-007**: La ambigüedad de locator del Clúster B (y la del Clúster C, si
  resulta ser de la misma naturaleza) MUST resolverse mediante locators más
  específicos o ajustes a los datos de prueba (fixtures), sin cambiar
  comportamiento de la aplicación.
- **FR-008**: La causa raíz del Clúster C MUST investigarse durante la
  implementación; si resulta ser un problema real de tiempos de
  renderizado en la aplicación, MUST corregirse en la aplicación, no solo
  ampliando el timeout del test.
- **FR-009**: La causa raíz del Clúster D MUST investigarse durante la
  implementación; si se confirma como un defecto real de layout en la
  cabecera autenticada (solape entre el botón de búsqueda y el botón de
  cerrar sesión en viewports estrechos), MUST corregirse en la aplicación
  (cabecera autenticada), no únicamente en el test.
- **FR-010**: Tras las correcciones, la suite completa de e2e MUST producir
  resultados estables (sin tests nuevos intermitentes) en al menos dos
  ejecuciones consecutivas completas.
- **FR-011**: Esta corrección MUST NOT añadir cobertura e2e nueva más allá de
  la ya existente, salvo la estrictamente necesaria para verificar
  correctamente el comportamiento corregido de los Clústeres C y D si se
  confirman como defectos reales de la aplicación.
- **FR-012**: Esta corrección MUST NOT cambiar comportamiento de la
  aplicación únicamente para satisfacer una expectativa de test obsoleta —
  la única excepción es el Clúster D (y, condicionalmente, el Clúster C) si
  la investigación confirma que se trata de un defecto real, no solo de un
  test desactualizado.
- **FR-013**: Esta corrección MUST NOT añadir nuevas fuentes de noticias ni
  rediseñar el pipeline de feeds más allá de lo estrictamente necesario para
  la extracción de imagen de Metal Storm.

### Key Entities

*(No aplica — esta corrección no introduce ni modifica entidades de datos;
reutiliza el modelo de artículo de noticias ya existente.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los artículos de Metal Storm cuyo feed original
  incluye información de imagen muestran esa imagen en su tarjeta del
  Dashboard, con el mismo tratamiento visual que las demás fuentes.
- **SC-002**: El 100% de los artículos sin información de imagen en su feed
  (de cualquier fuente, Metal Storm incluida) siguen mostrando el
  placeholder existente, sin iconos de imagen rota ni huecos en blanco.
- **SC-003**: La suite completa de e2e existente pasa al 100% (0 fallos)
  en dos ejecuciones consecutivas completas.
- **SC-004**: El 0% de los tests de la suite e2e comprueba una pantalla,
  texto o elemento que ya no existe en la aplicación actual.
- **SC-005**: En anchos de viewport móvil habituales (≈375px), los usuarios
  pueden pulsar el control de búsqueda de la cabecera autenticada sin que
  otro control lo intercepte visualmente.

## Assumptions

- La causa raíz exacta de la ausencia de imagen en las tarjetas de Metal
  Storm (qué campo o patrón del feed original contiene la información de
  imagen, y si todas las categorías de Metal Storm la incluyen o solo
  algunas) se confirma durante la implementación inspeccionando el
  contenido real de los feeds — el diagnóstico de esta especificación
  refleja lo que se sabe hoy, no una decisión técnica cerrada de
  antemano.
- Es posible que, tras la investigación, se confirme que algunas categorías
  de Metal Storm (por ejemplo, reseñas, entrevistas, artículos o
  selecciones del staff) genuinamente no incluyen información de imagen en
  ningún artículo de su feed — en ese caso, seguir mostrando el placeholder
  para esas categorías es el comportamiento correcto y no un defecto
  pendiente.
- El resto de fuentes de noticias (Metal Injection, MetalSucks, Louder
  Sound) no se tocan — siguen funcionando igual que hoy.
- No se añaden fuentes de noticias nuevas ni se cambia el modelo de datos
  del artículo de noticias.
- La lista de 9 tests fallando y sus 4 clústeres de causa proviene de una
  ejecución real y reciente de la suite e2e completa; si al comenzar la
  implementación la suite muestra un conjunto distinto de fallos, se
  documenta la discrepancia y se ajusta el alcance en consecuencia.
- Los Clústeres A y B (y, si se confirma como ambigüedad de locator, el
  Clúster C) se resuelven ajustando los tests, ya que corresponden a
  aserciones que verifican una versión anterior de la pantalla o un locator
  no lo bastante específico, no a un defecto de la aplicación.
- El Clúster D se trata como una sospecha fundada de defecto real de layout
  en la cabecera autenticada (introducido por el trabajo reciente de touch
  targets de 44×44px) hasta que la investigación confirme o descarte esa
  hipótesis; si se confirma, se corrige en la aplicación.
