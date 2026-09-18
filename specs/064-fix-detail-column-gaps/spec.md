# Feature Specification: Corregir huecos entre tarjetas en el layout de dos columnas del detalle de release

**Feature Branch**: `064-fix-detail-column-gaps`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Con los cambios que hemos hecho en el layout de las vistas de detalle de una release en dos columnas, algo no ha salido bien. En la vista de detalle se ven huecos entre las tarjetas de las dos columnas. Probablemente no se estén colocando bien. Quiero que revises por qué se generan esos gaps entre tarjetas de diferentes columnas y lo corrijas. Crea una nueva rama de feature para no hacer cambios sobre master."

## Clarifications

### Session 2026-09-18

- Q: Para evitar el hueco entre la tarjeta de galería y la pareja info+valoración de la fila superior, ¿se deben estirar las tarjetas para igualar su altura, o pueden las dos columnas tener alturas totales distintas sin forzar coincidencia? → A: Cada columna puede tener tamaños diferentes; no se debe forzar que ambas columnas midan lo mismo (nada de estirar tarjetas para igualar alturas).
- Q: ¿La asignación de qué tarjetas van en cada columna debe seguir siendo fija (como hoy), o puede recalcularse dinámicamente (p. ej. según la altura del contenido) para repartir mejor el espacio? → A: Cada columna tiene siempre las mismas tarjetas (asignación fija, no dinámica); no es necesario que las tarjetas de una columna coincidan en la misma fila horizontal que las de la otra columna — cada columna se apila de forma independiente.
- Q: Conseguir columnas de altura verdaderamente independiente exige agrupar en el DOM las tarjetas de cada columna; en el layout de una sola columna (móvil), donde todo se apila en el orden del DOM, esto cambiaría el orden de lectura actual (Galería, Info, Mi copia, Tracklist, Detalles, Streaming) a un orden agrupado por columna (Galería, Tracklist, Detalles, Info, Mi copia, Streaming). ¿Se unifica el orden en ambos layouts, o se mantiene el orden actual de móvil sin cambios (a costa de una implementación más compleja)? → A: Se unifica el orden agrupado por columna tanto en móvil como en desktop; el orden de lectura en el layout de una sola columna SÍ cambia respecto al actual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el detalle de una release sin huecos visuales (Priority: P1)

Como usuario que consulta el detalle de una release en un dispositivo de ancho medio/grande (donde las tarjetas se muestran en dos columnas), quiero ver las tarjetas colocadas de forma compacta y uniforme, sin espacios en blanco irregulares entre tarjetas de columnas distintas, para que la página se perciba ordenada y profesional.

**Why this priority**: Es un defecto visual introducido por un cambio reciente (unificación del detalle de release) que degrada la percepción de calidad en una de las vistas más usadas de la aplicación. Es la única historia de esta corrección y bloquea que el layout de dos columnas se considere terminado.

**Independent Test**: Se puede verificar abriendo el detalle de varias releases con distinta cantidad de contenido (con y sin enlaces de streaming, con tracklist corto y largo, con y sin valoración personal) en un ancho de pantalla donde se activa el layout de dos columnas, y comprobando visualmente que no aparecen huecos mayores que el espaciado estándar entre tarjetas.

**Acceptance Scenarios**:

1. **Given** el detalle de una release se muestra en el layout de dos columnas, **When** las dos columnas tienen alturas totales distintas por tener cantidades de contenido diferentes, **Then** cada columna se apila de forma independiente y esa diferencia de altura total entre columnas NO se corrige artificialmente (ni estirando tarjetas ni forzando su alineación con la columna opuesta).
2. **Given** el detalle de una release se muestra en el layout de dos columnas, **When** se inspecciona el espaciado entre tarjetas apiladas dentro de una misma columna y entre el final de esa columna y el inicio de la siguiente sección de ancho completo, **Then** no aparece ningún hueco irregular mayor que el espaciado estándar definido para el resto de tarjetas.
3. **Given** el detalle de una release se muestra en el layout de dos columnas, **When** el usuario redimensiona la ventana dentro del rango de anchos en el que se mantiene el layout de dos columnas, **Then** las tarjetas se reajustan sin dejar huecos irregulares en ningún punto del redimensionado.
4. **Given** el detalle de una release se muestra en un ancho de pantalla estrecho (layout de una sola columna), **When** el usuario visualiza la página, **Then** el apilado vertical, el espaciado y la usabilidad de esa vista de una columna se mantienen sin regresiones, mostrando las tarjetas en el mismo orden agrupado por columna que define el layout de dos columnas (que puede diferir del orden de lectura anterior a esta corrección).

---

### Edge Cases

