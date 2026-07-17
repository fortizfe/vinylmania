# Feature Specification: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

**Feature Branch**: `052-grid-list-view-toggle`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Añadir un segundo modo de visualización (lista) a Resultados de búsqueda y Mi biblioteca, además del modo carátula existente, con un control para alternar entre ambos, persistencia independiente por pantalla en localStorage, y ampliación del backend para que los resultados de búsqueda incluyan país y sello (ver `.hu/search-library-grid-list-view-toggle.md`)."

## Clarifications

### Session 2026-07-17

- Q: ¿Debe mostrarse la insignia de valoración de la comunidad (community rating) en modo lista? → A: Sí, visible en modo lista con el mismo tratamiento visual que en modo carátula (superpuesta a la carátula).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Control para alternar entre carátula y lista (Priority: P1)

Como collector usando Resultados de búsqueda o Mi biblioteca, quiero un
control claro en la esquina superior derecha de la pantalla que me permita
cambiar entre ver los discos como carátulas o como una lista, para elegir la
presentación que mejor se adapte a lo que estoy haciendo en cada momento
(explorar visualmente o comparar datos rápidamente).

**Why this priority**: es el prerequisito funcional de las otras dos
historias — sin un control para cambiar de modo y sin persistencia de la
preferencia, la vista de lista de las Historias 2 y 3 no sería alcanzable ni
útil para el usuario. Entrega valor por sí sola en cuanto ambas pantallas
tienen al menos una vista de lista básica que mostrar.

**Independent Test**: se puede validar abriendo cada pantalla, comprobando
que el control aparece en la esquina superior derecha, que alternar sus dos
opciones cambia la presentación sin recargar la página, y que la preferencia
elegida se respeta al volver a visitar esa misma pantalla — todo ello es
observable sin necesitar que el contenido de la fila de lista esté
completo (Historias 2 y 3).

**Acceptance Scenarios**:

1. **Given** la pantalla de Resultados de búsqueda con resultados cargados,
   **When** se muestra, **Then** aparece un control con dos opciones
   (carátula / lista) en la esquina superior derecha de la pantalla, junto
   al título de la página.
2. **Given** la pantalla de Mi biblioteca con registros cargados, **When**
   se muestra, **Then** aparece el mismo control de dos opciones en la
   esquina superior derecha, conviviendo con el botón "Refresh" ya
   existente en esa misma zona.
3. **Given** el control en cualquiera de las dos pantallas, **When** se
   muestra, **Then** indica visualmente cuál de las dos opciones está
   activa en cada momento.
4. **Given** el modo carátula activo, **When** el usuario pulsa la opción
   "Lista", **Then** la rejilla de carátulas se sustituye inmediatamente
   por la vista de lista, sin recargar la página ni perder los resultados
   ya cargados (incluidos los cargados por scroll infinito en búsqueda).
5. **Given** el modo lista activo, **When** el usuario pulsa la opción
   "Carátula", **Then** la vista vuelve inmediatamente a la rejilla de
   carátulas actual, sin cambios respecto al comportamiento de hoy.
6. **Given** que el usuario ha elegido un modo en una de las dos pantallas,
   **When** navega fuera y vuelve a esa misma pantalla (o recarga la
   página), **Then** se respeta el último modo elegido para esa pantalla
   específica.
7. **Given** que el usuario ha elegido un modo en Resultados de búsqueda,
   **When** visita Mi biblioteca por primera vez (o viceversa), **Then** el
   modo de una pantalla no afecta al de la otra — cada una mantiene su
   propia preferencia, o el modo carátula por defecto si nunca se eligió
   nada en esa pantalla.
8. **Given** un usuario que nunca ha usado el control, **When** abre
   cualquiera de las dos pantallas por primera vez, **Then** se muestra en
   modo carátula (comportamiento actual, sin cambios de aspecto por
   defecto).
9. **Given** el control, **When** un usuario navega con teclado o lector de
   pantalla, **Then** puede identificar ambas opciones, cuál está activa, y
   activar la otra sin usar el ratón.
10. **Given** el control en un viewport móvil, **When** se muestra,
    **Then** cada una de las dos opciones cumple el tamaño mínimo de
    44×44px táctil ya exigido en el resto de la aplicación (spec
    `035-dual-layout-touch-targets`).
11. **Given** cualquiera de los dos modos, **When** están activos los
    filtros (Format/Genre/Style) o hay un error/estado vacío visible,
    **Then** ese comportamiento no cambia por el modo de visualización
    activo — el control solo afecta a la presentación de los resultados,
    no a los datos, filtros ni mensajes de estado.

