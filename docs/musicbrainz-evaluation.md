# Discogs vs. MusicBrainz (y otras alternativas) como base de datos de catálogo para Vinylmania

**Fecha**: 6 de septiembre de 2026
**Autor**: Investigación técnica solicitada por Fernando, preparada como informe de producto/arquitectura
**Alcance**: Evaluar si sustituir Discogs por MusicBrainz como fuente de datos de catálogo resuelve el problema de rate limiting, sin perder la integración con Discogs (Vinylmania seguirá siendo standalone), y explorar otras alternativas de base de datos musical.

---

## Resumen ejecutivo

**Recomendación: no migrar Vinylmania de Discogs a MusicBrainz.** El límite de peticiones no es, en el fondo, un problema de "base de datos equivocada": es un límite de 60 peticiones/minuto (autenticado) o 25/min (sin autenticar) compartido por IP, y Vinylmania ya ha construido en torno a él una capa de resiliencia notablemente madura (retry con backoff, circuit breaker, un rate limiter local que respeta las cabeceras `X-Discogs-Ratelimit-*`, y control de concurrencia en el enriquecimiento de resultados de búsqueda — specs 029 y 040). MusicBrainz no ofrece, de partida, más margen: su límite público es de 1 petición/segundo por IP (equivalente a 60/min, igual que el nivel autenticado de Discogs que ya tenéis), aplicado además con rechazo total (503) en vez de una respuesta gradual.

Pero el motivo de fondo para no migrar es otro, y es más importante que el rate limit: **una parte central de Vinylmania ya no es solo "consultar un catálogo", es "leer y escribir en la colección personal real del usuario en Discogs"**. Desde las specs 015/016/048, el rating con estrellas, el estado del vinilo, el estado de la portada y las notas de cada copia se guardan mediante OAuth directamente en la colección de Discogs del usuario — Discogs es la fuente de verdad de esos datos, no una caché de Vinylmania. MusicBrainz no tiene un equivalente funcional a esto: sus "Collections" son listas de pertenencia simples, sin grading de condición, sin notas de copia y sin el mismo tipo de API de escritura orientada a coleccionistas. Sustituir Discogs por MusicBrainz para todo implicaría, en la práctica, reconstruir desde cero el sistema de colección personal en la base de datos propia de Vinylmania (Firestore) — es decir, deshacer una decisión de producto ya tomada (spec 016), no cambiar un proveedor de datos.

Dicho esto, la investigación sí encuentra dos vías de mejora reales que conviene explorar, y que no son mutuamente excluyentes:

1. **A corto/medio plazo, la palanca con mejor relación esfuerzo/beneficio es indexar localmente los volcados masivos (data dumps) que el propio Discogs publica cada mes bajo licencia CC0**, para servir búsqueda y navegación de catálogo desde una réplica propia en lugar de contra la API en vivo — sin cambiar de proveedor, sin perder terminología de grading conocida por los usuarios, y sin tocar la parte de colección/OAuth. Esto ataca directamente la causa que motivó la spec 040 (los picos de peticiones de búsqueda son el origen identificado del problema).
2. **A más largo plazo, MusicBrainz + Cover Art Archive encajan bien como fuente complementaria/fallback**, no como sustituto: enriquecer metadatos que Discogs no tiene bien resueltos (relaciones entre artistas, MBIDs estables, grupos de lanzamiento) o servir carátulas cuando Discogs no las tiene. Esto es tácticamente sencillo porque el catálogo Discogs ya vive detrás de un `DiscogsCatalogPort` (spec 047, arquitectura hexagonal) — añadir un segundo adaptador es un patrón conocido, no una reescritura.

El resto de este documento desarrolla la investigación que sostiene esta recomendación.

---

## 1. Contexto: qué problema tiene Vinylmania hoy con Discogs

Antes de evaluar alternativas conviene ser precisos sobre cuál es el problema real, porque ya está bastante documentado en el propio repositorio:

