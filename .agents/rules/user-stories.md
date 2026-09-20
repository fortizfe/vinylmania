# Directrices y Reglas para la Redacción de Historias de Usuario (Vinylmania)

Estas reglas son de obligado cumplimiento para cualquier agente (`product-owner-agent`, `architect-agent` o el agente principal) al descubrir, redactar, refinar o sincronizar Historias de Usuario (HUs) en el proyecto **Vinylmania**.

---

## 1. Contexto del Proyecto y Espacio Jira (`VINYLMANIA`)

1. **Clave de Espacio / Proyecto**: `VINYLMANIA`.
   - Toda incidencia, épica o historia creada o consultada en Jira mediante el MCP server debe pertenecer al espacio/proyecto `VINYLMANIA` (ej. tickets `VINYLMANIA-101`, `VINYLMANIA-102`).
2. **Ubicación de las HUs en el Repositorio**:
   - Cada historia refinada debe guardarse como un archivo Markdown autónomo en `.hu/<kebab-case-feature-name>.md` (ej. `.hu/library-redesign-ux-a11y-sorting.md`).
3. **Trazabilidad Bidireccional**:
   - El documento en `.hu/` debe referenciar la clave o épica correspondiente en Jira (`VINYLMANIA-XXX`).
   - El ticket en Jira debe incluir el enlace al archivo `.hu/<feature>.md` y a la carpeta técnica `specs/<id>-<feature>/` si ya fue especificada.

---

## 2. Conformidad Mandatoria con la Constitución (`.specify/memory/constitution.md`)

Toda Historia de Usuario debe alinearse estrictamente con los principios rectores de Vinylmania:

- **Principio I: Test-First (No negociable)**:
  - Todo criterio de aceptación debe ser unívoco, determinista y testeable de forma automatizada (unitario, contrato, integración o e2e Playwright) **antes** de que se escriba el código de implementación.
- **Principio II: Discogs Integration-First & Modularity**:
  - Discogs es la fuente única de verdad para metadatos del catálogo (artistas, sellos, formatos, carátulas). Las HUs no deben proponer almacenar catálogo duplicado en Firestore. Deben considerar rate limits, políticas de reintento y caché normalizada.
- **Principio III: Simplicidad, YAGNI y KISS**:
  - Cortar sin piedad requisitos especulativos. Toda HU debe contener una sección explícita de **Fuera de Alcance (Out of Scope)** justificando qué no se construye en la iteración para mantener el foco en valor real.
- **Principio VIII: Arquitectura Hexagonal (Backend)**:
  - Los requisitos que impliquen backend deben contemplar la separación clara entre reglas de negocio puras (Dominio), casos de uso (Aplicación), interfaces abstractas (Puertos) y drivers/tecnologías externas (Adaptadores).
- **Principio IX: Frontend Backend-Only**:
  - Ninguna HU puede requerir que el frontend en React llame directamente por JavaScript a APIs externas (Discogs, Firebase SDK cliente, RSS). Todo el tráfico debe orquestarse a través del backend de Vinylmania.
- **Principio X: Accesibilidad — WCAG 2.1 AA (No negociable)**:
  - Мерка obligatoria de merge. Cada historia con interfaz de usuario debe exigir:
    * Semántica HTML nativa antes que ARIA superficial.
    * Navegabilidad 100% por teclado sin trampas de foco y con foco visible de alto contraste (`focus-visible:ring-2 ring-primary`).
    * Ratios de contraste WCAG 1.4.3: mínimo **4.5:1** para texto normal y **3:1** para elementos de UI/iconos.
    * Anuncios accesibles (`aria-live="polite"`) para estados asíncronos y filtros/ordenación.
    * Soporte para `prefers-reduced-motion: reduce` (sustituir animaciones por atenuaciones o estados estáticos).
    * Ninguna transmisión de estado o error basada únicamente en color.
    * **Objetivo táctil mínimo de 44×44 CSS px** (`min-h-11 min-w-11` en Tailwind) para todos los controles interactivos en móvil (WCAG 2.5.5 / Apple HIG).
