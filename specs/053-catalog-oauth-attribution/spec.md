# Feature Specification: Identificar toda petición a Discogs con la cuenta vinculada del usuario

**Feature Branch**: `053-catalog-oauth-attribution`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Como responsable de vinylmania, quiero que toda petición a la API de Discogs hecha en nombre de un usuario vaya identificada de forma inequívoca con la cuenta de Discogs que ese usuario ha vinculado (OAuth), y nunca únicamente con el personal access token de la cuenta de Discogs de vinylmania, para que el consumo de rate limit y las acciones queden atribuidos a la cuenta real del usuario en lugar de computarse siempre contra el token compartido de la aplicación. Extiende a las peticiones de catálogo (búsqueda, ficha de release, master, versiones de master, artista, rating) el mismo criterio de identificación que ya aplican las peticiones de colección."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usuario con cuenta vinculada consulta catálogo con su propia identidad (Priority: P1)

Un usuario autenticado en vinylmania que ya ha vinculado su cuenta de Discogs busca discos, o consulta la ficha de un release, master, las versiones de un master, un artista o la valoración de un release. Estas peticiones a Discogs deben quedar identificadas con la cuenta de Discogs propia del usuario, no con la cuenta compartida de vinylmania.

**Why this priority**: Es el propósito central de la historia: sin esto, el consumo de rate limit y las acciones de cualquier usuario vinculado se siguen computando contra el token compartido de vinylmania, anulando el objetivo de negocio.

**Independent Test**: Con un usuario que tiene su cuenta de Discogs vinculada, realizar una búsqueda y consultar una ficha de release/master/artista/rating, y verificar que cada una de esas peticiones a Discogs queda identificada con las credenciales de la cuenta vinculada del usuario y no con la cuenta de vinylmania.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado en vinylmania con su cuenta de Discogs vinculada, **When** realiza una búsqueda en el catálogo, **Then** la petición a Discogs queda identificada con la cuenta vinculada del usuario, no con la cuenta de vinylmania.
2. **Given** un usuario autenticado en vinylmania con su cuenta de Discogs vinculada, **When** consulta la ficha de un release, un master, las versiones de un master, un artista o la valoración de un release, **Then** cada una de esas peticiones a Discogs queda identificada con la cuenta vinculada del usuario.

---

### User Story 2 - Usuario sin cuenta vinculada sigue usando la app con normalidad (Priority: P1)

Un usuario autenticado en vinylmania que todavía no ha vinculado su cuenta de Discogs realiza las mismas acciones de catálogo (búsqueda, fichas, valoraciones). El sistema debe seguir sirviéndole con normalidad, identificando esas peticiones con la cuenta compartida de vinylmania, exactamente igual que hoy.

**Why this priority**: Es una condición explícita de no-regresión: la historia no puede introducir fricción ni bloquear a la mayoría de usuarios que aún no han vinculado su cuenta. Es tan crítica como la propia identificación, porque una implementación que "falle cerrado" para usuarios no vinculados rompería el catálogo para gran parte de la base de usuarios.

**Independent Test**: Con un usuario autenticado que no tiene cuenta de Discogs vinculada, realizar las mismas acciones de catálogo que en la Historia 1 y comprobar que se completan con éxito y que la petición queda identificada con la cuenta de vinylmania.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado sin cuenta de Discogs vinculada, **When** realiza una búsqueda o consulta cualquiera de las fichas de catálogo, **Then** la petición se sirve con normalidad y queda identificada con la cuenta de vinylmania, igual que hasta ahora.

---

### User Story 3 - Credenciales vinculadas revocadas no se sustituyen en silencio (Priority: P1)

Un usuario tiene su cuenta de Discogs vinculada, pero esas credenciales han sido revocadas fuera de vinylmania (por ejemplo, desde la propia configuración de Discogs). Cuando el sistema intenta identificar una petición de catálogo con esa cuenta, debe detectar que ya no es válida y tratarlo igual que ya se hace hoy en colección: pedir al usuario que vuelva a vincular su cuenta, sin recurrir en silencio a la cuenta de vinylmania como sustituto.