- **Límites confirmados de Discogs**: 60 peticiones/minuto autenticadas, 25/minuto sin autenticar, en una ventana móvil de 60 segundos, con cabeceras `X-Discogs-Ratelimit`, `X-Discogs-Ratelimit-Used` y `X-Discogs-Ratelimit-Remaining` en cada respuesta (spec `002-discogs-api-client`).
- **Ya existe una capa de resiliencia reactiva** (spec `029-discogs-retry-resilience`): reintentos con backoff (300 ms, 900 ms, con jitter) solo ante 429/5xx, nunca ante 401/403/404; un circuit breaker de dos estados (5 fallos agotados en 30s → abierto 20s) compartido entre el cliente de catálogo y el de colección.
- **Y una capa preventiva** (spec `040-discogs-rate-limit-smoothing`): un rate limiter local que estima el presupuesto restante a partir de las cabeceras reales, espacía peticiones antes de que Discogs las rechace, y limita a 5 el número de llamadas simultáneas al enriquecer resultados de búsqueda con el rating de la comunidad — identificado explícitamente como el mayor generador de picos ("con el tamaño de página por defecto, una única búsqueda en frío puede disparar decenas de llamadas de rating simultáneas").
- **El catálogo ya está aislado detrás de un puerto** (spec `047-discogs-catalog-hexagonal-migration`): `discogsClient.ts` ya no se invoca directamente desde las rutas ni desde la lógica de negocio, sino a través de un `DiscogsCatalogPort`. Esto es una noticia muy buena para cualquier decisión de este informe: añadir o sustituir una fuente de datos de catálogo es, arquitectónicamente, "un adaptador nuevo", no una reescritura transversal.
- **La colección personal ya no vive en Firestore**: desde la spec `016-library-discogs-sync`, el rating (5 estrellas), el estado del vinilo, el estado de la portada y las notas de cada copia se leen y escriben directamente en la colección de Discogs del usuario vía OAuth (specs `015`, `048`), y los campos equivalentes se eliminaron de Firestore una vez confirmada la migración. Discogs es hoy el sistema de registro de esos datos, no Vinylmania.
- **El rating visible en las tarjetas de búsqueda y biblioteca es el rating comunitario de Discogs** (spec `017-record-rating-cards`), no un rating propio de Vinylmania.

Es decir: el dolor identificado (mensajes de "servicio ocupado", picos de 429) ya tiene ingeniería considerable dedicada a mitigarlo, y aun así sigue siendo perceptible — lo cual apunta a que el techo real es el límite en sí (25-60 req/min por IP), no una carencia de resiliencia. Cambiar de proveedor solo ayuda si el nuevo proveedor ofrece más techo o si se elimina la necesidad de pedir en vivo. Es exactamente ese criterio el que hay que aplicar a MusicBrainz.

---

## 2. Qué es MusicBrainz y cómo funciona

