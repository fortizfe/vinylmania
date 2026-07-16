# Feature Specification: Frontend habla solo con el backend propio

**Feature Branch**: `051-frontend-backend-only-network`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Que el frontend solo hable con el backend propio, y ratificarlo en la constitution. Todo código de `frontend/src` que hace peticiones de red debe dejar de poder llamar directamente a cualquier servicio que no sea el backend propio de Vinylmania (Discogs, Firebase, o cualquier otra librería/SDK que hable por su cuenta con un tercero), codificando este requisito en `.specify/memory/constitution.md` como un nuevo Core Principle. Incluye auditar qué hace hoy el frontend y refactorizar lo que no cumpla, en particular rediseñar el login para que sea 100% vía backend en lugar de usar el SDK cliente de Firebase Auth."

## Clarifications

### Session 2026-07-16

- Q: Cuando la sesión propia del backend expira mientras el usuario está usando la app activamente (una llamada autenticada falla), ¿qué debe ocurrir? → A: Renovación silenciosa en segundo plano, sin interrupción visible, replicando el comportamiento actual de auto-refresh del SDK de Firebase.
- Q: Cuando este rediseño se despliega, los usuarios con una sesión antigua basada en un ID token de Firebase dejan de poder autenticarse contra el backend. ¿Cómo debe gestionarse esa transición? → A: Sin manejo especial — el ID token antiguo se rechaza sin más en cuanto se despliega el nuevo backend; la siguiente petición autenticada del usuario falla y se trata como una sesión expirada ordinaria (re-login único), sin lógica de verificación dual.
- Q: ¿Puede un mismo usuario tener sesiones activas simultáneas e independientes en varios dispositivos/navegadores? → A: Sí — sesiones múltiples e independientes por usuario, igual que el comportamiento actual del SDK de Firebase Auth (iniciar/cerrar sesión en un dispositivo no afecta a los demás).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El principio "solo backend" queda definido y ratificado en la constitution (Priority: P1)

Como Product Owner de Vinylmania, quiero que exista una definición explícita
y obligatoria de qué puede y no puede hacer `frontend/` en materia de
peticiones de red, ratificada como nuevo Core Principle en
`.specify/memory/constitution.md`, para que sea la referencia única que
gobierna tanto el rediseño del login (User Story 2) como cualquier desarrollo
frontend futuro.

**Why this priority**: sin esta definición, la User Story 2 no tiene un
criterio de "cumplido" objetivo, y cualquier feature futura puede reintroducir
una llamada directa a un tercero sin que nada lo marque como una desviación.
Es el prerequisito conceptual de todo lo demás.

**Independent Test**: se puede validar leyendo
`.specify/memory/constitution.md` y comprobando que el nuevo principio, por
sí solo, permite decidir sin ambigüedad si un `import`/llamada nuevo en
`frontend/src` cumple o no la regla — incluyendo los dos casos límite ya
identificados (redirección de página a un proveedor OAuth externo, y carga
de recursos estáticos vía HTML).

**Acceptance Scenarios**:

1. **Given** la constitution tiene hoy 8 Core Principles y ninguno regula el
   destino de las peticiones de red del frontend, **When** se entrega esta
   historia, **Then** debe incluir un nuevo Core Principle (siguiente número
   romano tras el VIII) con el mismo formato que los existentes (lenguaje
   MUST/MUST NOT + párrafo Rationale).