- **Principio XI: Apple Design Principles Compliance (HIG)**:
  - Movimiento físico e interrumpible basado en resortes (*springs* críticos `damping: 1.0`, `response: 0.3-0.4s`) usando las skills `apple-design`, `emil-design-eng` y `animate`.
  - Materiales translúcidos con profundidad (`backdrop-filter: blur(20px)` en barras/chrome).
  - Feedback instantáneo al tacto (`active:scale-[0.97]` en pointer-down).
  - Disciplina tipográfica con tipografía display Anton solo para cabeceras principales, y fuente sans/sistema legible para datos.
- **Doble Layout Responsivo**:
  - Requisito constitucional: Toda pantalla debe tener dos disposiciones diseñadas a propósito:
    1. **Mobile-First**: Operable con el pulgar (*thumb-zone*), compacto, uso de hojas inferiores (*bottom sheets/drawers*) y sin scroll horizontal.
    2. **Desktop**: Amplio, multi-columna, aprovechamiento del ancho horizontal (`xl:max-w-7xl`).

---

## 3. Adopción Estricta de BDD (Behavior-Driven Development)

Cada funcionalidad debe descomponerse en escenarios formulados bajo la sintaxis **Given-When-Then**:

```gherkin
Given [Contexto inicial, precondición del sistema o datos cargados]
When  [Acción concreta del usuario, evento de navegación o cambio de estado]
Then  [Resultado observable, cambio en la UI o postcondición verificable]
```

### Escenarios Obligatorios por cada Historia:
1. **Happy Path (Flujo principal)**: El comportamiento esperado cuando todo transcurre con éxito.
2. **Edge Cases y Resiliencia**:
   - Estados vacíos (colección sin registros o sin coincidencias tras filtrar).
   - Datos ausentes o parciales de Discogs (sin país, sin sello, múltiples artistas).
   - Errores de red o rate limiting con botón de reintento accesible.
3. **Escenarios de Accesibilidad (A11y BDD)**:
   - Verificación de foco con teclado (`Tab`, `Shift+Tab`, `Enter`, `Space`, flechas).
   - Anuncio para lectores de pantalla.
   - Respeto a `prefers-reduced-motion`.
4. **Escenarios de Doble Layout (Responsive BDD)**:
   - Verificación de comportamiento y dimensiones en móvil (`< 640px`) con touch targets $\ge 44\times 44\text{ px}$.
   - Verificación de comportamiento en escritorio (`>= 1024px`).

---

## 4. Estructura Plantilla de un Documento HU (`.hu/<feature>.md`)

Todo documento de HU en `.hu/` debe contener las siguientes secciones:

```markdown
# HU <Título descriptivo del incremento>

## 1. Definición y Contexto
- Contexto y dolor actual del coleccionista.
- Propuesta de valor de la nueva funcionalidad.
- Clave de Jira asociada: VINYLMANIA-XXX (o Espacio VINYLMANIA).
- Principios de la Constitución involucrados (I, III, X, XI, etc.).

## 2. Historias de Usuario Detalladas (P1 / P2)
### Historia N (Prioridad): <Nombre de la historia>
> **Como** [rol del usuario],
> **Quiero** [acción o capacidad],
> **Para** [beneficio o valor obtenido].

#### Criterios de Aceptación (BDD):
1. **Given** ... **When** ... **Then** ...
2. **Given** ... **When** ... **Then** ...
...

## 3. Propuestas / Criterios de Experiencia de Usuario (Apple HIG)
- Enfoque visual, materiales translúcidos, interacción táctil y física de resortes.
- Propuestas alternativas cuando proceda (Propuesta A/B/C).

## 4. Matriz de Cumplimiento WCAG 2.1 AA
- Tabla con criterios (1.4.3, 2.1.1, 2.4.7, 2.5.5, 4.1.2, 2.3.3), solución técnica y verificación.

## 5. Criterios de Éxito Cuantitativos
- CLS = 0, latencias de respuesta, 0 violaciones en tests de accesibilidad Axe-core.

## 6. Supuestos y Decisiones
- Dónde viajan los estados (URL params, localStorage, Firestore mirror).

## 7. Fuera de Alcance (Out of Scope / YAGNI)
- Lista taxativa de lo que NO se desarrollará en este incremento.

## 8. Directrices de Handoff para architect-agent
- Puntos clave para las fases: speckit-specify, speckit-clarify, speckit-plan y speckit-tasks.
```