---

### User Story 2 - Vista en modo lista en Mi biblioteca (Priority: P1)

Como collector revisando mi biblioteca, quiero poder ver mis discos en una
lista compacta con la carátula a la izquierda y los datos relevantes
(título, artista, formato, país, año y sello) a la derecha, con el título y
el artista destacados, para poder escanear y comparar mi colección más
rápido que con la rejilla de carátulas cuando tengo muchos registros.

**Why this priority**: junto con la Historia 3, es el contenido real que la
Historia 1 hace accesible; sin ella el control de la Historia 1 no tendría
una segunda vista que mostrar en Mi biblioteca. Se marca P1 porque Mi
biblioteca ya tiene todos los datos necesarios (no depende de la ampliación
de backend de la Historia 3) y es, por tanto, la vía más rápida a valor
entregable.

**Independent Test**: se puede validar activando el modo lista en Mi
biblioteca con registros ya cargados (usando el control de la Historia 1) y
comprobando visualmente que cada fila muestra los seis campos esperados,
que un click navega al detalle, y que paginación/filtros/estados vacíos se
comportan igual que en modo carátula.

**Acceptance Scenarios**:

1. **Given** Mi biblioteca en modo lista con registros cargados, **When**
   se muestra, **Then** cada registro aparece como una fila horizontal con
   la carátula del disco a la izquierda y, a su derecha, título, artista,
   formato, país, año de publicación y sello.
2. **Given** una fila de la lista, **When** se muestra, **Then** el título
   y el artista se presentan visualmente destacados (mayor peso/tamaño)
   frente al resto de campos (formato, país, año, sello), que se muestran
   en un estilo secundario.
3. **Given** un registro cuyo release tiene más de un formato, más de una
   etiqueta/sello o más de un artista, **When** se muestra en modo lista,
   **Then** se presentan de forma legible (p. ej. separados por coma),
   igual que ya hace la ficha de detalle del disco con esos mismos campos.
4. **Given** un registro al que le falta alguno de los campos opcionales
   (p. ej. sin país, o sin sello), **When** se muestra en modo lista,
   **Then** simplemente se omite ese campo en la fila, sin dejar un hueco
   vacío ni un valor "undefined"/placeholder roto.
5. **Given** una fila en modo lista, **When** el usuario hace click o toca
   en cualquier parte de la fila, **Then** navega al detalle de ese disco
   en la biblioteca, igual que ya ocurre al pulsar la tarjeta en modo
   carátula.