[MusicBrainz](https://musicbrainz.org/) es una base de datos musical abierta, editada por su comunidad, mantenida por la fundación sin ánimo de lucro MetaBrainz. A diferencia de Discogs (orientado a coleccionismo y mercado de segunda mano de vinilo/CD), MusicBrainz nació como un proyecto de metadatos "canónicos" para identificar de forma inequívoca grabaciones, lanzamientos y artistas mediante identificadores estables (**MBID**, un UUID por entidad) que otros sistemas (Picard, last.fm, ListenBrainz, muchos reproductores) usan como referencia común.

### 2.1 Modelo de datos

La API expone 13 tipos de entidad principales — `area`, `artist`, `event`, `genre`, `instrument`, `label`, `place`, `recording`, `release`, `release-group`, `series`, `work`, `url` — más `rating`, `tag` y `collection` como recursos no nucleares, y permite además búsquedas por `discid`, `isrc` e `iswc`. Para el caso de uso de Vinylmania, los conceptos clave son:

- **Release Group**: la obra "abstracta" (p. ej. *"OK Computer"*), agrupando todas sus ediciones.
- **Release**: una edición concreta de esa obra — exactamente el nivel al que Discogs modela un lanzamiento físico. Un release en MusicBrainz incluye `barcode` (UPC/EAN), uno o varios `catalog-number` por sello, `packaging` (de una lista controlada de tipos de embalaje), país y fecha, y sus `label` asociados.
- **Medium**: cada soporte físico dentro de un release — importante para vinilo, porque **ambas caras de un disco de vinilo se modelan como un único "medium"**, no como dos; esto es una diferencia de modelado a tener en cuenta si se migran o cruzan datos.
- **Recording** / **Work**: la grabación concreta y la composición subyacente, con relaciones muy ricas entre artistas (compositor, intérprete, productor, remezclador...), que en Discogs suelen quedar como campos de crédito menos estructurados.

Los formatos de respuesta son JSON o XML (XML por defecto; JSON con `fmt=json` o cabecera `Accept`). Las búsquedas por texto libre (`/ws/2/release/?query=...`) requieren obtener primero el MBID antes de poder hacer *lookups* o *browse* dirigidos.

### 2.2 Un límite que sorprende: no hay campo estructurado de matriz/runout

Un dato relevante para un catálogo de vinilo: la documentación pública de MusicBrainz para la entidad `Release` no incluye un campo dedicado y ampliamente usado de "matrix / runout" (los códigos grabados a mano o troquelados en el surco de salida del vinilo, que en Discogs es un campo de texto libre por soporte muy valorado por coleccionistas para distinguir prensajes idénticos en apariencia). MusicBrainz sí modela el `Medium` y sus discos (`disc ID`), pero la identificación fina de variantes de prensaje por matriz/runout es, históricamente, uno de los puntos fuertes diferenciales de Discogs frente a MusicBrainz para el público de coleccionismo físico de vinilo — vale la pena verificarlo de primera mano en el editor web antes de dar el dato por cerrado al 100%, pero no apareció como campo de primer nivel en la documentación de la API.

### 2.3 Carátulas: Cover Art Archive, un servicio aparte

MusicBrainz **no aloja imágenes de portada** en su propia base de datos; las carátulas viven en un servicio hermano, el [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API) (`coverartarchive.org`, operado sobre Internet Archive), enlazado por MBID de *release* o *release-group*: `/release/{mbid}/front`, `/release/{mbid}/back`, `/release/{mbid}/{id}`, con miniaturas en 250/500/1200px. La cobertura depende de que la comunidad haya subido y etiquetado ("front"/"back") la imagen — para muchas ediciones menos populares puede no haber nada, y el propio servicio devuelve 404 en ese caso. Esto es una diferencia práctica frente a Discogs, donde la imagen de portada suele estar presente porque forma parte del flujo de venta/cataloguing del propio marketplace.

### 2.4 Licencia de los datos

Este es un punto que conviene tener muy claro porque tiene dos capas distintas:

- **Los datos "core" de MusicBrainz (releases, artistas, relaciones, etc.) están bajo CC0** ("Creative Commons Zero" / dominio público) — se pueden usar sin restricción y sin necesidad de atribuir, algo más permisivo que la posición de Discogs (ver más abajo).
- **Los datos "no nucleares" (por ejemplo, ciertos metadatos suplementarios y los paquetes de replicación del Live Data Feed) están bajo CC BY-NC-SA 3.0**, que sí exige atribución, prohíbe uso comercial y obliga a compartir igual.
- **Las carátulas del Cover Art Archive no están cubiertas por la licencia CC0 de MusicBrainz** — su documentación de API no detalla una licencia uniforme para las imágenes en sí (dependen de lo subido por cada usuario), así que conviene revisar los términos de Cover Art Archive/Internet Archive específicamente si se van a mostrar esas imágenes en un producto.

### 2.5 Rate limiting real de MusicBrainz

Esta es la comprobación central para el objetivo declarado de "resolver los límites por minuto". Según la documentación oficial de rate limiting:

- **1 petición por segundo de media por IP** (~60/min) es el límite estándar salvo acuerdo distinto — es decir, **igual que el nivel ya autenticado de Discogs** que Vinylmania tiene hoy, no una mejora.
- Existe además un **límite global de servidor de 300 peticiones/segundo entre todo el tráfico**, y clientes con un `User-Agent` no identificativo (vacío, genérico, de librerías HTTP por defecto) se limitan aún más (≈50 req/s agregadas para todos esos clientes juntos, no por app).
- **No hay ningún mecanismo de autenticación que otorgue más cupo** en el uso normal de la API pública — a diferencia de Discogs, donde autenticarse ya duplica el límite (25→60/min).
- **El incumplimiento no es un 429 progresivo sino un rechazo directo (503)** cuando se supera cualquiera de las tres comprobaciones (user-agent, IP, capacidad global) — es decir, el fallo "duro" puede ser más brusco que el de Discogs, aunque en la práctica un cliente bien comportado a 1 req/s no debería nunca llegar a activarlo.
- Es obligatorio un `User-Agent` significativo (`NombreApp/versión (url-de-contacto)`); no hace falta API key para lectura pública.

**Conclusión de esta sección**: MusicBrainz no ofrece, de fábrica, más presupuesto de peticiones por minuto que el que Discogs ya concede a Vinylmania autenticado. El único camino real para eliminar el rate limit con MusicBrainz es **auto-alojar una réplica** (ver §2.6), no usar su API pública.

### 2.6 La vía que sí elimina el límite: auto-alojar un espejo (mirror) de MusicBrainz

MetaBrainz publica y mantiene [`musicbrainz-docker`](https://github.com/metabrainz/musicbrainz-docker), un proyecto Docker Compose oficial para levantar un espejo propio de la base de datos con replicación diaria automática (por defecto a las 3:00 UTC). Esto sí elimina por completo el rate limit, porque las consultas se hacen contra tu propia base de datos, no contra la API pública. El coste de esto, sin embargo, es real:

| | Espejo completo (con búsqueda indexada Solr) | Espejo mínimo (solo base de datos) |
|---|---|---|
| CPU | 16 hilos, x86-64 | 2 hilos |
| RAM | 16 GB | 4 GB |
| Disco | ~350 GB | ~100 GB |
| Complejidad | Alta — indexación de búsqueda, materialización de tablas, cron de replicación | Media |

Esto es infraestructura de servidor con estado persistente y disco considerable, difícilmente compatible con el despliegue actual de Vinylmania (Vercel serverless, sin servidor propio de larga duración según el README del proyecto) sin añadir una pieza de infraestructura nueva (una VM o servicio gestionado con Postgres+Solr) que hoy no existe en la arquitectura. Es una opción técnicamente válida pero que cambia sustancialmente el perfil operativo y de coste del proyecto, y probablemente desproporcionada para el problema concreto (picos de búsqueda) que motivó la spec 040.

### 2.7 Uso comercial y planes de pago

La API pública de MusicBrainz es gratuita para uso no comercial (personal, código abierto, académico, organizaciones sin ánimo de lucro) — la licencia AGPL + Commons Clause de Vinylmania encaja bien en esa categoría hoy. MetaBrainz clasifica como "comercial" a cualquier empresa con ingresos actuales o previstos, y en ese caso exige uno de sus planes de pago (Bronze desde 100 $/mes, Silver desde 600 $/mes, Gold desde 1.250 $/mes, hasta acuerdos "Unicornio" para grandes compañías) para acceso ampliado/Live Data Feed. Si en algún momento Vinylmania planteara un modelo de negocio de pago, esto habría que revisarlo — y conviene notar que, en ese escenario, Discogs tampoco es gratis para uso comercial sin permiso expreso (ver §5).

---

## 3. Nota importante encontrada en el propio código de Vinylmania (no relacionada con MusicBrainz, pero relevante)

Los términos de uso de la API de Discogs prohíben explícitamente **cachear o almacenar el contenido más tiempo del necesario para prestar servicio**, y exigen que los datos mostrados no tengan **más de 6 horas de antigüedad** respecto a lo que muestra discogs.com. La spec `011-tanstack-redis-caching` de Vinylmania fija TTLs "generosos" para release/artista descritos como "horas", sin un número concreto documentado como requisito de negocio. Es un asunto independiente de la decisión Discogs/MusicBrainz, pero como hallazgo colateral de esta investigación merece una verificación puntual: confirmar que el TTL configurado en `cacheAside.ts` no supera esas 6 horas para los datos de catálogo, para no entrar en conflicto con los términos de uso de la API que ya tenéis integrada.

---

## 4. Una alternativa que no está en tu lista y que probablemente sea la de mejor relación esfuerzo/beneficio: los volcados de datos (data dumps) del propio Discogs

Investigando otras opciones de base de datos apareció un dato importante que cambia el marco de la pregunta: **Discogs publica mensualmente un volcado completo de su base de datos (releases, artistas, labels, masters) en XML, bajo licencia CC0 ("No Rights Reserved")** — la misma licencia libre que MusicBrainz usa para sus datos core, pero con el catálogo que Vinylmania ya usa hoy, con la terminología de grading que sus usuarios ya conocen (Mint, VG+, etc.), y sin ninguna de las limitaciones de cobertura de vinilo de MusicBrainz.

Esto abre una tercera vía, distinta tanto de "seguir pegado a la API en vivo de Discogs" como de "migrar a MusicBrainz":

- **Indexar localmente el volcado mensual de Discogs** (por ejemplo en Postgres + Meilisearch/Typesense/OpenSearch, o incluso Algolia) para servir búsqueda y navegación de catálogo de solo lectura, sin depender de la API en vivo para ese tráfico — que es, según la propia spec 040, el origen identificado de los picos de peticiones.
- Es importante distinguir esto de "cachear respuestas de la API": el volcado es un dataset distinto, publicado bajo una licencia separada (CC0) de los términos de uso de la API (que sí restringen cachear "Content" de la API más de lo necesario y exigen la ventana de 6 horas mencionada en §3). Construir un índice a partir del volcado oficial, en vez de a partir de respuestas de la API cacheadas indefinidamente, evita ese roce contractual.
- Las imágenes de portada **no** vienen incluidas en el volcado (solo metadatos), así que la obtención de carátulas seguiría necesitando la API (o Cover Art Archive como fuente complementaria, si aplica).
- La actualización sería mensual, no en tiempo real — aceptable para catálogo (que cambia con baja frecuencia), pero no sustituye ni debe usarse para los datos de colección personal del usuario (rating, condición, notas), que deben seguir siendo lecturas/escrituras en vivo contra la cuenta real de Discogs del usuario vía OAuth.
- El coste operativo es mucho menor que auto-alojar un espejo de MusicBrainz (350 GB / 16 GB RAM), porque el volcado de Discogs es solo el dataset, sin necesidad de replicar la infraestructura completa de un servidor MusicBrainz.

Esta vía no elimina el trabajo de ingeniería (hay que construir y mantener el pipeline de importación mensual y el índice de búsqueda), pero ataca exactamente el síntoma reportado, mantiene cero cambios en la experiencia de usuario y en el sistema de colección/OAuth ya construido, y no introduce una segunda fuente de verdad de catálogo con modelos de datos distintos (Discogs vs. MusicBrainz) que luego hay que reconciliar en la UI.

---

## 5. Otras bases de datos musicales evaluadas

| Fuente | Cobertura vinilo/físico | Coste / acceso | Aptitud para Vinylmania |
|---|---|---|---|
| **Discogs (actual)** | Muy alta — pensado para coleccionismo físico, grading, matrix/runout, marketplace | Gratis no comercial; 25-60 req/min | Ya integrado; el dolor es de rate limit, no de cobertura |
| **MusicBrainz + Cover Art Archive** | Media — buen modelo de release/medium/label, sin campo destacado de matrix/runout, carátulas dependientes de la comunidad | Gratis no comercial; 1 req/s (≈ igual que Discogs autenticado); planes de pago desde 100 $/mes para uso comercial | Buen complemento/fallback de metadatos; no sustituye la cobertura de coleccionismo físico ni el rating comunitario (mucho más fino en Discogs) |
| **Volcados CC0 de Discogs** (ver §4) | Igual que Discogs, por definición | Gratis, CC0; requiere infraestructura propia de indexación | La opción de mejor relación esfuerzo/beneficio para aliviar el rate limit de búsqueda/catálogo |
| **Spotify Web API** | Nula para formato físico (streaming) | **Muy restringido desde febrero de 2026**: el modo "Development" ahora exige cuenta Premium, se limita a un solo Client ID con 5 usuarios autorizados y un subconjunto reducido de endpoints; el acceso ampliado ("Extended Access") tiene criterios más estrictos desde abril de 2025 | No apto — sin datos de vinilo/formato físico y con acceso para apps pequeñas cada vez más cerrado |
| **Apple Music API** | Nula para formato físico | Requiere cuenta de desarrollador de pago (Apple Developer Program) | No apto para el caso de uso |
| **Deezer API** | Nula para formato físico, sin barcode/catálogo/packaging | Gratis para catálogo básico, sin necesidad de auth para búsqueda | No apto — orientado a streaming, no a coleccionismo |
| **TheAudioDB** | Baja — más orientado a biografías/imágenes de artista para centros multimedia (Kodi/Emby) | **Ya no tiene tier gratuito**: acceso ahora solo mediante suscripción de pago (8 $/mes vía Patreon) | No apto — de pago y sin foco en ediciones físicas |
| **ListenBrainz** | Ninguna (no es un catálogo de metadatos) | Gratis, 1 req/s | No es alternativa de catálogo; complementa a MusicBrainz para historial de escucha/recomendaciones, no para colección física — no resuelve nada que Vinylmania necesite hoy |
| **iTunes Search API** | Muy baja — sin campos de formato físico, packaging o barcode fiable | Gratis, sin autenticación, límites informales (~20 req/min por IP, no documentado oficialmente con precisión) | No apto como fuente principal; utilidad marginal como fallback de metadatos básicos |
| **Wikidata** | Variable — datos libres (CC0) y muy ricos en relaciones, pero la cobertura de ediciones físicas concretas es muy irregular y requiere SPARQL | Gratis, sin límite estricto documentado más allá de buenas prácticas | Interesante como fuente de enriquecimiento puntual (p. ej. biografías, relaciones), no como catálogo principal de ediciones de vinilo |

Ninguna de estas alternativas iguala a Discogs en el eje que más importa para Vinylmania: datos específicos de coleccionismo físico de vinilo (condición, grading, matrix/runout) combinados con una API de colección personal por OAuth. MusicBrainz es, con diferencia, la más cercana en filosofía (datos libres, modelo de entidades sólido), pero no en cobertura de ese nicho concreto.

---

## 6. Por qué la pieza de colección personal no es sustituible sin rehacer producto

Merece un apartado propio porque es, a juicio de este informe, el argumento decisivo. Desde las specs 015 (vinculación OAuth), 016 (sincronización de biblioteca) y 048 (migración hexagonal de esa integración):

- Añadir o quitar un disco en Vinylmania añade o quita el disco en la colección real de Discogs del usuario.
- El rating de 5 estrellas, el estado del vinilo, el estado de la portada y las notas de cada copia se autoguardan campo a campo directamente contra la Collection API de Discogs.
- Los campos equivalentes ya **se eliminaron de Firestore** una vez confirmada la migración — no hay hoy una copia paralela en la base de datos propia de Vinylmania que sirva de red de seguridad.
- El propio README enumera esto como parte de la propuesta de valor: "gestiona tu biblioteca personal de vinilos, descubre lanzamientos vía Discogs".

MusicBrainz no ofrece un equivalente funcional: sus "Collections" (accesibles vía OAuth2) son agrupaciones de pertenencia — sirven para decir "este release está en mi colección de tipo X", pero no tienen campos de condición del vinilo, condición de la portada, notas de texto libre ni un grading estandarizado equiparable al de Discogs, y su comunidad de uso es mucho más pequeña y editorial (gente que cataloga metadatos, no coleccionistas gestionando el estado físico de sus copias).

Migrar de proveedor de catálogo es, gracias a la arquitectura hexagonal ya aplicada (spec 047), relativamente barato. Migrar la colección personal implicaría una de estas dos rutas, ambas mucho más costosas que "cambiar de API":

1. **Reconstruir el sistema de colección propio en Firestore** (rating, condición, notas), deshaciendo la spec 016 y renunciando a que esos datos vivan en la cuenta real de Discogs del usuario (con lo que eso significa en términos de portabilidad: hoy, si un usuario deja de usar Vinylmania, sus valoraciones y notas siguen siendo suyas en discogs.com).
2. **Adoptar el modelo de "Collections" de MusicBrainz**, perdiendo grading de condición y notas de copia tal y como existen hoy, con una migración de datos de usuarios reales no trivial.

Ninguna de las dos está justificada únicamente por un problema de rate limiting en el catálogo de búsqueda, que es un problema bastante más acotado y ya bien encaminado por las specs 029/040.

---

## 7. Recomendación y plan de acción sugerido

**No migrar de Discogs a MusicBrainz.** En su lugar:

1. **Corto plazo — validar el impacto real de lo ya construido**: las specs 029 y 040 son recientes; conviene confirmar con datos de producción (logs con `outcome`/`attempts` que ya existen) si los picos de "servicio ocupado" han bajado desde su despliegue antes de invertir en nada nuevo. Es posible que parte del problema reportado ya esté resuelto y no se haya medido todavía.
2. **Medio plazo — explorar la indexación de los volcados CC0 de Discogs (§4)** como spike técnico acotado: un prototipo que importe el volcado mensual a un índice de búsqueda propio y sirva `searchCatalog` desde ahí, dejando `getRelease`/`getArtist` (menor volumen, spec 040 §6) y toda la parte de colección/OAuth exactamente como están. Esto ataca la causa raíz identificada (picos de búsqueda) sin tocar la arquitectura de colección.
3. **Medio/largo plazo — MusicBrainz + Cover Art Archive como adaptador complementario, no sustituto**: aprovechando el `DiscogsCatalogPort` (spec 047), tiene sentido evaluar un segundo adaptador de solo lectura para (a) rellenar carátulas cuando Discogs no las tenga, y (b) enriquecer relaciones artista/obra en la ficha de detalle, con degradación silenciosa si MusicBrainz no tiene el dato (mismo patrón fail-soft que ya usáis para el rating de Discogs en búsquedas).
4. **Verificación puntual de cumplimiento**: confirmar que el TTL de caché de release/artista en `cacheAside.ts` no supera la ventana de 6 horas que exigen los términos de uso de Discogs (§3), independientemente de cualquier decisión sobre MusicBrainz.
5. **No tocar la integración OAuth de colección** (specs 015/016/048) como parte de esta iniciativa — es la pieza con mayor coste de sustitución y sin alternativa funcional equivalente hoy en el mercado de bases de datos musicales libres.

---

## Fuentes

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz API / Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [MusicBrainz API / FAQ](https://musicbrainz.org/doc/MusicBrainz_API/FAQ)
- [MusicBrainz API / Examples](https://musicbrainz.org/doc/MusicBrainz_API/Examples)
- [MusicBrainz — Release (data model)](https://musicbrainz.org/doc/Release)
- [MusicBrainz — Data License](https://musicbrainz.org/doc/About/Data_License)
- [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API)
- [MetaBrainz — Supporters / Account types (planes comerciales)](https://metabrainz.org/supporters/account-type)
- [musicbrainz-docker (espejo autoalojado oficial)](https://github.com/metabrainz/musicbrainz-docker/blob/master/README.md)
- [ListenBrainz API](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html)
- [Discogs — Developers / API rate limits y bulk data dumps](https://www.discogs.com/developers)
- [Discogs — API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [Internet Archive — "Discogs, thank you" (contexto sobre los volcados CC0 de Discogs)](https://blog.archive.org/2020/12/06/discogs-thank-you-a-commercial-community-site-with-bulk-data-access/)
- [Spotify for Developers — Update on Developer Access and Platform Security (feb. 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [TheAudioDB — API Application (condiciones de acceso actuales)](https://www.theaudiodb.com/api_apply.php)
- Repositorio de Vinylmania (`specs/002`, `011`, `015`, `016`, `017`, `029`, `040`, `047`, `048`) — contexto interno de arquitectura y límites ya conocidos del proyecto.
