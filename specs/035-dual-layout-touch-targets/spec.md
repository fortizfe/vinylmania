# Feature Specification: Dual Desktop/Mobile Layout & 44px Touch Targets

**Feature Branch**: `035-dual-layout-touch-targets`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Quiero reconstruir el layout de las pantallas actuales de Vinylmania para que cumplan las dos reglas que acabo de añadir a la constitución del proyecto (sección 'UI Design System & Styling (Tailwind CSS v4)', versión 2.2.0): (1) Layout dual desktop/mobile — cada pantalla debe tener un layout de escritorio pensado específicamente para aprovechar el espacio horizontal disponible y un layout de móvil pensado específicamente para pantallas táctiles pequeñas, ambos vía breakpoints responsive de Tailwind, no detección de dispositivo. (2) Touch target mínimo de 44×44px — todo control interactivo debe medir al menos 44×44px CSS en anchos de viewport móvil. Reconstrucción completa del layout y controles interactivos de cada pantalla (Landing, Resultados de búsqueda, Mi biblioteca, Wishlist, Detalle de disco/release/master release, Perfil, Callback de Discogs, y la cabecera de la app) excepto el Dashboard, que ya cumple ambas reglas. Sin cambiar lógica de negocio, datos, flujos ni comportamiento funcional existente; reutilizando los componentes atómicos ya existentes (Card, Button, Badge, etc.)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usar cualquier pantalla cómodamente en escritorio y en móvil (Priority: P1)

Como collector que usa Vinylmania tanto en un monitor de escritorio como en su
móvil, quiero que cada pantalla de la aplicación aproveche deliberadamente el
espacio horizontal disponible en escritorio (varias columnas o paneles en vez
de una única columna estirada) y que, en móvil, se presente en una sola
columna compacta sin scroll horizontal, con todos los botones, enlaces,
chips e inputs lo bastante grandes para tocarlos con el dedo sin errores.

**Why this priority**: Es el único objetivo de esta historia: sin composiciones
de escritorio deliberadas y sin controles táctiles del tamaño mínimo, la app
resulta incómoda de usar tanto en monitores grandes (espacio desperdiciado)
como en dispositivos táctiles (pulsaciones erróneas), independientemente de
qué pantalla se esté usando.

**Independent Test**: Puede probarse abriendo cada pantalla en alcance a un
ancho de viewport de escritorio (≥1280px) y verificando que la composición usa
columnas/paneles múltiples, y luego a un ancho de viewport móvil (360–430px)
verificando que no aparece scroll horizontal y que cada control interactivo
mide al menos 44×44px CSS — sin depender de que otras pantallas estén
migradas.

**Acceptance Scenarios**:

*Landing page (`LandingPage`)*

1. **Given** un visitante no autenticado abre la landing page en un viewport
   de escritorio (≥1280px), **When** la página carga, **Then** el hero y los
   tres bloques de pilares del producto se presentan en una composición que
   utiliza el ancho disponible (por ejemplo, pilares en columnas lado a lado)
   en lugar de una única columna centrada con espacio vacío a ambos lados.
2. **Given** el mismo visitante abre la landing page en un viewport móvil
   (360–430px), **When** la página carga, **Then** el contenido se presenta en
   una sola columna sin scroll horizontal y el botón de inicio de sesión y
   cualquier otro control interactivo miden al menos 44×44px.

*Resultados de búsqueda (`SearchResultsPage`)*

3. **Given** un usuario autenticado realiza una búsqueda en un viewport de
   escritorio (≥1280px), **When** ve los resultados, **Then** los filtros y el
   grid de resultados se distribuyen aprovechando el ancho disponible (por
   ejemplo, panel de filtros junto al grid, o grid con más columnas), y toda
   la funcionalidad existente (filtros, scroll infinito) sigue funcionando
   igual.
4. **Given** el mismo usuario ve los resultados en un viewport móvil
   (360–430px), **When** interactúa con los chips de filtro, inputs y
   tarjetas de resultado, **Then** cada control mide al menos 44×44px y no
   aparece scroll horizontal en el contenido principal.