6. **Given** un registro cuyo release no pudo cargarse desde el catálogo
   (estado "unavailable"), **When** se muestra en modo lista, **Then** se
   presenta el mismo aviso ya existente ("Couldn't load catalog details for
   this record right now.") con su enlace "Open record", adaptado a la
   disposición de fila en vez de tarjeta.
7. **Given** la biblioteca sin registros (vacía, o sin resultados tras
   aplicar filtros), **When** el modo activo es lista, **Then** se muestran
   los mismos mensajes de estado vacío ya existentes hoy, sin cambios.
8. **Given** la paginación existente de Mi biblioteca (botones
   Previous/Next), **When** el modo activo es lista, **Then** sigue
   funcionando igual, paginando las filas de la lista en vez de las
   tarjetas de la rejilla.
9. **Given** un viewport móvil, **When** se muestra la vista de lista,
   **Then** la fila se adapta sin producir scroll horizontal ni recortar
   contenido de forma ilegible (la carátula puede reducirse de tamaño si es
   necesario, priorizando que título y artista permanezcan legibles).

---

### User Story 3 - Vista en modo lista en Resultados de búsqueda (Priority: P1)

Como collector buscando discos en el catálogo de Discogs, quiero poder ver
los resultados de una búsqueda en una lista compacta con la misma
información que en biblioteca (carátula, título, artista, formato, país,
año y sello, con título y artista destacados), para poder comparar
ediciones/resultados más rápido que con la rejilla de carátulas, sin perder
la posibilidad de añadir un disco a mi biblioteca directamente desde la
lista.

**Why this priority**: entrega la misma capacidad de escaneo rápido que la
Historia 2 pero para Resultados de búsqueda. Se marca P1 porque, aunque
depende de una ampliación de backend (país y sello no capturados hoy en los
resultados de búsqueda), sin ella el conjunto de la funcionalidad quedaría
asimétrico entre las dos pantallas del alcance de esta feature.

**Independent Test**: se puede validar ampliando primero el mapeo de
resultados de búsqueda del backend para incluir país y sello, y después
activando el modo lista en Resultados de búsqueda con resultados ya
cargados, comprobando que las filas de resultados individuales muestran los
seis campos, que los resultados agrupados ("master") se muestran
simplificados, que "Add to library" sigue funcionando desde la fila, y que
scroll infinito/filtros/errores se comportan igual que en modo carátula.

**Acceptance Scenarios**:

1. **Given** Resultados de búsqueda en modo lista con resultados
   individuales (resultado de tipo "release"), **When** se muestran,
   **Then** cada fila presenta carátula a la izquierda y, a su derecha,
   título, artista, formato, país, año de publicación y sello — con título
   y artista destacados, igual que en Mi biblioteca.
2. **Given** el backend ampliado para incluir país y sello en los
   resultados de búsqueda, **When** un resultado individual no tiene alguno
   de esos datos disponibles en Discogs, **Then** simplemente se omite ese
   campo en la fila, sin placeholders rotos (mismo criterio que en
   biblioteca).
3. **Given** una fila de un resultado individual en modo lista, **When** el
   usuario hace click sobre ella, **Then** navega a la ficha de detalle del
   release, igual que hoy en modo carátula.
4. **Given** una fila de un resultado individual en modo lista, **When** se
   muestra, **Then** conserva la acción "Add to library" (incluyendo sus
   estados "añadiendo…" y "añadido") ya existente en la tarjeta de
   carátula, adaptada a la disposición de fila.
5. **Given** un resultado agrupado (múltiples ediciones del mismo disco),
   **When** se muestra en modo lista, **Then** aparece como una fila
   simplificada: la carátula conserva el mismo efecto visual de carátulas
   apiladas ya existente en modo carátula, y a su derecha se muestra título
   y artista con una indicación "Multiple editions" en lugar de
   formato/país/año/sello individuales — sin acción "Add to library"
   (mismo criterio que hoy en modo carátula, donde estos resultados no
   permiten añadir directamente).
6. **Given** el scroll infinito ya existente en Resultados de búsqueda,
   **When** el modo activo es lista, **Then** sigue cargando más resultados
   al llegar al final de la lista, igual que hoy con la rejilla, incluyendo
   el estado de "cargando más" y el de "no hay más resultados".
7. **Given** un error al cargar la página siguiente de resultados, **When**
   el modo activo es lista, **Then** se muestra el mismo mensaje de error y
   botón "Retry" ya existentes, sin cambios de comportamiento.
8. **Given** los filtros activos (Format/Genre/Style) o el estado "sin
   resultados", **When** el modo activo es lista, **Then** el
   comportamiento de filtrado y los mensajes de estado vacío son idénticos
   a los de hoy en modo carátula.
9. **Given** un viewport móvil, **When** se muestra la vista de lista de
   resultados de búsqueda, **Then** se adapta sin scroll horizontal, con el
   mismo criterio de priorizar la legibilidad de título y artista que en
   biblioteca.

---

### Edge Cases

- Un disco/resultado sin carátula disponible debe mostrar en la fila de
  lista el mismo placeholder ya usado hoy en modo carátula ("sin imagen"),
  a un tamaño reducido acorde a la fila, sin romper la alineación del resto
  de campos.
- Cambiar de modo mientras una operación está en curso (añadiendo un disco
  a la biblioteca, cargando la siguiente página de resultados, refrescando
  la biblioteca) no debe cancelar ni duplicar esa operación; el modo es
  puramente de presentación.
- Redimensionar la ventana entre un ancho móvil y uno de escritorio con el
  modo lista activo no debe perder la selección de modo ni producir un
  estado visual roto a mitad de transición.
- Un release con muchos formatos, sellos o artistas no debe desbordar la
  fila ni forzar un alto desproporcionado frente al resto de filas de la
  lista.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar, en Resultados de búsqueda y en Mi
  biblioteca, un control con dos opciones (carátula / lista) situado en la
  esquina superior derecha de la pantalla, que indique visualmente cuál de
  las dos opciones está activa.
- **FR-002**: El control DEBE permitir alternar entre modo carátula y modo
  lista de forma inmediata, sin recargar la página y sin perder los
  resultados o registros ya cargados en la pantalla (incluidos los
  cargados por scroll infinito en búsqueda).
- **FR-003**: El sistema DEBE recordar, de forma independiente por
  pantalla, el último modo de visualización elegido por el usuario en el
  dispositivo, y aplicarlo automáticamente la próxima vez que esa pantalla
  se visite o se recargue. Elegir un modo en una pantalla NO DEBE afectar
  a la preferencia guardada de la otra pantalla.
- **FR-004**: El sistema DEBE mostrar el modo carátula por defecto (sin
  cambios respecto al comportamiento actual) en cualquiera de las dos
  pantallas cuando no exista todavía una preferencia guardada para ella.
- **FR-005**: En modo lista, cada registro/resultado individual DEBE
  mostrarse como una fila horizontal con la carátula a la izquierda y, a su
  derecha, título, artista, formato, país, año de publicación y sello.
- **FR-006**: En modo lista, el título y el artista DEBEN presentarse
  visualmente destacados (mayor peso/tamaño) frente a formato, país, año y
  sello, que se muestran en estilo secundario — replicando la jerarquía
  visual ya usada hoy por las tarjetas en modo carátula.
- **FR-007**: Cuando un registro/resultado tenga más de un formato, sello o
  artista, el sistema DEBE mostrarlos todos de forma legible (p. ej.
  separados por coma) en modo lista, con el mismo criterio ya usado hoy en
  la ficha de detalle del disco.
- **FR-008**: Cuando a un registro/resultado le falte alguno de los campos
  opcionales de la fila (formato, país, año o sello), el sistema DEBE
  omitir ese campo sin dejar huecos vacíos ni valores rotos/placeholder.
- **FR-009**: En modo lista, hacer click o tocar en cualquier parte de una
  fila DEBE navegar al mismo destino al que navega hoy la tarjeta
  equivalente en modo carátula (detalle del registro en biblioteca, o
  detalle del release en resultados de búsqueda).
- **FR-010**: En Mi biblioteca en modo lista, un registro cuyo release no
  pudo cargarse desde el catálogo DEBE mostrar el mismo aviso y enlace
  "Open record" ya existentes hoy en modo carátula, adaptados a la
  disposición de fila.
- **FR-011**: En Resultados de búsqueda en modo lista, un resultado
  individual DEBE conservar la acción "Add to library" (con sus estados de
  "añadiendo" y "añadido") ya existente en modo carátula, adaptada a la
  disposición de fila.
- **FR-012**: En Resultados de búsqueda en modo lista, un resultado
  agrupado (múltiples ediciones de un mismo disco) DEBE mostrarse como una
  fila simplificada con el mismo efecto visual de carátulas apiladas ya
  usado en modo carátula, título, artista, e indicación "Multiple
  editions" en lugar de formato/país/año/sello — sin acción "Add to
  library", igual que hoy en modo carátula para este tipo de resultado.
- **FR-013**: El sistema backend DEBE ampliar el mapeo de resultados de
  búsqueda del catálogo Discogs para capturar y exponer país y sello,
  cuando Discogs los proporcione, de forma que Resultados de búsqueda
  pueda mostrar los mismos seis campos que Mi biblioteca en modo lista.
- **FR-014**: Toda funcionalidad existente en ambas pantallas — buscador,
  filtros (Format/Genre/Style), scroll infinito y su manejo de errores,
  paginación, botón "Refresh" de biblioteca, y estados de carga/error/vacío
  — DEBE seguir funcionando de forma idéntica independientemente del modo
  de visualización activo.
- **FR-015**: El control de cambio de modo DEBE ser operable con teclado y
  compatible con lector de pantalla: ambas opciones deben ser
  identificables, debe anunciarse cuál está activa, y debe poder activarse
  la otra sin usar el ratón.
- **FR-016**: En viewport móvil, cada una de las dos opciones del control
  de cambio de modo DEBE cumplir el tamaño mínimo táctil de 44×44px ya
  exigido en el resto de la aplicación.
- **FR-017**: En viewport móvil, la fila de modo lista DEBE adaptarse sin
  producir scroll horizontal ni recortar contenido de forma ilegible,
  priorizando que título y artista permanezcan legibles (la carátula puede
  reducirse de tamaño si es necesario). Si el título o el artista no caben
  en una línea, DEBEN truncarse con puntos suspensivos (ellipsis) en vez de
  cortarse abruptamente o desbordar la fila.
- **FR-018**: La insignia de valoración de la comunidad ("community
  rating") que hoy se superpone a la carátula en modo carátula DEBE
  mantenerse visible en modo lista, con el mismo tratamiento visual
  (superpuesta a la carátula), para ambos tipos de resultado individual
  (registro de biblioteca y resultado de búsqueda de tipo "release").

### Key Entities

- **Preferencia de modo de visualización**: valor (carátula o lista)
  asociado a una pantalla concreta (Resultados de búsqueda o Mi
  biblioteca), persistido en el dispositivo del usuario de forma
  independiente por pantalla; por defecto, carátula.
- **Resultado de búsqueda (individual)**: representación de un release
  concreto del catálogo Discogs devuelto por una búsqueda, que en esta
  feature amplía los datos que expone para incluir país y sello, además de
  los ya existentes (título, artista, carátula, año, formato,
  valoración de la comunidad).
- **Resultado de búsqueda (agrupado / "master")**: representación de un
  grupo de varias ediciones de un mismo disco, sin un valor único de
  formato/país/año/sello por tratarse de un agregado; se muestra con
  indicación "Multiple editions" en ambos modos.
- **Registro de biblioteca**: disco ya guardado por el usuario en su
  colección, con su release completo asociado (título, artista(s),
  formato(s), país, año, sello(s)) o, si el release no pudo cargarse desde
  el catálogo, un estado degradado con aviso y enlace al registro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los discos/resultados mostrados en modo lista, en
  ambas pantallas, presentan título y artista visualmente destacados sobre
  el resto de campos.
- **SC-002**: El 100% de los resultados individuales (no agrupados) en modo
  lista, en ambas pantallas, muestran formato, país, año y sello cuando ese
  dato existe en Discogs, sin huecos rotos cuando no existe.
- **SC-003**: El cambio entre modo carátula y modo lista ocurre sin recarga
  de página y sin pérdida de los resultados/registros ya cargados, en el
  100% de los casos.
- **SC-004**: Cada una de las dos pantallas recuerda su propio modo de
  forma independiente entre visitas, sin que elegir un modo en una afecte a
  la preferencia de la otra.
- **SC-005**: Ninguna funcionalidad existente (filtros, scroll infinito,
  paginación, añadir a biblioteca, refrescar biblioteca, estados de
  error/vacío) cambia de comportamiento por el modo de visualización
  activo.
- **SC-006**: El control de cambio de modo cumple el mínimo de 44×44px
  táctil por opción en viewports móviles, en ambas pantallas.

## Assumptions

- El modo por defecto, la primera vez que un usuario visita cada pantalla,
  es carátula (comportamiento actual) — "modo lista" es una opción
  adicional, no un reemplazo.
- La preferencia de modo se guarda en el dispositivo (almacenamiento local
  del navegador), con una clave independiente por pantalla, siguiendo el
  mismo patrón ya usado para la preferencia de tema claro/oscuro; no se
  persiste en el backend ni viaja entre dispositivos — si más adelante se
  quiere que sí viaje entre dispositivos (como el tema), sería una
  ampliación futura.
- Cuando un release tiene varios formatos, sellos o artistas, se muestran
  todos concatenados (p. ej. "Vinyl, LP, Album"), replicando el mismo
  criterio ya usado en la ficha de detalle del disco, no solo el primero —
  a diferencia de la tarjeta de carátula actual de resultados de búsqueda,
  que hoy solo muestra el primer formato.
- El diseño visual exacto de la fila de lista (proporciones entre carátula
  e información, tipografía concreta, espaciados) es una decisión de la
  fase de planificación; esta especificación solo exige la estructura de
  contenido (carátula a la izquierda, datos a la derecha, título/artista
  destacados) y el comportamiento funcional descrito arriba.
- El icono/diseño concreto del control de dos opciones (iconos de
  cuadrícula/lista, texto, o ambos) es una decisión de diseño de la fase de
  planificación; el proyecto no usa hoy ninguna librería de iconos — los
  iconos existentes en la app están hechos a mano en SVG, así que los
  nuevos deberán seguir ese mismo patrón salvo que se decida incorporar una
  librería.

## Out of Scope

- Cambios a los datos, filtros, paginación, scroll infinito o cualquier
  lógica de negocio existente en ambas pantallas, más allá de lo necesario
  para que funcionen igual en modo lista.
- Un tercer modo de visualización adicional a carátula/lista.
- Ordenar o agrupar los resultados de forma distinta según el modo activo
  (el orden de los discos es el mismo en ambos modos).
- Sincronizar la preferencia de modo entre dispositivos o en el backend
  (ver Assumptions).
- Cambios al diseño visual del modo carátula existente, más allá de
  convivir con el nuevo control.
- Añadir país y sello a ninguna otra pantalla o componente que no sean las
  dos vistas en modo lista de esta feature (p. ej. la tabla de versiones de
  master release ya muestra país y sello hoy, y no se ve afectada).
