# Feature Specification: Refactor de tema claro/oscuro para cumplimiento estricto WCAG 2.1 AA

**Feature Branch**: `058-theme-wcag-aa-refactor`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Refactorizar el tema claro y oscuro que tenemos desarrollado para que cumpla ESTRICTAMENTE con WCAG 2.1 AA como hemos añadido a la constitución."

## Clarifications

### Session 2026-09-05

- Q: ¿Cómo debe garantizarse de forma duradera el cumplimiento verificable exigido por FR-010/SC-006? → A: Comprobación automatizada integrada en la suite de tests/CI que calcula los ratios de contraste y falla el build si alguna combinación baja del umbral — un gate técnico duradero, no solo una auditoría puntual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lectura de texto con contraste suficiente en ambos temas (Priority: P1)

Como usuario con baja visión (o en condiciones de luz ambiental adversas), quiero que todo el texto de la aplicación tenga suficiente contraste frente a su fondo, tanto en modo claro como en modo oscuro, para poder leer cualquier pantalla sin esfuerzo ni necesidad de herramientas externas de accesibilidad.

**Why this priority**: Es el requisito núcleo de WCAG 2.1 AA (criterio 1.4.3) y el motivo directo de la petición: la app ya tiene parches puntuales de contraste hechos pantalla a pantalla (botón "Sign in with Google", bandas de rating, token de acento ámbar), lo que demuestra que el sistema de color no garantiza el cumplimiento de forma sistemática. Sin esto, el resto de la funcionalidad de la app es inaccesible para una parte real de los usuarios.

**Independent Test**: Puede probarse de forma independiente auditando el ratio de contraste texto/fondo de cada combinación de color usada en la aplicación (en ambos temas) y verificando que todas superan el umbral AA aplicable, sin depender de ninguna otra historia de esta funcionalidad.

**Acceptance Scenarios**:

1. **Given** el usuario tiene activado el tema claro, **When** navega por cualquier pantalla existente de la aplicación, **Then** todo el texto de tamaño normal tiene un ratio de contraste de al menos 4.5:1 frente a su fondo, y todo el texto grande tiene al menos 3:1.
2. **Given** el usuario tiene activado el tema oscuro, **When** navega por cualquier pantalla existente de la aplicación, **Then** todo el texto de tamaño normal tiene un ratio de contraste de al menos 4.5:1 frente a su fondo, y todo el texto grande tiene al menos 3:1.
3. **Given** una combinación de color existente que actualmente no alcanza el ratio mínimo, **When** se aplica el refactor, **Then** el token de color afectado se ajusta (o se sustituye su uso) hasta cumplir el ratio, sin perder la intención visual de marca de forma injustificada.

---

### User Story 2 - Componentes interactivos y elementos de UI identificables en ambos temas (Priority: P2)

Como usuario que navega con teclado o tiene baja visión, quiero que los límites de los componentes interactivos (botones, inputs, toggles, badges, indicadores de foco) tengan suficiente contraste frente a las superficies que los rodean, para poder identificarlos y operarlos sin depender de la orientación visual fina.

**Why this priority**: WCAG 2.1 AA (criterio 1.4.11, contraste de componentes no textuales) exige que los controles y sus estados sean perceptibles incluso cuando no son texto. Es el segundo pilar de "estrictamente WCAG 2.1 AA" tras el contraste textual, y afecta directamente a la usabilidad del selector de tema y de la navegación general.

**Independent Test**: Puede probarse de forma independiente verificando el ratio de contraste de los bordes/rellenos de cada componente interactivo (y de su indicador de foco visible) frente a la superficie adyacente, en ambos temas, sin depender de la historia 1.

**Acceptance Scenarios**:

1. **Given** el usuario tiene activado cualquiera de los dos temas, **When** un elemento interactivo (botón, input, toggle, badge) se muestra en su estado por defecto, **Then** el contraste entre su borde/relleno y la superficie adyacente es de al menos 3:1.
2. **Given** el usuario navega con teclado, **When** el foco se posiciona sobre un elemento interactivo en cualquiera de los dos temas, **Then** el indicador de foco es visible con un contraste de al menos 3:1 frente a la superficie adyacente.

---

### User Story 3 - Información de estado no dependiente únicamente del color (Priority: P3)