- ¿Qué ocurre cuando una release tiene muy poco contenido (por ejemplo, sin enlaces de streaming ni valoración) y la columna resultante termina siendo mucho más corta que la columna opuesta? Esa diferencia de altura total entre columnas NO se considera un defecto en sí misma; solo lo es un hueco irregular dentro de una misma columna o entre esa columna y la siguiente sección de ancho completo.
- ¿Qué ocurre cuando el contenido de una tarjeta cambia de altura después del renderizado inicial (por ejemplo, al cargar de forma asíncrona los enlaces de streaming o los datos de Discogs)? La colocación de las tarjetas debe recalcularse para no dejar huecos.
- ¿Qué ocurre en el punto de quiebre (breakpoint) exacto entre el layout de una columna y el de dos columnas? La transición no debe dejar temporalmente tarjetas mal alineadas u solapadas.
- ¿Qué ocurre si la lista de tarjetas a mostrar varía según el origen del detalle (resultado de búsqueda, biblioteca personal, wishlist)? El layout de dos columnas debe quedar libre de huecos en los tres orígenes, ya que comparten el mismo componente unificado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En el layout de dos columnas del detalle de release, el sistema DEBE apilar las tarjetas dentro de cada columna sin huecos verticales irregulares mayores que el espaciado estándar usado entre el resto de tarjetas.
- **FR-002**: El espaciado vertical entre tarjetas apiladas dentro de una misma columna DEBE ser visualmente consistente con el espaciado usado en el resto de la página.
- **FR-003**: El sistema DEBE mantener cada columna libre de huecos independientemente de la cantidad de contenido de sus tarjetas (tracklist largo/corto, presencia o ausencia de valoración, enlaces de streaming, etc.).
- **FR-004**: El sistema DEBE mantener el layout libre de huecos durante el redimensionado continuo de la ventana dentro del rango de anchos en que se activa el layout de dos columnas.
- **FR-005**: La corrección NO DEBE alterar el comportamiento de apilado vertical, el espaciado ni la usabilidad (accesibilidad, tamaño de controles táctiles) del layout de una sola columna usado en anchos de pantalla estrechos. El orden de las tarjetas en ese layout de una sola columna DEBE seguir el mismo agrupamiento fijo por columna definido en FR-007, de modo que el orden de lectura sea idéntico en el layout de una columna y en el de dos columnas (ver Clarifications, sesión 2026-09-18); esto puede diferir del orden de lectura anterior a esta corrección.
- **FR-006**: La corrección DEBE aplicarse de forma consistente en los tres orígenes de la vista de detalle unificada (resultados de búsqueda, biblioteca personal y wishlist) y también en la vista de detalle de "master release" (agrupación de ediciones de una release, accesible desde búsqueda), ya que las cuatro comparten el mismo layout de dos columnas y el mismo problema.
- **FR-007**: La asignación de qué tarjetas pertenecen a cada columna DEBE ser fija (la misma para toda release), no calculada dinámicamente en función de la altura del contenido; el orden de lectura y la agrupación actual de las tarjetas (por ejemplo, la tarjeta de valoración, la de streaming, etc.) DEBE conservarse dentro de su columna.
- **FR-008**: Cada columna DEBE apilarse de forma independiente respecto a la otra: las tarjetas de una columna NO necesitan alinearse en la misma posición vertical (fila) que las tarjetas de la columna opuesta.
- **FR-009**: El sistema NO DEBE forzar que ambas columnas alcancen la misma altura total (por ejemplo, estirando el contenido de las tarjetas); una diferencia de altura total entre columnas NO se considera un defecto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al inspeccionar el detalle de al menos 10 releases con distinta cantidad de contenido en anchos de pantalla que activan el layout de dos columnas, el 100% no presenta huecos irregulares dentro de una misma columna ni entre el final de una columna y el inicio de la siguiente sección de ancho completo, más allá del espaciado estándar. Una diferencia de altura total entre las dos columnas NO cuenta como hueco.
- **SC-002**: Durante un redimensionado continuo de la ventana a través de todo el rango de anchos del layout de dos columnas, no se observa en ningún punto un hueco irregular ni un solapamiento de tarjetas.
- **SC-003**: El layout de una sola columna (anchos estrechos) no sufre ninguna regresión de apilado, espaciado ni usabilidad tras aplicar la corrección, aunque el orden de las tarjetas cambie para igualar el agrupamiento por columna del layout de dos columnas.
- **SC-004**: La corrección es efectiva en los tres orígenes de la vista de detalle unificada (búsqueda, biblioteca, wishlist) y en la vista de detalle de master release, sin necesidad de ajustes específicos por origen.

## Assumptions

- El layout de dos columnas afectado es el introducido por la unificación de las vistas de detalle de release (feature 063); esta corrección no cambia el número de columnas ni la asignación de qué tarjetas pertenecen a cada columna, solo cómo se apilan y espacian.
- El layout de una sola columna en anchos estrechos mantiene su mecánica de apilado, espaciado y usabilidad intacta; solo cambia el orden de las tarjetas, para igualarlo al agrupamiento fijo por columna usado en el layout de dos columnas (ver Clarifications, sesión 2026-09-18).
- "Hueco" se refiere a un espacio en blanco irregular dentro de una misma columna (entre tarjetas apiladas, o entre el final de la columna y el inicio de la siguiente sección de ancho completo) mayor que el espaciado estándar; una columna con menor altura total que la otra NO es, por sí sola, un hueco.
- Las dos columnas se apilan de forma independiente entre sí: no es necesario que sus tarjetas se alineen en la misma fila horizontal, y no se debe forzar que ambas alcancen la misma altura total (por ejemplo, estirando tarjetas).
- No se requiere ningún cambio de diseño visual adicional (colores, tamaños de tarjeta, tipografía); el alcance es exclusivamente la corrección del apilado/espaciado dentro de cada columna.
- Para que el tracklist, los detalles adicionales y el bloque de streaming dejen de ser secciones de ancho completo compartidas (necesario para eliminar el hueco sin estirar tarjetas, per FR-007/FR-009), pasan a asignarse de forma fija a una columna por afinidad temática: columna izquierda = Galería + Tracklist + Detalles adicionales (contenido del disco); columna derecha = Información principal + Mi copia + Streaming (información personal/acciones). Decisión confirmada con el usuario durante la planificación.