**Why this priority**: Es la salvaguarda que evita que la historia se incumpla de forma invisible. Sin este comportamiento, cualquier revocación externa haría que el sistema volviera a atribuir en silencio el consumo al token de vinylmania, que es exactamente lo que la historia busca evitar, y el problema pasaría desapercibido porque la petición seguiría "funcionando".

**Independent Test**: Con una cuenta vinculada cuyas credenciales han sido revocadas externamente, realizar una acción de catálogo y comprobar que el usuario recibe la misma experiencia de "reconexión requerida" que ya existe hoy para colección, y que la petición a Discogs no se completa usando la cuenta de vinylmania.

**Acceptance Scenarios**:

1. **Given** una cuenta vinculada cuyas credenciales han sido revocadas externamente, **When** el usuario realiza una acción de catálogo, **Then** el sistema no completa la petición sustituyendo en silencio por la cuenta de vinylmania, y el usuario recibe el mismo aviso de reconexión que ya recibe hoy al usar colección en esa misma situación.

---

### User Story 4 - Trazabilidad de qué credencial identificó cada petición (Priority: P2)

Para poder auditar el cumplimiento de esta historia a lo largo del tiempo, cada petición de catálogo hecha en nombre de un usuario debe dejar constancia, en el registro de actividad del sistema, de si quedó identificada con la cuenta de vinylmania o con la cuenta vinculada del usuario — sin exponer en ningún caso los tokens o secretos usados.

**Why this priority**: No cambia el comportamiento de cara al usuario, pero es lo que permite comprobar de forma continua que la historia se sigue cumpliendo y detectar regresiones futuras. Se prioriza después de las historias 1-3 porque depende de que el comportamiento de identificación ya exista para tener algo que auditar.

**Independent Test**: Revisando el registro de actividad tras una serie de peticiones de catálogo (con y sin cuenta vinculada, y con credenciales revocadas), comprobar que cada entrada indica qué tipo de credencial identificó la petición, sin que aparezcan valores de token o secreto en ningún caso.

**Acceptance Scenarios**:

1. **Given** una petición de catálogo ya resuelta (con cualquiera de los tres resultados anteriores: identificada con el usuario, identificada con vinylmania, o rechazada por credenciales revocadas), **When** se revisa el registro de actividad correspondiente, **Then** queda indicado qué tipo de credencial identificó la petición, y no aparece ningún token ni secreto.

---

### Edge Cases

- Un usuario vincula su cuenta de Discogs a mitad de sesión: las peticiones de catálogo posteriores a la vinculación deben quedar identificadas con la cuenta recién vinculada, sin necesidad de reiniciar sesión.
- Una ficha de catálogo ya está en caché (fue obtenida previamente con cualquiera de las dos credenciales): servir esa respuesta cacheada no debe considerarse una identificación incorrecta, dado que el contenido de catálogo es el mismo independientemente de qué credencial lo solicitó (ver Assumptions).
- Las peticiones de colección (biblioteca del usuario) no deben verse afectadas por este cambio; deben seguir comportándose exactamente igual que hoy.
- Un usuario nunca ha estado autenticado en vinylmania no puede llegar a este flujo: todas las peticiones de catálogo cubiertas por esta historia ya requieren que el usuario esté autenticado en vinylmania, con o sin cuenta de Discogs vinculada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE identificar toda petición de catálogo (búsqueda, ficha de release, ficha de master, versiones de un master, ficha de artista¹, valoración de un release) realizada en nombre de un usuario autenticado con cuenta de Discogs vinculada activa, usando las credenciales de esa cuenta vinculada.
- **FR-002**: El sistema DEBE seguir identificando las peticiones de catálogo de un usuario autenticado sin cuenta de Discogs vinculada con la cuenta compartida de vinylmania, sin bloquear ni degradar esa experiencia.
- **FR-003**: El sistema NO DEBE sustituir en silencio, ante credenciales vinculadas inválidas o revocadas, la identificación por la cuenta de vinylmania; DEBE tratar esa situación con el mismo comportamiento de "reconexión requerida" que ya existe hoy para las peticiones de colección.
- **FR-004**: La cuenta de vinylmania solo DEBE considerarse una identificación legítima para peticiones de usuarios sin cuenta vinculada activa; nunca DEBE actuar como sustituto de una cuenta vinculada activa y válida.
- **FR-005**: El sistema DEBE registrar, para cada petición de catálogo realizada en nombre de un usuario, qué tipo de credencial la identificó (vinylmania o cuenta del usuario), sin registrar en ningún caso el valor del token o secreto usado.
- **FR-006**: El comportamiento de las peticiones de colección (biblioteca del usuario) DEBE permanecer sin cambios; esta historia no las modifica.
- **FR-007**: El contenido de catálogo servido a los usuarios DEBE seguir siendo el mismo independientemente de qué credencial identificó la petición que lo obtuvo.