Como usuario con daltonismo, quiero que ningún estado o información relevante (rating, disponibilidad, error de validación, estado de sincronización) se comunique solo mediante el color, para poder distinguir esos estados igualmente en ambos temas.

**Why this priority**: Corresponde al criterio WCAG 1.4.1 (uso del color). Es menos urgente que el contraste base porque varias zonas de la app ya combinan color con texto o icono, pero forma parte del cumplimiento "estricto" solicitado y debe verificarse de forma sistemática, no solo donde ya se ha hecho.

**Independent Test**: Puede probarse de forma independiente revisando cada elemento de la interfaz que comunique estado y confirmando que ofrece una señal adicional al color (texto, icono, patrón o forma), en ambos temas, sin depender de las historias 1 y 2.

**Acceptance Scenarios**:

1. **Given** un elemento que representa un estado (p. ej. banda de valoración, badge de sincronización con Discogs, mensaje de error de formulario), **When** se visualiza en cualquiera de los dos temas, **Then** el estado es identificable aunque el usuario no pueda percibir el color (por texto, icono o patrón visible).

---

### Edge Cases

- ¿Qué ocurre con tokens de color que ya se documentaron como corregidos en features anteriores (p. ej. `--color-primary`, `--color-rating-*`, `--color-accent-text`)? Deben re-verificarse como parte de esta auditoría en lugar de darse por válidos, ya que el objetivo es una garantía sistemática, no puntual.
- ¿Qué ocurre con elementos puramente decorativos o de marca (logo, wordmark, iconos decorativos) que no transmiten texto ni estado funcional? Quedan exentos del ratio de contraste de texto (están exentos bajo WCAG 1.4.3) pero no deben usarse como sustituto de un control o de una señal de estado funcional.
- ¿Qué ocurre durante la transición al cambiar de tema (claro↔oscuro)? Ninguna pantalla debe quedar, ni siquiera momentáneamente tras el cambio, con una combinación de color por debajo del umbral AA aplicable.
- ¿Qué ocurre con estados no por defecto de los componentes (hover, disabled, error, seleccionado)? También deben cumplir los ratios de contraste aplicables a su tipo (texto o componente de UI) en ambos temas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE garantizar que todo texto de tamaño normal (menor de 18pt, o menor de 14pt en negrita) tenga un ratio de contraste de al menos 4.5:1 frente a su fondo, en cada pantalla existente y en ambos temas (claro y oscuro).
- **FR-002**: El sistema DEBE garantizar que todo texto grande (18pt o superior, o 14pt en negrita o superior) tenga un ratio de contraste de al menos 3:1 frente a su fondo, en cada pantalla existente y en ambos temas.
- **FR-003**: El sistema DEBE garantizar que los límites visuales (bordes, rellenos) de todo componente de interfaz interactivo (botones, inputs, checkboxes, toggles, badges, tarjetas seleccionables) tengan un ratio de contraste de al menos 3:1 frente a la superficie adyacente, en ambos temas.
- **FR-004**: El sistema DEBE garantizar que todo indicador de foco de teclado sea visible con un ratio de contraste de al menos 3:1 frente a la superficie adyacente, en ambos temas.
- **FR-005**: El sistema NO DEBE comunicar ningún estado o información funcional (valoración, disponibilidad, error, sincronización, selección) únicamente mediante el color; toda esa información DEBE ir acompañada de texto, icono o patrón visible en ambos temas.
- **FR-006**: El sistema DEBE re-auditar y, si es necesario, ajustar todos los tokens de color compartidos existentes (incluidos los ya documentados como "corregidos" en features anteriores) para confirmar que cumplen los ratios anteriores, en lugar de asumirlos como válidos.
- **FR-007**: El sistema DEBE aplicar los ajustes de color a través de los tokens de tema compartidos (variables de color reutilizadas por los componentes), de forma que una misma combinación de color no quede corregida en una pantalla y sin corregir en otra que reutilice el mismo token.
- **FR-008**: El cambio de tema (claro↔oscuro) NO DEBE introducir en ningún momento, para ningún componente o pantalla existente, una combinación de color por debajo de los ratios exigidos en FR-001 a FR-004.
- **FR-009**: El sistema DEBE cubrir en la auditoría y refactor todas las pantallas y componentes existentes de la aplicación (incluyendo, entre otros: autenticación/landing, cabecera y navegación, dashboard, biblioteca, resultados de búsqueda y sus filtros, detalle de release/master release, galería, y el propio selector de tema), no solo los ya señalados en el historial de features.
- **FR-010**: El sistema DEBE incorporar una comprobación automatizada, ejecutada como parte de la suite de tests/CI, que calcule los ratios de contraste de las combinaciones de color relevantes y haga fallar la ejecución si alguna combinación no alcanza el umbral AA aplicable, de forma que el cumplimiento se confirme de manera repetible y no dependa de una inspección visual subjetiva ni de una auditoría puntual.
- **FR-011**: La comprobación automatizada del FR-010 DEBE ejecutarse en cada cambio futuro que modifique los tokens de color compartidos o su uso, actuando como gate técnico duradero coherente con el carácter de "hard merge gate" que la constitución exige para el Principio X (WCAG 2.1 AA).