2. **Given** la política de versionado ya documentada ("MINOR: A new
   principle... is added"), **When** se añade el principio, **Then** la
   versión debe subir de 2.5.0 a 2.6.0, el campo de última modificación debe
   actualizarse a la fecha real de la amendment, y el "Sync Impact Report"
   del comentario inicial debe sustituirse por uno que documente 2.5.0 →
   2.6.0, siguiendo el mismo formato ya usado por las amendments anteriores.
3. **Given** que hoy no existe ninguna llamada directa a Discogs/Firestore
   desde el frontend pero sí tres llamadas directas del SDK cliente de
   Firebase Auth, **When** se redacta el principio, **Then** debe fijar en
   lenguaje MUST: (a) todo código de `frontend/` que inicie una petición de
   red mediante JS (fetch, XHR, WebSocket, o un SDK de terceros) debe
   dirigirse exclusivamente al backend propio de Vinylmania; (b) ningún SDK
   de un proveedor externo (Firebase, Discogs, o cualquier futuro
   equivalente) debe usarse desde `frontend/` para hacer peticiones de
   datos — su integración vive en `backend/`.
4. **Given** el precedente ya existente del flujo Discogs (redirección de
   página completa a la página de autorización externa, nunca un
   fetch/SDK), **When** se redacta el principio, **Then** debe declarar
   explícitamente que una navegación de página completa hacia la página de
   autorización de un proveedor de identidad externo NO es una "petición"
   en el sentido de este principio — es inevitable en cualquier flujo OAuth
   basado en redirección y está fuera del control del código JS de la
   aplicación — para que no se interprete como que prohíbe el propio
   mecanismo de login/enlace de cuentas.
5. **Given** la decisión de dejar fuera de alcance las imágenes de portada
   (vía CDN externo) y la tipografía (vía enlace a fuente externa), **When**
   se redacta el principio, **Then** debe declarar explícitamente que la
   carga de recursos estáticos vía atributos HTML nativos (no iniciada por
   JS) queda fuera de su alcance, para evitar que un futuro lector
   interprete el principio como una prohibición de servir imágenes o
   fuentes de un origen externo.
6. **Given** las plantillas de planificación y especificación del proyecto
   no tienen hoy ninguna referencia a este principio, **When** se ratifica,
   **Then** debe comprobarse (mismo paso que cada Sync Impact Report
   anterior) si necesitan actualización — p. ej. un gate de "¿esta feature
   de frontend inicia alguna petición fuera del backend?" — y actualizarse
   si es así, o marcarse explícitamente como "sin cambios necesarios" si no.

---

### User Story 2 - Login rediseñado para que el frontend deje de hablar con Firebase/Google directamente (Priority: P1)

Como desarrollador de Vinylmania, quiero que `frontend/src` deje de importar
el SDK cliente de Firebase Auth y de llamar directamente a los servidores de
Google/Firebase desde el navegador para iniciar sesión, comprobar el estado
de autenticación u obtener credenciales, sustituyendo el login por un flujo
mediado 100% por el backend (redirección de página completa, igual que el
enlace de cuenta Discogs ya existente), para que la única petición de red
que el frontend inicia con JS sea contra el backend propio, cumpliendo el
principio ratificado en la User Story 1.

**Why this priority**: es la única violación real hoy del principio, y
bloquea que la User Story 1 tenga sentido en la práctica — un principio que
el propio código base viola el día que se ratifica no es creíble. Se
entrega junto a la User Story 1 en el mismo esfuerzo, no como trabajo
diferido.

**Independent Test**: se puede validar comprobando que `frontend/src` no
contiene ningún `import` del SDK cliente de Firebase Auth ni del SDK base
de Firebase, que las dependencias del frontend ya no listan el paquete de
Firebase (salvo justificación documentada de que sigue haciendo falta), y
que el flujo completo de login (botón "Sign in with Google" → redirección →
vuelta a la app autenticada) sigue funcionando de extremo a extremo contra
un doble de prueba de Google usado en las pruebas automatizadas.

**Acceptance Scenarios**:

1. **Given** el cliente de Firebase Auth se inicializa hoy en el frontend y
   se usa para iniciar sesión con popup, escuchar cambios de sesión y
   obtener el token de identidad, **When** se completa esta historia,
   **Then** todo ese código debe quedar eliminado o vaciado de cualquier
   dependencia del SDK cliente de Firebase Auth; el botón "Sign in with
   Google" debe iniciar una navegación de página completa hacia una URL de
   autorización servida por el backend (mismo patrón que el enlace de
   cuenta Discogs existente, adaptado a Google OAuth 2.0), nunca un popup
   ni una llamada SDK.
2. **Given** el backend hoy no tiene ningún caso de uso ni ruta para
   iniciar/completar un login con Google (solo existe un flujo equivalente
   para Discogs), **When** se completa esta historia, **Then** debe existir
   un flujo equivalente para Google que intercambie el código de
   autorización directamente servidor-a-servidor con Google — el navegador
   nunca debe recibir ni manejar el secreto de cliente de la aplicación
   OAuth.
3. **Given** el cliente HTTP del frontend adjunta hoy el token de cada
   petición autenticada al backend obteniéndolo del SDK cliente de Firebase
   Auth, **When** se completa esta historia, **Then** ese cliente HTTP debe
   seguir adjuntando credenciales a cada petición, pero mediante el
   mecanismo de sesión propio que el backend emita al completar el login
   (p. ej. cookie de sesión `HttpOnly` o token de sesión opaco emitido por
   el backend) — nunca un ID token de Firebase obtenido vía SDK cliente —
   sin que ninguno de los servicios consumidores existentes necesite
   cambiar su propia lógica de llamada.
4. **Given** el backend verifica hoy el token de cada petición autenticada
   como un ID token real de Firebase, **When** se completa esta historia,
   **Then** esa verificación debe adaptarse para validar el mecanismo de
   sesión propio del backend (punto 3) en vez de un ID token de Firebase,
   manteniendo la separación entre lógica de aplicación y detalle de
   proveedor ya existente en el backend.
5. **Given** hoy no existe ningún endpoint de backend de logout explícito
   más allá de una llamada al SDK de Firebase ejecutada en el cliente,
   **When** se completa esta historia, **Then** debe existir un endpoint de
   backend que invalide la sesión propia (revoque la cookie/token), y la
   acción de cerrar sesión en el frontend debe llamarlo en vez de invocar
   al SDK de Firebase; este endpoint MUST revocar únicamente la sesión del
   dispositivo/navegador actual, sin afectar a otras sesiones activas del
   mismo usuario en otros dispositivos (ver Clarifications).
6. **Given** el doble de prueba usado hoy en las pruebas automatizadas de
   login depende por completo del popup del emulador de Firebase Auth,
   **When** se completa esta historia, **Then** debe existir un reemplazo
   equivalente al doble de prueba ya usado para Discogs (un servidor HTTP
   propio que sustituye los endpoints de Google usados por el nuevo flujo),
   y las pruebas de login deben rediseñarse para navegar ese flujo de
   redirección de página completa en vez de esperar un popup — todas las
   pruebas automatizadas que hoy dependen del login simulado deben seguir
   pasando con el doble de prueba rediseñado.
7. **Given** la regla de cobertura ya existente para cambios en el
   frontend, **When** se entrega esta historia, **Then** el flujo de login
   rediseñado debe tener cobertura de pruebas end-to-end explícita (login
   exitoso, denegación/cancelación por el usuario, expiración de la
   sesión) usando el doble de prueba del punto 6.
8. **Given** el frontend depende hoy del paquete de Firebase únicamente
   para el SDK base y el SDK de autenticación, **When** se completa esta
   historia y ningún otro fichero del frontend importa ese paquete,
   **Then** la dependencia debe retirarse de las dependencias del frontend.
9. **Given** una sesión activa expira mientras el usuario navega la
   aplicación (no durante la carga inicial de la página), **When** una
   petición autenticada al backend falla por expiración, **Then** el
   sistema MUST intentar renovar la sesión en segundo plano de forma
   silenciosa, sin redirigir ni mostrar ningún mensaje de error visible,
   replicando la experiencia de auto-renovación ya existente hoy con el SDK
   de Firebase Auth; solo si esa renovación en sí falla (p. ej. el acceso
   fue revocado, o se superó el límite máximo de renovación) debe tratarse
   como una sesión expirada real y seguir el flujo de denegación/expiración
   ya definido para el login.

---

### Edge Cases

- El nuevo principio aplica solo a `frontend/`; no sustituye ni contradice
  al principio existente sobre arquitectura hexagonal del backend ni al de
  integración con Discogs (que ya asume que la integración vive en backend
  sin decirlo expresamente).
- Las pruebas end-to-end no están sujetas a este principio de producto (sus
  dobles de prueba existen precisamente para simular a los terceros
  externos) — esto debe quedar explícito para que no se lea como una
  contradicción cuando la User Story 2 introduzca un doble de prueba para
  Google.
- El frontend distingue hoy entre "comprobación silenciosa de sesión al
  cargar la página" y "flujo de login en curso" (estado de popup); con una
  redirección de página completa, ambos casos pasan a ser el mismo tipo de
  evento (la página se recarga tras volver del proveedor) — debe
  preservarse esa distinción de experiencia de usuario (p. ej. un estado de
  carga en una página de retorno dedicada, similar a la ya existente para
  el enlace de cuenta Discogs) sin necesidad de seguir escuchando cambios
  de estado de un SDK que ya no existe.
- Cuando la sesión expira mientras el usuario navega activamente la
  aplicación (no en la carga inicial), el sistema debe renovarla en segundo
  plano sin redirigir ni mostrar ningún mensaje de error, siempre que la
  renovación en sí sea posible (ver Clarifications); solo si la propia
  renovación falla debe tratarse como una expiración real de sesión.
- Los mensajes de error específicos del SDK de Firebase (popup cerrado por
  el usuario, popup bloqueado, etc.) dejan de aplicar con una redirección
  de página completa; deben sustituirse por los equivalentes que el nuevo
  flujo de backend pueda señalizar (denegado, expirado, error), en la línea
  del patrón de resultado ya usado por la página de retorno del enlace de
  cuenta Discogs.
- El arranque de la aplicación que fija el tema visual antes de que la
  interfaz se monte no depende del SDK de Firebase Auth y no debe verse
  afectado por esta migración, pero conviene confirmarlo explícitamente al
  tocar el arranque de la app.
- Debe confirmarse si las pruebas de backend que hoy generan credenciales
  de prueba contra el emulador de autenticación necesitan el mismo
  rediseño o si, al no pasar por el navegador, pueden seguir generando
  credenciales de prueba de otra forma compatible con el nuevo mecanismo de
  sesión.
- En el momento del despliegue, cualquier usuario con una sesión antigua
  basada en un ID token de Firebase verá su siguiente petición autenticada
  rechazada (ver Clarifications); esto MUST tratarse como una expiración de
  sesión ordinaria, no como un incidente, y no requiere lógica de
  verificación dual ni una ventana de transición.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La constitution del proyecto MUST incluir un nuevo Core
  Principle, con el mismo formato que los principios existentes, que
  establezca que todo código de `frontend/` que inicie una petición de red
  mediante JavaScript (fetch, XHR, WebSocket, o un SDK de terceros) debe
  dirigirse exclusivamente al backend propio de Vinylmania.
- **FR-002**: El nuevo Core Principle MUST prohibir explícitamente el uso
  desde `frontend/` de cualquier SDK de un proveedor externo (Firebase,
  Discogs, o equivalentes futuros) para realizar peticiones de datos.
- **FR-003**: El nuevo Core Principle MUST declarar explícitamente que una
  navegación de página completa hacia la página de autorización de un
  proveedor de identidad externo no constituye una "petición" a efectos de
  este principio.
- **FR-004**: El nuevo Core Principle MUST declarar explícitamente que la
  carga de recursos estáticos vía atributos HTML nativos (no iniciada por
  JavaScript) queda fuera de su alcance.
- **FR-005**: El nuevo Core Principle MUST aclarar que no aplica al código
  de pruebas end-to-end, cuyos dobles de prueba existen para simular a los
  terceros externos.
- **FR-006**: La ratificación del nuevo Core Principle MUST seguir la
  política de versionado semántico ya documentada en la constitution (subir
  de versión MINOR) e incluir un Sync Impact Report equivalente a los de
  amendments anteriores.
- **FR-007**: El sistema MUST comprobar si las plantillas de planificación
  y especificación del proyecto necesitan actualización a raíz del nuevo
  principio, y actualizarlas o documentar explícitamente que no lo
  necesitan.
- **FR-008**: El frontend MUST dejar de iniciar sesión, comprobar el estado
  de autenticación y obtener credenciales mediante un SDK cliente de
  terceros; el login MUST iniciarse mediante una navegación de página
  completa hacia una URL de autorización servida por el backend.
- **FR-009**: El backend MUST exponer un flujo de inicio y finalización de
  login con el proveedor de identidad, equivalente en forma al flujo ya
  existente para el enlace de cuenta con Discogs, que intercambie el código
  de autorización servidor-a-servidor sin exponer nunca el secreto de
  cliente al navegador.
- **FR-010**: El backend MUST emitir un mecanismo de sesión propio al
  completar el login (p. ej. cookie de sesión `HttpOnly` o token de sesión
  opaco), y el cliente HTTP del frontend MUST adjuntar ese mecanismo — en
  vez de un token de identidad de terceros — a cada petición autenticada
  dirigida al backend, sin requerir cambios en la lógica de los servicios
  consumidores existentes.
- **FR-011**: El backend MUST verificar el mecanismo de sesión propio en
  cada petición autenticada, sustituyendo la verificación actual basada en
  un token de identidad de terceros.
- **FR-012**: El backend MUST exponer un endpoint que invalide la sesión
  propia (cierre de sesión), y el frontend MUST invocarlo al cerrar sesión
  en vez de invocar un SDK de terceros; este endpoint MUST revocar
  únicamente la sesión del dispositivo/navegador desde el que se invoca,
  sin invalidar otras sesiones activas del mismo usuario en otros
  dispositivos.
- **FR-013**: El sistema de pruebas automatizadas MUST contar con un doble
  de prueba HTTP propio para los endpoints del proveedor de identidad
  usados por el nuevo flujo de login, equivalente en forma al ya existente
  para Discogs, de modo que ninguna prueba dependa de un popup real ni del
  proveedor externo real.
- **FR-014**: El login rediseñado MUST tener cobertura de pruebas
  end-to-end explícita para: login exitoso, denegación o cancelación por
  el usuario, y expiración de la sesión.
- **FR-015**: Una vez que ningún código del frontend dependa del SDK de
  Firebase Auth ni del SDK base de Firebase, esa dependencia MUST retirarse
  de las dependencias declaradas del frontend.
- **FR-016**: El sistema MUST preservar la distinción de experiencia de
  usuario entre "comprobación silenciosa de sesión existente al cargar la
  página" y "flujo de login en curso", adaptada a un modelo basado en
  redirección de página completa en vez de popup.
- **FR-017**: El sistema MUST comunicar al usuario los mismos resultados de
  login que hoy (éxito, cancelación/denegación, error) mediante mensajes
  equivalentes a los actuales, sin depender de códigos de error específicos
  de un SDK de terceros.
- **FR-018**: El sistema MUST renovar la sesión del usuario de forma
  silenciosa y automática en segundo plano cuando esta expire durante el
  uso activo de la aplicación (no en la carga inicial), sin redirigir al
  usuario ni mostrar ningún mensaje de error visible, replicando la
  experiencia de auto-renovación ya existente hoy con el SDK cliente de
  Firebase Auth; solo cuando esa renovación en sí no sea posible el sistema
  MUST tratarlo como una sesión expirada real y aplicar el flujo de
  denegación/expiración ya definido para el login (FR-017).
- **FR-019**: Tras el despliegue de este rediseño, el backend MUST dejar de
  aceptar tokens de identidad de Firebase emitidos por el flujo de login
  antiguo, sin implementar un mecanismo de verificación dual temporal; a
  cualquier usuario cuya sesión antigua deje de ser válida se le MUST
  tratar en su siguiente petición autenticada como una sesión expirada real
  (FR-018), siguiendo el mismo flujo de re-login que cualquier otra
  expiración de sesión.

### Key Entities *(include if feature involves data)*

- **Core Principle (constitution)**: regla normativa versionada que define
  qué peticiones de red puede iniciar el frontend y hacia dónde; vive junto
  a los principios existentes en el documento de gobernanza del proyecto.
- **Sesión de usuario**: representación de la autenticación de un usuario
  emitida y controlada por el backend tras completar el login con el
  proveedor de identidad externo; sustituye al token de identidad de
  terceros como credencial de cada petición autenticada. Un mismo usuario
  MAY tener varias sesiones activas e independientes simultáneamente (una
  por dispositivo/navegador); cerrar sesión o que expire una de ellas no
  afecta a las demás.
- **Flujo de login con proveedor externo**: secuencia de redirección de
  página completa (inicio → autorización externa → retorno) mediada por el
  backend, análoga al flujo de enlace de cuenta Discogs ya existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `frontend/src` no contiene ningún import de un SDK de
  terceros usado para peticiones de datos (Firebase, cliente HTTP genérico
  de terceros); toda petición de red iniciada por JavaScript en
  `frontend/src` se dirige al backend propio.
- **SC-002**: La constitution del proyecto tiene un nuevo Core Principle
  dedicado a restringir las peticiones de red del frontend al backend
  propio, con su Sync Impact Report correspondiente, y las plantillas del
  proyecto revisadas contra él.
- **SC-003**: El login con el proveedor de identidad externo funciona de
  extremo a extremo (incluyendo pruebas automatizadas) sin que el navegador
  realice ninguna petición JavaScript/SDK directa al proveedor — la única
  interacción con el proveedor externo es una navegación de página completa
  hacia su página de autorización y de vuelta.
- **SC-004**: El frontend ya no declara una dependencia del paquete de
  Firebase.
- **SC-005**: Ningún contrato de API pública existente para dominios
  distintos de autenticación cambia como resultado de esta feature.
- **SC-006**: El 100% de las pruebas automatizadas que hoy dependen del
  login simulado siguen pasando tras el rediseño, sin pérdida de cobertura
  de los escenarios de login exitoso, denegación, renovación silenciosa de
  sesión durante el uso activo, y expiración real de sesión (cuando la
  renovación en sí no es posible).

## Assumptions

- No se fija en esta especificación el mecanismo exacto de sesión propia
  del backend (cookie `HttpOnly` con `SameSite`, token opaco en
  almacenamiento del cliente, JWT firmado, etc.) ni su duración/renovación
  — es una decisión de planificación técnica, incluyendo consideraciones de
  protección contra falsificación de petición si se opta por cookies.
- No se fija si la URL de retorno del proveedor de identidad debe apuntar
  directamente a una ruta del backend (que complete el intercambio y
  redirija de vuelta a la app ya con sesión) o a una página del frontend
  que reenvíe el código al backend (mismo patrón que la página de retorno
  del enlace de cuenta Discogs hoy) — ambas opciones son válidas y quedan
  para planificación.
- Se asume que el SDK de administración de Firebase sigue siendo necesario
  en el backend para la base de datos y, si se sigue usando para gestionar
  registros de usuario, esto no entra en conflicto con el nuevo principio,
  que regula el frontend, no el backend.
- No se ha verificado si las pruebas de backend que dependen hoy del
  emulador de autenticación necesitan cambios como consecuencia de esta
  feature — queda como verificación explícita antes de planificar la User
  Story 2.
- Se asume que el proveedor de identidad para el login sigue siendo el
  mismo que hoy (no cambia como parte de esta feature); solo cambia el
  mecanismo por el que el frontend interactúa con él.
- Se asume que la gestión de datos de usuario en la base de datos no forma
  parte de esta feature, salvo por el cambio de qué identifica a la
  sesión; y que el enlace de cuenta con el catálogo externo de discos, que
  ya cumple el principio, no se toca.
