# Data Model: Definir y ratificar la arquitectura Hexagonal como Core Principle

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Esta historia no introduce ni modifica ninguna entidad de datos del dominio de
negocio de Vinylmania (no toca Firestore, Discogs, ni ningún esquema persistido). Las
"entidades" relevantes aquí son los conceptos normativos que el nuevo Core Principle
define y que gobiernan cómo se organiza el código de `backend/src` en historias
futuras. Se documentan a continuación para que la redacción del principio (y su
verificación) sea inequívoca.

## Entidad: Capa (Layer)

Representa una de las cuatro categorías obligatorias en las que se organiza todo
código de `backend/src`.

| Valor | Responsabilidad | Puede importar directamente | NO puede importar directamente |
|---|---|---|---|
| **Dominio** | Reglas de negocio puras, entidades, errores tipados de dominio | Otro código de dominio, utilidades transversales puras (logger, `mapWithConcurrency`) | Puertos, adaptadores, SDKs de infraestructura (`firebase-admin`, `axios`, `ioredis`, `rss-parser`), Express |
| **Aplicación** | Casos de uso que orquestan dominio + puertos | Dominio, puertos (interfaces), utilidades transversales | Adaptadores concretos, SDKs de infraestructura, Express |
| **Puerto (Port)** | Interfaz que declara un contrato de infraestructura sin implementarlo | Tipos de dominio (para las firmas de sus métodos) | Cualquier SDK de infraestructura concreto |
| **Adaptador (Adapter)** | Implementación concreta de un puerto, o traducción de un protocolo externo (HTTP, Firestore, Discogs) hacia/desde la aplicación | El puerto que implementa, SDKs de infraestructura, dominio (para mapear errores) | — (es la única capa autorizada a importar SDKs de infraestructura) |

**Regla de dependencia** (aplica a las cuatro filas anteriores): las flechas de
dependencia apuntan siempre hacia dominio; dominio y aplicación NUNCA dependen de un
adaptador concreto, solo de puertos.

## Entidad: Adaptador Driving vs. Driven

Sub-clasificación de la capa Adaptador, relevante para las rutas Express.

| Tipo | Ejemplo verificado hoy | Responsabilidad |
|---|---|---|
| **Driving** (entrada) | Rutas Express (`routes/library.ts`, `routes/discogs.ts`, ...) | Traducir petición HTTP → invocación de caso de uso de aplicación, y respuesta de caso de uso → respuesta HTTP (incluyendo mapeo de errores de dominio a códigos HTTP). NO debe contener orquestación de negocio. |
| **Driven** (salida) | Adaptador Firestore, adaptador Discogs (axios), adaptador Redis, adaptador RSS | Implementar un puerto invocando un SDK de infraestructura concreto. |

## Entidad: Módulo Transversal (Shared Kernel implícito)

Código sin dependencias de infraestructura que no pertenece a ninguna capa concreta y
es consumible desde cualquiera de ellas sin pasar por un puerto.

| Módulo | Por qué es transversal |
|---|---|
| `config/logger.ts` | No importa ningún SDK externo (solo `console`); ya cumple la regla de dependencia sin necesidad de excepción declarada. |
| `shared/concurrency.ts` (`mapWithConcurrency`) | Utilidad algorítmica pura sin dependencias externas; no es lógica de negocio, así que no se fuerza dentro de dominio. |

## Entidad: Patrón de Error de Dominio (ya existente, a generalizar)

Jerarquía de errores tipados que el dominio lanza sin conocer HTTP; solo las rutas
(capa adaptador driving) los traducen a códigos de estado.

| Elemento | Rol |
|---|---|
| `DiscogsError` (abstracta, `code`: `not_found`/`rate_limited`/`unavailable`/`validation_error`/`auth_failed`) | Jerarquía base de error de dominio, sin conocimiento de HTTP |
| `DiscogsNotLinkedError`, `FieldNotEditableError`, `DiscogsOauthFlowError` | Errores de dominio específicos, definidos junto a la lógica que los lanza |
| `respondCollectionError` (`routes/library.ts`), `handleFailure` (`routes/discogsOauth.ts`) | Funciones de traducción error de dominio → código HTTP; solo existen en la capa de adaptador driving (rutas) |

Este patrón no cambia de comportamiento en esta historia; el nuevo principio lo cita
como el mecanismo de referencia a preservar y generalizar en las migraciones de
dominio futuras (Historias 2-6 de la HU origen).

## Entidad: Amendment de Constitution (Sync Impact Report)

Metadato de gobernanza que documenta cada bump de versión del propio
`constitution.md`.

| Campo | Valor para esta historia |
|---|---|
| `Version change` | 2.4.0 → 2.5.0 |
| `Modified principles` | Ninguno modificado; I-VII sin cambios |
| `Added sections` | Nuevo Core Principle VIII (Hexagonal Architecture, Ports & Adapters) |
| `Templates requiring updates` | `.specify/templates/plan-template.md`, `.specify/templates/spec-template.md` (comprobar necesidad de gate arquitectónico) |
| `Last Amended` | Fecha real de la amendment (no una fecha futura ni la de creación del spec) |