### Key Entities

- **Petición de catálogo**: una llamada a Discogs (búsqueda, release, master, versiones de master, artista, rating) hecha en nombre de un usuario autenticado de vinylmania. Atributos relevantes: usuario solicitante, tipo de credencial que la identificó (vinylmania / cuenta del usuario), resultado (completada, rechazada por reconexión requerida).
- **Cuenta de Discogs vinculada**: la cuenta OAuth 1.0a que un usuario ya ha vinculado a su perfil de vinylmania (entidad existente, reutilizada de la funcionalidad de colección). Atributos relevantes: estado del vínculo (activo, revocado, inexistente).
- **Registro de auditoría de credencial**: constancia en el registro de actividad del sistema de qué tipo de credencial identificó una petición de catálogo concreta, sin datos sensibles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las peticiones de catálogo hechas por usuarios con cuenta de Discogs vinculada activa quedan identificadas con esa cuenta, no con la de vinylmania (medible sobre las peticiones que efectivamente ocurren hoy — ver nota¹ sobre ficha de artista).
- **SC-002**: Los usuarios sin cuenta vinculada pueden seguir buscando y consultando fichas de catálogo con la misma tasa de éxito que antes de este cambio (0% de peticiones adicionales bloqueadas o degradadas por no tener cuenta vinculada).
- **SC-003**: Ante una cuenta vinculada con credenciales revocadas, el 100% de las peticiones de catálogo de ese usuario resultan en el mismo aviso de reconexión que ya existe hoy en colección, con 0% de sustituciones silenciosas por la cuenta de vinylmania.
- **SC-004**: Un auditor puede determinar, a partir únicamente del registro de actividad, qué tipo de credencial identificó cualquier petición de catálogo pasada, para el 100% de las peticiones, sin que el registro exponga tokens ni secretos.

## Assumptions

- El contenido de catálogo que devuelve Discogs es el mismo independientemente de qué credencial lo solicitó, por lo que el cacheo actual de catálogo (por identificador de recurso) se mantiene sin cambios; lo único que cambia es qué credencial se usa para poblar esa caché.
- Un usuario de vinylmania tiene como máximo una cuenta de Discogs vinculada a la vez, igual que en el modelo de vinculación ya existente para colección.
- Se considera "credenciales revocadas" cuando Discogs responde a una petición firmada con la cuenta vinculada indicando que esas credenciales ya no son válidas; el criterio de detección es el mismo que ya usa hoy el flujo de colección para decidir que hace falta reconexión.
- Todas las peticiones de catálogo cubiertas por esta historia ya requieren que el usuario esté autenticado en vinylmania; no existe un escenario de catálogo servido a usuarios anónimos dentro del alcance de esta historia.
- El objetivo de negocio (atribuir el consumo de rate limit a la cuenta real del usuario) se cumple identificando correctamente cada petición con la credencial adecuada; la medición o visualización del consumo de rate limit por cuenta no forma parte del alcance de esta historia.
- ¹ **Ficha de artista**: hoy no existe ninguna ruta ni pantalla en vinylmania que permita a un usuario consultar la ficha de un artista de forma independiente (verificado: no hay endpoint `/api/discogs/artists/:id` ni página de artista en el frontend). Esta historia deja el soporte de identificación de credencial preparado a nivel de puerto/adaptador para cuando esa funcionalidad exista, pero no añade la ruta ni la pantalla — no es una acción que un usuario real pueda disparar todavía. SC-001 se mide, por tanto, solo sobre las acciones de catálogo que sí son alcanzables hoy (búsqueda, release, master, versiones de master, rating).