---

## 5. Protocolo de Sincronización con Jira (`VINYLMANIA`)

Al convertir o sincronizar una HU con Jira mediante el MCP server (`jira_create_issue` / `jira_edit_issue`):

1. **Proyecto / Espacio**: Siempre `VINYLMANIA`.
2. **Tipo de Incidencia**:
   - `Epic` para el documento general de la HU.
   - `Story` para cada sub-historia (P1, P2...).
   - `Task` o `Sub-task` para tareas técnicas derivadas de `tasks.md`.
3. **Resumen (Summary)**: Conciso, con prefijo de área entre corchetes:
   - Ej.: `[Library] [VINYLMANIA] Rediseño de vista My Library con ordenación y scroll infinito`
   - Ej.: `[Library] [VINYLMANIA] Soporte de ordenación multicriterio por Artista, Álbum y Fecha`
4. **Descripción (Description)**:
   - Formateada en Markdown limpio (el servidor MCP la convertirá automáticamente a ADF).
   - Debe incluir:
     * Resumen de la necesidad.
     * Criterios de Aceptación en formato Given-When-Then.
     * Requisitos específicos de WCAG 2.1 AA y touch targets de 44px.
     * Referencia al archivo `.hu/<feature>.md` y a la rama de Git correspondiente.
5. **Story Points** *(obligatorio — campo `customfield_10016`)*:
   - Asignar mediante `jira_edit_issue` inmediatamente tras la creación del issue.
   - Usar la escala de Fibonacci: `1, 2, 3, 5, 8, 13, 21`.
   - Criterios orientativos de estimación:
     | Puntos | Complejidad | Indicadores |
     |--------|-------------|-------------|
     | 1–2 | Trivial | Cambio de texto, ajuste de estilo puntual |
     | 3 | Pequeña | Componente simple, sin lógica de negocio |
     | 5 | Media | Componente con estado, interacción básica, A11y incluida |
     | 8 | Alta | Componente complejo, responsive + A11y + animaciones HIG |
     | 13 | Épica / muy alta | Rediseño de área completa, múltiples componentes implicados |
     | 21 | Candidata a partir | Demasiado grande, debe descomponerse en stories más pequeñas |
   - Las `Epic` reciben la suma orientativa de sus stories hijas o una estimación global independiente.
6. **Labels** *(obligatorio — campo `labels`)*:
   - Asignar mediante `jira_edit_issue` inmediatamente tras la creación del issue.
   - Usar **solo** etiquetas canónicas del proyecto. Seleccionar las que apliquen:
     | Etiqueta | Cuándo aplicar |
     |----------|----------------|
     | `vinylmania` | **Siempre** — en todos los issues del proyecto |
     | `ux-redesign` | Issues que implican rediseño de interfaz o experiencia de usuario |
     | `wcag-aa` | Issues con requisitos de accesibilidad WCAG 2.1 AA |
     | `bdd` | Issues con criterios de aceptación en formato Given-When-Then |
     | `frontend` | Issues que generan cambios en componentes React o estilos |
     | `backend` | Issues que generan cambios en endpoints, servicios o dominio |
   - Una `Epic` recibe todas las etiquetas que apliquen a cualquiera de sus stories hijas.
   - Una `Story` de solo UI (sin nuevo endpoint) **no** debe llevar `backend`.