### Key Entities

- **Token de color de tema**: Variable de color compartida (p. ej. superficie, texto, primario, acento, bordes) que define un valor para el tema claro y, cuando aplica, uno equivalente para el tema oscuro; es la unidad mínima que se audita y ajusta.
- **Combinación de contraste**: Par de colores (primer plano/fondo, o borde/superficie adyacente) evaluado frente a un umbral WCAG 2.1 AA concreto (4.5:1, 3:1) según si representa texto normal, texto grande o un componente de interfaz.
- **Superficie/pantalla**: Vista o componente existente de la aplicación en el que se aplican uno o más tokens de color y que debe quedar libre de combinaciones de contraste no conformes en ambos temas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las combinaciones texto/fondo usadas en las pantallas existentes de la aplicación cumplen o superan el ratio WCAG 2.1 AA aplicable (4.5:1 texto normal, 3:1 texto grande) en tema claro.
- **SC-002**: El 100% de las combinaciones texto/fondo usadas en las pantallas existentes de la aplicación cumplen o superan el ratio WCAG 2.1 AA aplicable (4.5:1 texto normal, 3:1 texto grande) en tema oscuro.
- **SC-003**: El 100% de los límites de componentes interactivos y de los indicadores de foco cumplen o superan el ratio 3:1 frente a su superficie adyacente, en ambos temas.
- **SC-004**: Cero elementos de estado/información funcional dependen únicamente del color para transmitir su significado, verificado en todas las pantallas existentes en ambos temas.
- **SC-005**: Ningún cambio de tema (claro↔oscuro) hace que una pantalla existente pase a incumplir los umbrales de SC-001 a SC-003.
- **SC-006**: Una comprobación automatizada ejecutada en la suite de tests/CI verifica los ratios de contraste de cada combinación de color relevante y falla ante cualquier regresión futura, de modo que el cumplimiento se confirme de forma repetible sin re-auditar visualmente cada pantalla desde cero.

## Assumptions

- El alcance de esta funcionalidad son los aspectos de color y contraste del sistema de tema claro/oscuro (criterios WCAG 1.4.1, 1.4.3 y 1.4.11) sobre las pantallas y componentes ya existentes en la aplicación; otros criterios de WCAG 2.1 AA no relacionados con color (estructura semántica, orden de foco, texto alternativo, movimiento) ya están cubiertos por el principio de accesibilidad general de la constitución y no son el objeto de este refactor específico.
- Los elementos puramente decorativos o de marca (logo, wordmark) están exentos del ratio de contraste de texto conforme a la propia excepción de WCAG 1.4.3, y no se fuerza su rediseño salvo que se usen también como control funcional o portador de estado.
- Solo existen los dos temas ya soportados por la aplicación (claro y oscuro); no se introducen temas adicionales (p. ej. alto contraste) como parte de esta funcionalidad.
- El refactor se aplica sobre el sistema de tokens de color compartido ya existente (ajustando o sustituyendo valores de esos tokens y, cuando sea necesario, los usos puntuales que no pasen por un token compartido), no sobre una reconstrucción completa del sistema de diseño.
- Los ratios de contraste se calculan con el método de luminancia relativa estándar de WCAG 2.1, igual que en las verificaciones puntuales ya documentadas en el historial de features del proyecto.