*Mi biblioteca (`LibraryListPage`)*

5. **Given** un usuario con cuenta de Discogs vinculada abre su biblioteca en
   un viewport de escritorio (≥1280px), **When** la página carga, **Then** el
   grid de discos y los controles de paginación aprovechan el ancho
   disponible con una composición de varias columnas.
6. **Given** el mismo usuario abre su biblioteca en un viewport móvil
   (360–430px), **When** interactúa con la paginación y las tarjetas de
   disco, **Then** cada control mide al menos 44×44px, no hay scroll
   horizontal, y el estado de "cuenta no vinculada" (cuando aplica) se
   presenta igualmente sin controles por debajo del mínimo táctil.

*Mi wishlist (`WishlistPage`)*

7. **Given** un usuario abre la wishlist (todavía un placeholder "en
   construcción") en cualquier viewport, **When** la página carga, **Then**
   el contenedor y cualquier control presente (por ejemplo, enlaces de
   navegación) cumplen el layout dual y el mínimo de 44×44px en móvil, sin
   que se añada funcionalidad real de wishlist.

*Detalle de disco / release / master release (`RecordDetailPage`,
`ReleaseDetailPage`, `MasterReleaseDetailPage`)*

8. **Given** un usuario abre el detalle de un disco de su biblioteca, de un
   release del catálogo, o de un master release, en un viewport de escritorio
   (≥1280px), **When** la página carga, **Then** la galería de imágenes, los
   datos del release, el tracklist y la información adicional se distribuyen
   en una composición de varios paneles que aprovecha el espacio horizontal
   disponible en monitores grandes, en vez de quedar limitados por un ancho
   máximo de contenedor reducido.
9. **Given** el mismo usuario abre cualquiera de esos detalles en un viewport
   móvil (360–430px), **When** interactúa con las acciones disponibles
   (puntuar, editar condición, añadir a biblioteca, etc.), **Then** cada
   control mide al menos 44×44px, el contenido se apila en una sola columna,
   y no aparece scroll horizontal.
10. **Given** cualquiera de estas tres pantallas de detalle, **When** se
    compara el contenido y las acciones disponibles antes y después de la
    reconstrucción del layout, **Then** no falta ni cambia ningún dato,
    acción o comportamiento funcional existente.

*Perfil (`ProfilePage`)*

11. **Given** un usuario autenticado abre su perfil en un viewport de
    escritorio (≥1280px), **When** la página carga, **Then** las preferencias
    de tema oscuro y la tarjeta de conexión con Discogs se presentan en una
    composición que aprovecha el ancho disponible (por ejemplo, paneles lado
    a lado) en vez de una única columna estirada.
12. **Given** el mismo usuario abre su perfil en un viewport móvil
    (360–430px), **When** interactúa con el toggle de tema y el botón de
    conexión/desconexión de Discogs, **Then** cada control mide al menos
    44×44px y no aparece scroll horizontal.

*Callback de conexión con Discogs (`DiscogsCallbackPage`)*

13. **Given** un usuario vuelve de autorizar la app en Discogs, **When** la
    pantalla transitoria de callback se muestra en cualquier viewport,
    **Then** su contenedor no produce scroll horizontal en móvil y cualquier
    control interactivo presente mide al menos 44×44px, sin necesidad de una
    composición de dos columnas dado que no tiene contenido sustancial que
    distribuir.

*Cabecera de la aplicación autenticada (`AppHeader`)*

14. **Given** un usuario autenticado navega la app en un viewport móvil
    (360–430px), **When** interactúa con el icono de búsqueda, el menú
    hamburguesa, los iconos de navegación y el botón de cerrar sesión en la
    cabecera, **Then** cada uno de esos controles mide al menos 44×44px,
    manteniendo el comportamiento dual ya existente (iconos en escritorio,
    menú hamburguesa en móvil).
15. **Given** el mismo usuario navega la app en un viewport de escritorio
    (≥1280px), **When** observa la cabecera, **Then** el comportamiento y la
    disposición actuales de la cabecera en escritorio se mantienen sin
    regresiones.

---

### Edge Cases

- ¿Qué ocurre en anchos de viewport intermedios (por ejemplo, tablets entre
  ~768px y ~1024px)? El layout debe transicionar de forma coherente entre la
  composición móvil y la de escritorio usando los breakpoints estándar de
  Tailwind, sin estados intermedios rotos (columnas superpuestas, controles
  cortados) ni scroll horizontal.
- ¿Qué ocurre con pantallas de detalle (disco/release/master) cuando falta
  alguna sección de contenido (por ejemplo, sin imágenes de galería, o sin
  información adicional)? La composición de escritorio debe seguir
  distribuyendo el espacio de forma razonable sin dejar huecos vacíos
  grandes ni romper el grid.
- ¿Qué ocurre en `LibraryListPage` cuando la cuenta de Discogs no está
  vinculada? El estado de "cuenta no vinculada" y su control de vinculación
  deben cumplir igualmente el layout dual y el mínimo de 44×44px.
- ¿Qué ocurre con controles que ya cumplen visualmente los 44×44px pero cuyo
  área clicable real (hit area) es menor por padding/márgenes internos? La
  reconstrucción debe garantizar que el área interactiva real, no solo el
  tamaño visual del icono o texto, cumple el mínimo.
- ¿Qué ocurre al rotar un dispositivo móvil de vertical a horizontal, o al
  redimensionar la ventana del navegador en vivo? El cambio de layout debe
  ocurrir de forma fluida solo por el ancho del viewport, sin recargar la
  página ni requerir interacción adicional del usuario.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada pantalla en alcance (Landing, Resultados de búsqueda, Mi
  biblioteca, Wishlist, Detalle de disco, Detalle de release, Detalle de
  master release, Perfil, Callback de Discogs) MUST presentar, en anchos de
  viewport de escritorio habituales (≥1280px), una composición que distribuya
  su contenido en varias columnas o paneles diseñados específicamente para
  aprovechar el espacio horizontal disponible, en vez de una única columna
  centrada de ancho máximo fijo.
- **FR-002**: Cada pantalla en alcance MUST presentar, en anchos de viewport
  móvil (por debajo de 768px), una composición de una sola columna con
  espaciado compacto, diseñada específicamente para pantallas táctiles
  pequeñas.
- **FR-003**: La transición entre la composición de escritorio y la de móvil
  de cada pantalla en alcance MUST ocurrir exclusivamente mediante
  breakpoints responsive de Tailwind CSS en función del ancho del viewport;
  el sistema MUST NOT usar detección de dispositivo (user-agent u otro
  mecanismo equivalente) para decidir qué composición mostrar.
- **FR-004**: Ningún control interactivo (botones, enlaces que actúan como
  botón, chips de filtro, inputs, iconos clicables, toggles) de las pantallas
  en alcance MUST medir menos de 44×44px CSS de área interactiva real en
  anchos de viewport móvil (por debajo de 768px).
- **FR-005**: Ninguna pantalla en alcance MUST producir scroll horizontal en
  su contenido principal en anchos de viewport móvil habituales
  (aproximadamente 360–430px).
- **FR-006**: La reconstrucción de layout y controles MUST reutilizar los
  componentes atómicos ya existentes en el sistema de diseño (`Card`,
  `Button`, `Badge`, etc.) en vez de introducir estilos ad-hoc nuevos fuera de
  esos componentes, consistente con la sección de diseño UI de la
  constitución del proyecto.
- **FR-007**: La reconstrucción MUST preservar íntegramente, en cada pantalla
  en alcance, todos los datos mostrados, acciones disponibles, flujos de
  navegación y comportamiento funcional existentes antes del cambio (por
  ejemplo: puntuar un disco, editar condición, añadir a biblioteca, filtrar
  resultados, paginar, vincular/desvincular Discogs, cambiar tema).
- **FR-008**: El `DashboardPage` (feed de noticias RSS) MUST quedar fuera del
  alcance de esta reconstrucción, dado que ya cumple ambas reglas de layout
  dual y touch targets por trabajo previo.
- **FR-009**: La funcionalidad real de wishlist (más allá del placeholder "en
  construcción" actual) MUST permanecer fuera de alcance; solo el propio
  placeholder y sus controles existentes deben cumplir las reglas de layout
  dual y touch targets.
- **FR-010**: La cabecera de la aplicación autenticada (`AppHeader` y sus
  componentes de búsqueda, navegación/menú hamburguesa y cierre de sesión)
  MUST garantizar explícitamente que cada uno de sus controles interactivos
  cumple el mínimo de 44×44px en anchos de viewport móvil, preservando el
  comportamiento dual por breakpoint ya existente (iconos en escritorio, menú
  hamburguesa en móvil).
- **FR-011**: Esta reconstrucción MUST NOT introducir cambios de lógica de
  negocio, datos, contratos de API/backend, ni nuevas pantallas, rutas o
  funcionalidades; el alcance se limita exclusivamente a la presentación
  (layout) y a la accesibilidad táctil de los controles ya existentes.

### Key Entities

*(No aplica — esta funcionalidad es exclusivamente de presentación/layout y
no introduce ni modifica entidades de datos.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los controles interactivos evaluados en las
  pantallas en alcance miden al menos 44×44px CSS de área interactiva real en
  anchos de viewport móvil (360–430px).
- **SC-002**: El 100% de las pantallas en alcance no produce scroll
  horizontal en su contenido principal en anchos de viewport móvil
  habituales (aproximadamente 360–430px).
- **SC-003**: El 100% de las pantallas en alcance presenta, en anchos de
  viewport de escritorio habituales (≥1280px), una composición verificable
  de varias columnas o paneles que usa el espacio horizontal de forma
  deliberada, en vez de una única columna estirada.
- **SC-004**: El cambio entre la composición de escritorio y la de móvil de
  cada pantalla en alcance ocurre únicamente por el ancho del viewport,
  sin recarga de página, verificable redimensionando la ventana del
  navegador en vivo a través de los breakpoints relevantes.
- **SC-005**: Tras la reconstrucción, el 100% de los datos, acciones y flujos
  funcionales que existían antes del cambio en cada pantalla en alcance
  siguen presentes y operativos (cero regresiones funcionales detectadas en
  verificación manual o automatizada).

## Assumptions

- Los breakpoints de referencia son los estándar de Tailwind ya usados en el
  proyecto (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px). "Viewport
  móvil" para la regla de 44×44px equivale a por debajo de `md` (768px),
  consistente con el breakpoint ya usado en la cabecera de la app
  (funcionalidad previa de iconos de cabecera responsive). "Viewport de
  escritorio" para la regla de composición multi-columna equivale a `xl`
  (1280px) en adelante, con anchos intermedios (`md`–`lg`) transicionando de
  forma coherente entre ambas composiciones.
- El copy, los iconos y el detalle visual exacto de cada nueva composición de
  escritorio son decisiones de diseño a tomar en la fase de planificación, no
  restricciones de esta especificación.
- Esta reconstrucción no introduce pantallas, rutas ni funcionalidades
  nuevas: solo cambia cómo se presenta el contenido y los controles ya
  existentes.
- El alcance cubre nueve pantallas (Landing, Resultados de búsqueda, Mi
  biblioteca, Wishlist, Detalle de disco, Detalle de release, Detalle de
  master release, Perfil, Callback de Discogs) más la cabecera de la
  aplicación autenticada; el Dashboard/feed RSS queda explícitamente fuera
  por ya estar conforme con ambas reglas.
- "Componentes interactivos" incluye, sin limitarse a: botones, enlaces que
  actúan como botón, chips de filtro, campos de entrada (inputs), iconos
  clicables, toggles y controles de paginación.
