# Altoque: correcciones funcionales y auditoría final

Fecha: 6 de octubre de 2026. Repositorio inspeccionado: `/Users/juankingss/Altoque`.
Base de esta ronda: `master`, commit `ca225f35d6fcd7c09823fa5fa64d9d77a20a6e18`.

## Resultado y alcance

Las cinco validaciones solicitadas pasan en el estado final del código. Se corrigieron los flujos profesionales, direcciones, seguridad de cuenta, registro/verificación/recuperación, bootstrap administrativo y varios problemas de contratos API, concurrencia y errores de interfaz. Better Auth continúa siendo la fuente de verdad; `requireEmailVerification` permanece habilitado.

Esto permite revisar un candidato a próximo Preview. No demuestra todavía preparación para un lanzamiento público: faltan pruebas reales de correo y almacenamiento, resolver advisories, cerrar funciones incompletas y verificar operación, dominio y configuración del despliegue.

No se hizo commit, staging, push, deploy, seed remoto, migración remota ni cambio de DNS. No se conectó esta ronda a Neon Preview ni Production. No se leyó el contenido de `.env` ni se imprimieron valores de credenciales. Las dos stashes existentes se conservaron. No se modificaron dependencias, lockfile, esquema Prisma, migraciones ni `vercel.json`.

Se revisaron fuentes, contratos, SQL, pruebas, configuración y dependencias. La comprobación visual local usó respuestas sintéticas controladas, sin conexiones reales ni envíos. La integración HTTP/Better Auth/PostgreSQL se comprobó por separado contra la base temporal del runner. No se hizo un pentest externo, un E2E remoto completo, una prueba de carga, una auditoría legal ni una evaluación completa con lector de pantalla.

## Correcciones verificadas

| Problema y clasificación original | Causa | Solución y evidencia final |
| --- | --- | --- |
| P2, bug: error profesional con cero solicitudes | Consultas antes de contar con perfil/aprobación y contratos de respuesta mal interpretados | `src/features/provider/ProApp.tsx:71`, `ProviderPanelStates.tsx:40` y `src/lib/api.ts:279`: gating del perfil, estados independientes y `200 []` como éxito vacío; errores reales conservan mensaje/reintento. Tests provider-panel, provider-api y disponibilidad. El usuario también confirmó manualmente el comportamiento correcto. |
| P2, bug: disponibilidad | Frontend enviaba POST al endpoint PATCH y mantenía estado local independiente | `src/lib/api.ts:268` usa PATCH y valida el booleano del servidor; `ProApp.tsx:143` adopta la respuesta persistida, evita envíos dobles y recarga el perfil. La integración confirma Online/Offline con cero solicitudes y lectura posterior. El usuario confirmó el funcionamiento. |
| P2, funcionalidad ausente: Mis direcciones | Existía modelo `address`, pero menú/pantalla/API no completaban CRUD | `server/routes/addresses.ts`, `zones.ts`, `src/lib/profile-api.ts`, `src/features/client/Addresses.tsx`: listar/agregar/editar/eliminar, validación de campos/zona, estados y propiedad en el WHERE. Solicitudes rechazan dirección ajena o de otra zona. No requiere migración. 11 tests de direcciones y pruebas de ownership adicionales. |
| P2, funcionalidad ausente: Seguridad y privacidad | Menú sin flujo útil | `src/features/client/Security.tsx`: contraseña actual/nueva/confirmación, API oficial Better Auth, opción de revocar otras sesiones y confirmación para cierre separado. No se agregaron controles simulados. 4 tests de integración y regresiones de UI/contratos. |
| P1/P2, bugs/riesgos: correo y logs de autenticación | No había transporte real; Better Auth puede capturar errores del callback y responder sin reflejar el rechazo; logs de diagnóstico podían exponer datos | `server/auth/email.ts`, `email-hooks.ts`, `logger.ts`: Resend real por fetch, espera de aceptación con ID, timeout de 8 segundos, errores seguros; hooks por request convierten el fallo en 503. HTML profesional, botón **Verificar mi correo**, texto alternativo y expiración de una hora. No se registran enlaces/tokens/cuerpos/destinatarios. Regresiones de transporte, hooks y Better Auth real con transporte interceptado. La entrega externa no se ha probado. |
| P2, funcionalidades incompletas: recuperación y reenvío | Pantallas/feedback no cerraban el flujo de Better Auth | `PasswordRecovery.tsx`, `EmailVerification.tsx`, `Landing.tsx`, `src/lib/api.ts`: solicitud/reset real, confirmación de contraseña, token retirado de la URL, distinción reset/verificación, errores reales y reenvío con mutex/cooldown. Se conserva la respuesta genérica apropiada para no revelar si una cuenta existe. Tests de reset verifican contraseña anterior/nueva y revocación. |
| P2, riesgo: abuso de auth/correo | Límites insuficientes y consumo no atómico | `server/auth/rate-limit.ts`, `server/lib/ratelimit.ts`: contadores durables con una operación SQL atómica, sujetos HMAC de email/IP y header de IP de Vercel; login 10/5 min, registro 5/h, reset/reenvío 3/15 min. Pruebas de concurrencia y ventanas. No equivale a una defensa completa frente a ataques distribuidos. |
| P1/P2, riesgo: configuración del administrador | Seed acoplado al catálogo, destino insuficientemente restringido y provisión no totalmente reproducible | `server/database/seeds/admin.ts`, `bootstrap-admin.ts`, `safety.ts`: cuenta local oficial Better Auth, hash oficial, rol admin, email verificado y super_admin en una creación atómica; repetición preserva ID/contraseña. Rechaza promociones silenciosas, cuentas incompletas, suspendidas o incompatibles. Guardias antes de conectar y comprobación de identidad READ ONLY antes de escribir. 12 tests offline de bootstrap, 5 de integración y 15 de seguridad administrativa, además del seed anterior. Nunca ejecutado contra Neon. |
| P1/P2, riesgos: permisos administrativos | Operaciones genéricas podían afectar admins o perder rol al aprobar un perfil; faltaba aplicar frescura de sesión prevista | `server/routes/admin.ts`, `server/middleware/auth.ts`: protección de actor/admins, preservación de rol admin, CAS para aprobación/rechazo y cambios + auditoría en transacción; permisos `admin_profile` y sesión reciente en operaciones sensibles. Se verifica rechazo de clientes y roles insuficientes. |
| P2, bugs/riesgos: solicitudes y concurrencia | DTOs de demo e IDs de catálogo incorrectos; botones apuntaban a rutas equivocadas; transiciones leían y luego escribían sin condición | `RequestWizard.tsx`, `Requests.tsx`, `server/requests/transitions.ts`, `claimRequest.ts`, rutas requests/providers/disputes: catálogo real, estados completos, dirección/foto propia, zona/categoría compatibles, claim/status correctos y transición condicional con historial/notificaciones atómicas. Conflictos responden 409; otros errores de BD no se convierten indiscriminadamente en colisiones. No se cambió la política de que Online gobierna inbox, no la autorización del claim. |
| P2, bug/riesgo: disputas | Consulta del frontend miraba solo la primera página; detalle administrativo no aplicaba todos los permisos y carreras podían duplicar efectos | Filtro `request_id` con scope del usuario, frontend consulta solicitud exacta, error visible/reintento que impide duplicar por incertidumbre; RBAC de detalle, constraint de disputa abierta, CAS y transacciones. Prueba con 23 disputas confirma que una entrada fuera de la primera página se encuentra sin exponer disputas ajenas. |
| P2, bug: uploads HTTP | `FormData` se serializaba como JSON; SDK de archivos invocaba función inexistente | `src/lib/http.ts` respeta multipart/boundary del navegador; `server/lib/files.ts` usa token privado para PUT y falla explícitamente si se pide lectura aún no implementada. Tests de transporte y FileStore. La lectura privada sigue pendiente. |
| P2, bugs de estados/navegación | Error de sesión se trataba como logout; logout fallido limpiaba UI; pantallas admin/pro mostraban vacío o cero cuando fallaba API; rutas desconocidas redirigían sin explicación | `src/App.tsx`, `session-actions.ts`, `AppStates.tsx`, `AdminDataState.tsx`, `use-api-polling.ts`: sesión ausente exitosa se distingue de error, retry visible, logout solo limpia tras éxito, error boundary/404, carga/error/vacío separados y respuestas de efectos viejos descartadas. Se retiraron números/ratings/actividad simulados de los flujos autenticados revisados. Tests SSR/contratos y comprobación de navegador local. |
| P2, privacidad: caché/logs | Respuestas API privadas y diagnósticos podían quedar en caché o incluir datos de errores | `server/middleware/security.ts` aplica no-store a API también en GET/error; logger/audit redactan estructuras, arrays, URL y claves sensibles; rutas de reset se redactan. Diagnóstico no se habilita en Vercel Production y Prisma solo registra operación/duración. Tests de headers y redacción. |

## Revisión funcional por área

| Área | Comprobado | Límite o pendiente |
| --- | --- | --- |
| Registro/login/logout | Better Auth real en base aislada; cuenta no verificada no obtiene sesión; campos role/status no son editables desde signup; login y logout con errores honestos | Entrega real del correo, alias/dominio y cookies del deployment aún no probados |
| Verificación/reset | Generación/consumo oficial, callback, expiración, usuario verificado, auto-login configurado, reset y revocación de sesiones | Resend fue interceptado en tests; aceptación de API no garantiza entrega en inbox |
| Sesiones | Bootstrap, ausencia vs error, logout, contraseña y otras sesiones | Gestión completa de dispositivos, 2FA y política de revocación de cuentas suspendidas antes de emitir sesión no implementadas |
| Cliente/pro/admin | APIs y roles reales; bootstrap seguro; `/admin` protegido | Edición integral de perfil y onboarding documental profesional incompletos |
| Direcciones | CRUD persistente, zona y propiedad; selección al crear solicitud | Ubicación inmutable de un servicio activo y política de contacto/dirección todavía requieren definición |
| Solicitudes | Creación, búsqueda por categoría/zona, claim único, estados on_the_way/arrived/in_progress/completed/confirmed/reviewed, cancelación autorizada | Expiración automática y negociación/cotización comercial no cerradas |
| Online/Offline | Persistencia independiente de inbox, gating, casos vacíos y fallo API | Switch desalineado: P3 confirmado por el usuario; NO corregido por instrucción |
| Reviews/disputas | Rangos, ownership, estados válidos, duplicados/carreras, detalle y resolución con permisos | Ranking global paginado incorrecto y entrega/visualización de notificaciones pendiente |
| Archivos | Multipart, tamaño/MIME/magic bytes, propiedad y almacenamiento privado separados | Sin lectura privada autorizada completa ni prueba real de Blob; limpieza compensatoria pendiente |
| Administración | Lectura con estados útiles, permisos, aprobación/rechazo y auditoría | Pantallas no permiten navegar todas las páginas; falta administración dedicada de admins |
| Navegación/móvil/a11y | 404 real, links perfil/seguridad, carga/error/vacío, 390×844 sin overflow horizontal en vistas muestreadas | No todos los dispositivos/vistas/modal focus/lector de pantalla; pasada visual separada pendiente |
| Pagos | Código reconoce explícitamente indisponibilidad | No hay cobros, liberaciones o reembolsos de un proveedor real |

## Hallazgos abiertos: severidad, evidencia y decisión

Tipos: **bug confirmado** = contradicción demostrable del comportamiento; **riesgo** = condición o superficie observada sin explotación demostrada; **mejora recomendada** = calidad/operación; **no implementada** = función que aún no existe. P0 crítico, P1 alto, P2 medio, P3 bajo.

No se identificó un P0 confirmado. Eso no equivale a garantía de ausencia de vulnerabilidades. Los hallazgos abiertos siguientes NO se consideran resueltos por pasar tests.

| ID | Severidad / tipo | Archivo y evidencia concreta | Impacto / siguiente acción |
| --- | --- | --- | --- |
| A01 | P1 · riesgo | `package-lock.json`, `package.json:27,34`; npm audit devuelve 2 entradas critical de tinypool/vitest | Gadgets de ejecución de código requieren contaminación de prototipo aguas arriba en tooling. No se encontró uso HTTP de tinypool, pero la cadena de test/build necesita actualización compatible y verificación separada. No se actualizó en esta ronda. |
| A02 | P2 · riesgo | `package-lock.json`; audit: deepmerge-ts/Prisma y source-map-js HIGH, Hono/router/uuid MODERATE | Ver tabla de advisories. Se necesita plan de remediación por árbol/compatibilidad, sin seguir automáticamente el downgrade/major sugerido por npm. |
| A03 | P2 · bug confirmado | `server/routes/providers-public.ts:60,135,160,231` toma página por created_at antes de ordenar por rating/reviews | El orden es correcto solo dentro de la página, no del catálogo global. Ordenar/agregar en DB antes de paginar. No se modificó el algoritmo en esta ronda. |
| A04 | P2 · riesgo de performance | `server/routes/providers-public.ts:91,195,304` lee todos los ratings para calcular avg/count | Costo proporcional a reviews por profesional; detalle realiza consulta adicional. Usar aggregate y medir índices/planes con volumen. No hubo prueba de carga/cold start real. |
| A05 | P2 · bug confirmado / contenido de demo | `src/features/landing/Landing.tsx:42,102,150,235,479`; `src/lib/state.ts` PROS/CATS | Landing presenta 243 disponibles, +12,400 servicios y tarjetas “EN VIVO” con datos locales. Flujos autenticados se conectaron a API, pero la landing sigue usando demo. Sustituir o identificar claramente antes de publicar. |
| A06 | P2 · no implementada | `server/lib/files.ts:105` devuelve 503; no handler de lectura autorizada completo para fotos privadas | Se puede guardar foto, pero no se completó su consulta por las partes autorizadas. Implementar proxy privado y pruebas de permisos antes de prometer fotos/documentos funcionales. |
| A07 | P2 · riesgo de integridad | `server/routes/uploads.ts:53,56` sube Blob y luego inserta `file` sin compensación | Fallo de DB después del PUT puede dejar un blob huérfano. Definir eliminación/retención y compensación; requiere revisión de almacenamiento externo. |
| A08 | P2 · riesgo de esquema | `server/database/schema.prisma:408,541` request_photo guarda blob_key sin FK a file; file.request_id/provider_id son strings, visibility/purpose también | DB no impone esas relaciones/dominios. Ownership actual se comprueba en API. Revisar diseño antes de una futura migración autorizada; ninguna creada ahora. |
| A09 | P2 · riesgo de esquema | `server/database/schema.prisma:165,182` account solo tiene índice por userId | No hay unique compuesto de identidad/credencial local. No se observó duplicación; bootstrap es idempotente y prueba carreras. Evaluar unicidad compatible con Better Auth antes de agregar constraint. |
| A10 | P2 · no implementada | Estado expired en esquema, sin tarea/handler automático; `server/routes/providers.ts:331` y `disputes.ts:350` crean notification, sin flujo completo de entrega/lectura | Solicitudes pueden permanecer searching indefinidamente; eventos en DB no implican avisos visibles. Definir expiración, notificación, cotización y reintentos antes de lanzamiento. |
| A11 | P2 · no implementada | `src/lib/payments.ts:76,84` todas las operaciones lanzan PaymentNotAvailableError | Estados held/refunded internos no representan movimientos de dinero reales. Elegir modelo operativo/pagos en una decisión aparte; no se integró un proveedor automáticamente. |
| A12 | P2 · no implementada | `src/features/provider/ProApp.tsx:531`, `ProviderProfileSetup.tsx`, modelo provider_document: perfil con servicios/zonas reales en modo lectura; portfolio, horario, documentos y revisión de identidad sin recorrido completo | Definir alta/verificación y capacidad real de operar; un admin puede aprobar pero no sustituye una política de verificación. |
| A13 | P2 · riesgo de entorno | `server/config/env.ts:94` APP_URL tiene prioridad sobre VERCEL_URL | APP_URL heredada de Production en Preview podría generar enlaces/orígenes hacia Production. No se inspeccionaron variables remotas. Revisar manualmente scopes/canonical origin antes del próximo Preview. |
| A14 | P2 · riesgo de autenticación entre hosts | `auth.ts:48,108,134`; canonical origin puede diferir del alias de retorno | Verificación puede completar en un host y cookie quedar solo en ese host. Cuenta verificada debe poder usar login normal en el alias. Comprobar flujo real de alias, cookies y HTTPS sin ampliar dominio de cookie innecesariamente. |
| A15 | P2 · riesgo / hardening | `server/middleware/auth.ts:39` impide API de negocio si status no activo; BA login no aplica la misma política antes de emitir sesión | Cuenta suspendida puede recibir una sesión que luego es rechazada por la API. No se probó bypass de permisos. Centralizar política de acceso y revocación con Better Auth. |
| A16 | P2 · riesgo de operación | No workflow CI en el repo; `vercel.json:3` build genera Prisma y Vite, no ejecuta estas suites | Las validaciones son manuales; build verde no bloquea un deploy con regresiones. Agregar gates CI y política de promoción/rollback separados. No se cambió el pipeline ahora. |
| A17 | P2 · mejora operativa | Logs/auditoría locales existen, sin prueba de alertas, restore, delivery events, retención y runbooks | Faltan prueba de recuperación, monitorización y respuesta a fallos. No se verificaron backup/SSL/Deployment Protection ni env remotos de Vercel. |
| A18 | P2 · bug confirmado / función ausente | `src/features/admin/AdminHome.tsx:141,196,261,550` carga listas sin navegación por meta; backend paginado | Administración ve la primera página y no tiene UI para el resto. Error/vacío se corrigieron; paginación sigue pendiente. |
| A19 | P2 · riesgo funcional | `server/database/schema.prisma:373,374`: dirección opcional y FK SetNull; CRUD permite modificar/eliminar dirección propia | Servicio puede carecer de detalle de ubicación o perder/cambiar referencia durante su vida. Definir snapshot de dirección/contacto y reglas para servicios activos; no cambiar esquema sin aprobación. |
| A20 | P3 · bug confirmado | `server/routes/requests.ts:25,310`, `providers.ts:53`, `disputes.ts:64` usan c.req.json directamente | JSON sintácticamente inválido puede acabar como 500 genérico en vez de 400. Añadir parser común/regresiones en ronda posterior. Validación semántica de cuerpos válidos sí está cubierta. |
| A21 | P3 · riesgo de robustez | `api/index.ts:59,64,102` timeout por race sin cancelar lectura, escritura sin atender toda la presión de salida | Revisar cancelación/backpressure y prueba con cliente lento. No se demostró exploit remoto ni consumo bajo carga. |
| A22 | P3 · mejora de privacidad | DTOs privados/admin incluyen relaciones amplias en `server/routes/requests.ts`, `admin.ts` | Reducir a select explícitos y contratos compartidos. No se encontraron credenciales Better Auth en DTOs de negocio revisados. Auditoría de minimización/retención completa pendiente. |
| A23 | P3 · mejora de mantenibilidad | `src/lib/api.ts:128,157` conserva ramas mock/legacy; state y documentación F0/F1 contienen tipos/demos antiguos | Centralizar DTOs, retirar módulos muertos y comentarios de diagnóstico temporal. No se eliminó código ajeno indiscriminadamente. |
| A24 | P3 · mejora de accesibilidad | `src/features/landing/Landing.tsx` inputs de auth, `src/components/kit.tsx` Sheet y modales de disputas | Revisar labels/autocomplete, foco/Escape y focus trap; labels y alerts nuevos no sustituyen un audit completo. Sin pruebas axe/lector de pantalla. |
| A25 | P3 · riesgo operativo | `server/auth/rate-limit.ts`, tabla rate_limit: sin limpieza por antigüedad | Rotación de IP/email puede acumular sujetos HMAC y filas. Definir retención/purga no destructiva para datos vigentes; límites distribuidos/IP deben verificarse en Vercel. |
| A26 | P3 · mejora de entorno local | Vite sin proxy API por defecto y API sin flujo CORS local completo para otro puerto | La comprobación visual usó fixtures, no valida por sí sola el arranque completo Vite + Hono + DB. Preparar un runner de desarrollo/E2E aislado y documentado. |
| A27 | P3 · bug estético confirmado por usuario | `src/features/provider/ProviderPanelStates.tsx:13,28,30`: switch de “¿Estás disponible?” desalineado | **Pendiente por instrucción explícita. No corregido ahora.** Incluir en pasada separada de pulido visual/UI/UX de toda la app. Online/Offline y vacío fueron confirmados correctos por el usuario. |
| A28 | P3 · mejora funcional | `src/features/client/RequestWizard.tsx`: enlace con profesional inexistente bloquea preferencia inicial; reintento puede reiniciar selección | Definir fallback a solicitud genérica conservando selección válida. No impide el flujo normal con catálogo real. |

## Arquitectura, seguridad y configuración

Frontend React/Vite con HashRouter y cliente HTTP propio; Hono por rutas de negocio; Prisma/PostgreSQL para persistencia; Better Auth para identidad, sesiones, credenciales y verificación. Vercel enruta `/api/v1/*` a `api/index.ts`; resto a SPA. La separación es comprensible y no se introdujo otra fuente de identidad.

Puntos fuertes comprobados: rol/status no aceptados desde registro, gates del backend, ownership de direcciones/solicitudes/fotos/disputas, índices parciales de concurrencia, checks de ratings, CSRF/origen, cookies seguras en producción/Preview bajo NODE_ENV=production, no-store de API, redacción de logs, seed con destino restringido y tests aislados con limpieza.

Deuda: DTOs con any y tipos duplicados, polling en varias áreas, grandes pantallas monolíticas, colección de demo aún en landing, toolchains declaradas en dependencies y ausencia de CI/telemetría operacional verificada. El build final contiene 62 módulos y 347.51 kB JS (98.17 kB gzip); no hay mediciones de Web Vitals, red móvil, latencia Neon/Resend, concurrencia o cargas reales. Esas cifras de bundle no prueban performance de Production.

Se revisaron logs/diagnóstico, variables por nombre, rutas API, cookies/orígenes y estáticamente Vercel. No se descargaron variables, no se leyó `.env` y no se afirmó que las credenciales remotas estén configuradas. El endpoint de salud del contrato actual es `/api/v1/healthz`; `/api/v1/health` no sustituye ese contrato.

## Base de datos y migraciones

Las tres migraciones existentes siguen sin cambios:

| Migración | Inspección | SHA-256 previamente revisado y conservado |
| --- | --- | --- |
| 00000000000000_init | Tablas, claves, checks y SQL adicional de concurrencia | 431243b782da5954046bccead86c9ff8d06be0566f15dcfe5bd7c1fce44cb2dd |
| 20260907192000_add_account_issuer | Columna issuer opcional; compatible con datos existentes | 6eb4a293e4bdd2087c03cd35f5ebfdde6ec9c2c98ec96fb12530b495c2dbdc08 |
| 20260908120000_add_file_table | CREATE file, 3 índices y FK owner; sin DROP/reset/transformación de datos | 498730f6a753bf79a4f284474e426caf155607cffab63b0dbd969b6f80a4efb5 |

`server/tests/schema-integrity.integration.test.ts` consulta pg_indexes, pg_constraint, information_schema y _prisma_migrations en el PostgreSQL temporal. Comprueba:

- `service_request_provider_active_unique`: UNIQUE parcial para accepted/on_the_way/arrived/in_progress, no completed.
- `dispute_one_open_per_request`, índices únicos email/session token/provider user/referral/request code/review request.
- Los cuatro CHECKs de rating y FK de address/default_address/file owner.
- Las tres migraciones terminadas, account.issuer y file.owner_id.

El runner aplicó `prisma migrate deploy` y después `prisma migrate status` únicamente en el clúster PostgreSQL 17 que acababa de crear, con nombre/puerto/credencial nuevos, identidad loopback comprobada y entorno heredado saneado. No volvió a verificar ni modificar Neon; su estado remoto actual no se presenta como comprobado en esta ronda. No hubo migración nueva ni necesidad de migrar para direcciones/admin.

## Pruebas y resultados finales

| Comando | Exit code | Resultado exacto |
| --- | --- | --- |
| npm run typecheck | 0 | tsc --noEmit correcto |
| npm run test:offline | 0 | 223 passed, 140 skipped de 363; 23 archivos passed, 18 skipped de 41; 11.99 s |
| npm run test:integration | 0 | 363 passed, 41/41 archivos; 16.55 s; todos los tests, incluidos offline, con PostgreSQL local aislado |
| npm run build | 0 | Vite 6.4.3, 62 módulos; 976 ms. index.html 1.47 kB (0.80 gzip), CSS 53.95 kB (10.11 gzip), JS 347.51 kB (98.17 gzip) |
| git diff --check | 0 | Sin errores de whitespace; vuelto a comprobar al cerrar el informe |
| npm audit | 1 | Avisos presentes: 2 critical, 4 high, 5 moderate; 11 entradas de paquete |

Los tests offline saltan explícitamente los casos que requieren DB; no son fallos omitidos. La integración ejecuta también los casos offline y confirmó **las 27 tablas de aplicación vacías al terminar**. El runner bloquea carga de `.env` con DOTENV_CONFIG_PATH aislado y variables de test; build se ejecutó con ALTOQUE_SAFE_VALIDATION=1 para que Vite no cargue `.env`. Nunca recibió las conexiones Neon existentes.

Una primera ejecución detectó dos fallos de nuevas fixtures por email ULID en mayúsculas frente a normalización de Better Auth. Se corrigió la fixture a minúsculas y se añadió regresión de login con distinta capitalización; las dos ejecuciones completas siguientes pasaron. Se conservó el directorio diagnóstico de esa ejecución fallida fuera del repo (`/var/folders/qv/nvszcpcs00b0829snrk8prfh0000gn/T/altoque-tests-WjVAFw`) conforme al runner; no se eliminaron backups existentes. El servidor visual temporal se detuvo al terminar y se restauró el viewport del navegador.

Nuevas suites: direcciones, admin-bootstrap offline/integración, admin-safety, app-states, auth-logging, auth-rate-limit offline/integración, backend-guards, backend-regressions, browser-http, client-api-flow, dispute-filter, email-hooks, email-verification-ui, email, env, file-store, password-recovery-ui, profile-security, profile-ui, provider-api, provider-availability, provider-panel, schema-integrity y session-actions. También se ampliaron auth.integration, claim.integration, providers-public, security, seed.integration y setup.

Cobertura añadida: colisiones/ownership y fallos ajenos, estados vacíos/error/pending, persistencia de disponibilidad, CRUD direcciones, contraseña y revocación, hashing/admin idempotente con contraseña conservada, permisos/roles/frescura, transiciones concurrentes, dispersión de disputas paginadas, multipart/timeout/error no JSON, rechazo real de transporte simulado, logs sensibles, rate limit atómico y constraints SQL. Las pruebas React son SSR/contratos, no un E2E de navegador completo con la DB. La inspección visual muestreó pro, direcciones, seguridad, creación de solicitud, estados de error y 404; no creó usuarios/datos remotos ni envió correos.

## npm audit: análisis sin cambios de dependencias

11 es el número de **entradas de paquetes**, con cadenas heredadas; no son 11 vulnerabilidades independientes. Tinypool eleva también la severidad de Vitest; deepmerge-ts eleva @prisma/config y Prisma. La exposición se evalúa por uso, no solo por estar en dependencies/devDependencies.

| Paquete instalado | Severidad npm y vulnerabilidad | Exposición encontrada | Versión corregida / impacto de actualizar |
| --- | --- | --- | --- |
| tinypool 1.1.1 | CRITICAL, dos gadgets de prototype pollution a RCE en opciones de worker/run | Tooling de Vitest. Requiere contaminación previa del prototipo; no se encontró llamada desde API de Altoque | 2.1.2 cubre ambos. Salto major desde 1.x y árbol Vitest a revisar. Los avisos del mantenedor figuran como High, npm los clasifica Critical |
| vitest 3.2.7 | CRITICAL heredado de tinypool; propio path traversal/file read de mocker MODERATE | Tests/tooling; no servidor de Vitest expuesto en Vercel por la configuración revisada | 4.1.11 corrige mocker; confirmar además tinypool >=2.1.2 en árbol final. Major 3→4. npm ofrece 5.0.3, incompatible con peer opcional ^2/^3/^4 declarado por Better Auth 1.7.1 |
| @vitest/mocker 3.2.7 | MODERATE, lectura arbitraria mediante redirect mock | Tooling; no plugin de mocks de navegador habilitado en aplicación | 4.1.11. Actualizar junto a Vitest, no forzar subpaquete aislado |
| deepmerge-ts 7.1.5 | HIGH, agotamiento de stack con grafos de objetos recursivos | Alcanzado por @prisma/config/CLI. No se encontró cadena HTTP que le entregue un grafo cíclico; JSON de red no representa ciclos | 8.0.0, major. Prisma compatible debe evaluarse; no override improvisado |
| @prisma/config 6.19.3 | HIGH heredado de deepmerge-ts | Configuración/tooling Prisma; distinto del uso runtime de @prisma/client | No se confirmó un parche compatible 6.19.x. 8.1.0-dev.5 inspeccionado usa deepmerge-ts 8.0.2, pero es prerelease major y no una recomendación de instalación |
| prisma 6.19.3 | HIGH heredado de @prisma/config | CLI/generación/migraciones; instalado como dependency, funcionalmente tooling | npm propone 6.12.0 (downgrade fuera del rango). No se ejecuta. Resolver árbol compatible con @prisma/client, no degradar automáticamente |
| source-map-js 1.2.1 | HIGH, event-loop DoS con offsets de indexed source maps | Tooling Vite/PostCSS/Tailwind. No entrada API de Altoque identificada | 1.2.2, patch, sin major semver; revisar lockfile y build en ronda autorizada |
| hono 4.13.4 | MODERATE: toSSG traversal, parseBody dot nesting, query tras fragmento, XSS hono/jsx boundaries | Runtime API. toSSG/parseBody(dot:true)/hono-jsx no usados; c.req.query sí usado y anomalía de parser reproducida localmente, sin probar alcance del proxy real | 4.13.7 cubre los cuatro, patch. No actualizado en esta ronda |
| react-router 6.30.4 | MODERATE: redirect por backslash y constructor injection en hidratación SSR | Frontend runtime; rutas internas controladas y SPA sin SSR reducen las superficies observadas | 7.18.0, major, necesita revisar migración/router |
| react-router-dom 6.30.4 | MODERATE: open redirect/XSS propio y advisories heredados | Frontend runtime; no enlace externo no confiable identificado en navegación revisada | 6.30.6 patch corrige aviso propio; no resuelve por sí solo todos los avisos heredados de react-router, que requieren 7.18.0 |
| uuid 9.0.1 | MODERATE: falta de validación de buffer en v3/v5/v6 | No se encontró uso desde la aplicación; instalada en dependencies | 11.1.1 mínimo corregido, major; npm propone 14.0.2. Primero confirmar necesidad/consumidores |

No se ejecutó npm audit fix, --force, upgrades ni downgrades. Prisma, Vitest y uuid siguen en dependencies aunque su uso observado sea tooling o no exista; reorganizar/remover requiere una ronda distinta y pruebas del empaquetado.

Fuentes primarias: [tinypool worker](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3), [tinypool run](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr), [deepmerge-ts](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx), [Vitest/mocker](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [Hono query](https://github.com/honojs/hono/security/advisories/GHSA-crvj-82cr-hjcx). Los restantes rangos/versiones de la tabla proceden del JSON de npm audit y paquetes instalados; no se interpretó fixAvailable como instrucción de actualización.

## Administrador: instrucciones preparadas, no ejecutadas en Neon

El procedimiento completo está en `docs/admin-bootstrap.md`. Para una cuenta nueva, establece localmente SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en archivo ignorado, sin pegarlos en chat/logs/argumentos. Password entre 16 y 128 caracteres. El bootstrap crea user + account credential + admin_profile con hash oficial y correo verificado, y permite login normal. En repetición conserva la contraseña original aunque cambie la variable.

Antes de cualquier futura escritura en Preview, vuelve a confirmar rama preview y los IDs históricamente verificados, además de par pooled/direct public. Después de aprobar específicamente la creación, este será el comando:

```sh
node --env-file=.env --import=tsx server/database/seeds/bootstrap-admin.ts --apply --preview-endpoint=ep-steep-hall-au81p0co --preview-branch=br-spring-paper-auff9g85
```

**NO ejecutado en esta ronda.** Las guardias rechazan Production/otros destinos y la identidad real se comprueba READ ONLY antes de escribir. No correr el seed de catálogo para crear este admin. Si el email pertenece a una cuenta no compatible, el proceso se detiene para revisión en lugar de elevarla silenciosamente. Tras la creación aprobada, retira las dos variables de seed del archivo; no pertenecen al runtime Vercel.

## Correo y acciones manuales pendientes

El usuario confirmó que `altoquerd.do` está Verified en Resend. No es necesario tocar DNS para preparar esta lógica. El remitente y la API key solo se obtienen de variables del servidor; no se usa onboarding@resend.dev, ni se hardcodea email/dominio/destinatario en la lógica.

Para el futuro Preview aprobado, configurar manualmente solo en su scope:

- `RESEND_API_KEY`: secreto de Resend, jamás en chat ni con prefijo VITE_.
- `EMAIL_FROM`: `Altoque <no-reply@altoquerd.do>`, valor de entorno, no constante de código.
- Origen canónico de Preview y aliases confiables sin heredar APP_URL de Production. Revisar HTTPS/cookies una vez que Vercel termine los certificados.

No se cambió configuración de Vercel aquí. El siguiente E2E real deberá usar cuentas/mailboxes de prueba autorizados: signup → cuenta sin verificar/sin sesión → correo real → botón → verificado → sesión/login; más reenvío, rechazo de envío y reset. No se deben considerar exitosos por un simple mensaje de UI o por aceptación de API sin comprobar entrega. Falta validar el almacenamiento privado y decidir el proxy de lectura. No se requieren secretos en el chat para ninguna de estas acciones.

## Calificación razonada

Evaluación técnica del estado local actual; no certificación de seguridad. Cada nota mide el área completa, no solo lo reparado en esta ronda.

| Área | Nota /10 | Qué impide 10/10 |
| --- | --- | --- |
| Arquitectura | 7.2 | Separación clara pero contratos duplicados/any, vistas grandes y mezcla de demo/real; sin pipeline de E2E completo |
| Backend/API | 7.4 | Ownership/CAS sólidos; ranking paginado incorrecto, JSON inválido y algunos flujos de operación incompletos |
| Base de datos | 7.8 | Constraints y migraciones verificadas; faltan integridad de archivos/credenciales revisada, ubicación histórica, pruebas de planes/restore |
| Seguridad | 6.2 | Endurecimiento y regresiones útiles; advisories abiertos, sin pentest externo, retención/observabilidad y lectura privada completa |
| Autenticación/autorización | 7.7 | Better Auth real, verificación/admin/permisos probados; email/dominio/cookies externos sin E2E, política de suspensiones/2FA por completar |
| Frontend/UX | 6.5 | Flujos esenciales reales con estados útiles; landing demo, funciones incompletas, paginación admin y accesibilidad/pulido pendientes |
| Testing | 7.2 | 363 pruebas verdes y cleanup real; muchas regresiones UI son SSR/contrato, sin CI/E2E browser+DB remoto ni dispositivos reales |
| Performance | 6.2 | Bundle razonable; queries de reviews no agregadas, polling, ausencia de carga/Web Vitals/latencia real |
| Mantenibilidad | 6.8 | Módulos nuevos acotados; gran diff por revisar, legacy/mocks, tipos inconsistentes y documentación anterior desactualizada |
| Preparación para Production | 5.0 | Config estática coherente; falta remediación deps, validación externa, CI, alertas, restore/rollback y operación comercial cerrada |

**Nota técnica global: 6.8/10**, media simple de las diez notas (68.0 puntos sumados / 10 áreas). No es 10 porque todavía hay bugs confirmados, riesgos sin cerrar y validación externa pendiente.

**Preparación comercial/lanzamiento: 4.5/10.** Criterios separados: flujo esencial 6.5, seguridad/operación 5.0, integraciones externas probadas 3.5 y confianza/soporte/producto 3.0; media 4.5. Falta demostrar correo/Blob/domino SSL real, retirar afirmaciones demo, completar oferta profesional verificada, ubicación/contacto/notificaciones/expiración y definir soporte, disputas, privacidad y pagos. Una buena suite local no demuestra que el servicio esté listo para clientes reales.

## Roadmap priorizado

### Antes del próximo Preview

1. Revisar y separar este diff funcional amplio antes de cualquier commit; conservar los tests verdes y guardias de test local.
2. Resolver en ronda autorizada el ranking global y paginación admin; sustituir/identificar demo de landing para no validar información falsa como datos reales.
3. Configurar Resend y origen canónico solo en Preview; luego ejecutar E2E real de verificación/reenvío/reset con cuentas de prueba autorizadas. Revisar dominio/SSL/cookies y aliases sin tocar DNS por inercia.
4. Decidir y completar lectura privada de fotos y compensación de upload antes de afirmar ese flujo funcional.
5. Preparar remediación compatible de dependencias, priorizando tinypool/Vitest y patches de Hono/source-map; no aplicar fix --force ni el downgrade automático de Prisma.
6. Crear admin Preview exclusivamente después de aprobación específica y comprobación de identidad, usando el bootstrap dedicado. No seed de catálogo remoto.

### Antes de Production

1. Cerrar los riesgos de dependencias y verificar árbol, build, peer dependencies y empaquetado.
2. Separación efectiva de entornos, validación de cookies/orígenes/CSRF/ownership y PII, almacenamiento privado autorizado y política de cuentas suspendidas.
3. CI con checks, migraciones revisadas, plan de rollback, backups/restore probado, monitorización y alertas de API/correo/DB; retención de auditoría/rate limit/archivos.
4. Medir carga, queries agregadas, índices y latencia real; E2E completo cliente/pro/admin con datos controlados.
5. Aprobar por separado cualquier escritura, administrador o migración necesaria de Production. Ninguna está autorizada por este informe.

### Antes del lanzamiento público

1. Cerrar expiración/notificaciones/ubicación/contacto y definir flujo comercial completo, incluyendo cotización y pagos o un modelo explícito de operación manual.
2. Verificación profesional, oferta real por zona/categoría y proceso operativo de cancelaciones/disputas/soporte.
3. Contenido honesto de landing, textos de privacidad/condiciones y política de retención acordados por el responsable; no se hizo revisión legal aquí.
4. Pruebas reales de dispositivos, accesibilidad, errores de red, email, archivos y soporte; corregir las incidencias de esa ronda.

### Mejoras posteriores

1. Pasada separada de pulido visual/UI/UX, incluido el switch P3 que el usuario pidió dejar pendiente.
2. DTOs compartidos, eliminación de legacy/mocks, división de vistas grandes y focus management completo.
3. Histórico/portfolio/horarios/favoritos, mejor búsqueda geográfica y métricas; evaluar realtime cuando volumen justifique sustituir polling.
4. Considerar 2FA y gestión de sesiones/admins con políticas reales; no agregar controles simulados.

## Estado de Git y control de secretos

HEAD continúa en ca225f3. Staging vacío; cambios de esta ronda conservados en working tree. `.env` continúa ignorado y no tracked. Stashes intactos:

- stash@{0}: `9ca0850fa010f49e14d485b1c2aa89f8a181feed`
- stash@{1}: `c98a2e8b0ed75649e31f2b5204de0114ef9bc464`

Se escanearon archivos tracked y nuevos de texto, excluyendo archivos de entorno secretos, sin imprimir contenido coincidente. No se encontraron nuevas credenciales privadas, tokens reales ni conexiones PostgreSQL reales. Las construcciones PostgreSQL detectadas son del runner/fixtures sintéticos; los ejemplos antiguos del handoff no contienen usuario/password real. No se hizo un escaneo de todo el historial Git ni se asegura que cada string posible sea un secreto detectable por patrones.

No hay cambios de esquema/migraciones, package.json/package-lock.json ni vercel.json. dist/node_modules están ignorados. La configuración `.env` se mantiene local. No se eliminaron stashes/backups. El inventario y resumen de diff finales se añaden abajo; incluye archivos nuevos, que git diff --stat por sí solo no cuenta.

### Inventario final de archivos

92 archivos: 42 modificados tracked y 50 nuevos sin staging.

**Infraestructura de integración (2)**

- `scripts/run-tests.mjs`
- `server/tests/setup.ts`

**Aplicación frontend/backend (50)**

- `server/auth/auth.ts`
- `server/auth/email-hooks.ts`
- `server/auth/email.ts`
- `server/auth/logger.ts`
- `server/auth/rate-limit.ts`
- `server/database/prisma.ts`
- `server/index.ts`
- `server/lib/audit.ts`
- `server/lib/diag.ts`
- `server/lib/envelope.ts`
- `server/lib/files.ts`
- `server/lib/logger.ts`
- `server/lib/ratelimit.ts`
- `server/middleware/auth.ts`
- `server/middleware/security.ts`
- `server/requests/claimRequest.ts`
- `server/requests/transitions.ts`
- `server/routes/addresses.ts`
- `server/routes/admin.ts`
- `server/routes/disputes.ts`
- `server/routes/providers-public.ts`
- `server/routes/providers.ts`
- `server/routes/requests.ts`
- `server/routes/zones.ts`
- `src/App.tsx`
- `src/components/AppStates.tsx`
- `src/features/admin/AdminDataState.tsx`
- `src/features/admin/AdminHome.tsx`
- `src/features/client/Addresses.tsx`
- `src/features/client/DisputeView.tsx`
- `src/features/client/Flow.tsx`
- `src/features/client/Home.tsx`
- `src/features/client/Profile.tsx`
- `src/features/client/RequestWizard.tsx`
- `src/features/client/Requests.tsx`
- `src/features/client/Security.tsx`
- `src/features/landing/EmailVerification.tsx`
- `src/features/landing/Landing.tsx`
- `src/features/landing/PasswordRecovery.tsx`
- `src/features/landing/Provider.tsx`
- `src/features/provider/ProApp.tsx`
- `src/features/provider/ProDisputeView.tsx`
- `src/features/provider/ProviderPanelStates.tsx`
- `src/features/provider/ProviderProfileSetup.tsx`
- `src/lib/api.ts`
- `src/lib/http.ts`
- `src/lib/profile-api.ts`
- `src/lib/session-actions.ts`
- `src/lib/state.ts`
- `src/lib/use-api-polling.ts`

**Configuración (2)**

- `server/config/env.ts`
- `vite.config.js`

**Documentación (3)**

- `docs/admin-bootstrap.md`
- `docs/auditoria-final-2026-10-06.md`
- `server/database/README.md`

**Bootstrap/seed administrativo (4)**

- `server/database/seeds/admin.ts`
- `server/database/seeds/bootstrap-admin.ts`
- `server/database/seeds/safety.ts`
- `server/database/seeds/seed.ts`

**Pruebas y regresiones (31)**

- `server/tests/addresses.integration.test.ts`
- `server/tests/admin-bootstrap.integration.test.ts`
- `server/tests/admin-bootstrap.test.ts`
- `server/tests/admin-safety.integration.test.ts`
- `server/tests/app-states.test.ts`
- `server/tests/auth-logging.test.ts`
- `server/tests/auth-rate-limit.integration.test.ts`
- `server/tests/auth-rate-limit.test.ts`
- `server/tests/auth.integration.test.ts`
- `server/tests/backend-guards.test.ts`
- `server/tests/backend-regressions.integration.test.ts`
- `server/tests/browser-http.test.ts`
- `server/tests/claim.integration.test.ts`
- `server/tests/client-api-flow.test.ts`
- `server/tests/dispute-filter.integration.test.ts`
- `server/tests/email-hooks.test.ts`
- `server/tests/email-verification-ui.test.ts`
- `server/tests/email.test.ts`
- `server/tests/env.test.ts`
- `server/tests/file-store.test.ts`
- `server/tests/password-recovery-ui.test.ts`
- `server/tests/profile-security.integration.test.ts`
- `server/tests/profile-ui.test.ts`
- `server/tests/provider-api.test.ts`
- `server/tests/provider-availability.integration.test.ts`
- `server/tests/provider-panel.test.ts`
- `server/tests/providers-public.test.ts`
- `server/tests/schema-integrity.integration.test.ts`
- `server/tests/security.test.ts`
- `server/tests/seed.integration.test.ts`
- `server/tests/session-actions.test.ts`

### git status --short

```text
 M scripts/run-tests.mjs
 M server/auth/auth.ts
 M server/auth/email.ts
 M server/config/env.ts
 M server/database/README.md
 M server/database/prisma.ts
 M server/database/seeds/seed.ts
 M server/index.ts
 M server/lib/audit.ts
 M server/lib/diag.ts
 M server/lib/envelope.ts
 M server/lib/files.ts
 M server/lib/logger.ts
 M server/lib/ratelimit.ts
 M server/middleware/auth.ts
 M server/middleware/security.ts
 M server/requests/claimRequest.ts
 M server/routes/admin.ts
 M server/routes/disputes.ts
 M server/routes/providers-public.ts
 M server/routes/providers.ts
 M server/routes/requests.ts
 M server/tests/auth.integration.test.ts
 M server/tests/claim.integration.test.ts
 M server/tests/providers-public.test.ts
 M server/tests/security.test.ts
 M server/tests/seed.integration.test.ts
 M server/tests/setup.ts
 M src/App.tsx
 M src/features/admin/AdminHome.tsx
 M src/features/client/DisputeView.tsx
 M src/features/client/Flow.tsx
 M src/features/client/Home.tsx
 M src/features/client/Profile.tsx
 M src/features/landing/Landing.tsx
 M src/features/landing/Provider.tsx
 M src/features/provider/ProApp.tsx
 M src/features/provider/ProDisputeView.tsx
 M src/lib/api.ts
 M src/lib/http.ts
 M src/lib/state.ts
 M vite.config.js
?? docs/admin-bootstrap.md
?? docs/auditoria-final-2026-10-06.md
?? server/auth/email-hooks.ts
?? server/auth/logger.ts
?? server/auth/rate-limit.ts
?? server/database/seeds/admin.ts
?? server/database/seeds/bootstrap-admin.ts
?? server/database/seeds/safety.ts
?? server/requests/transitions.ts
?? server/routes/addresses.ts
?? server/routes/zones.ts
?? server/tests/addresses.integration.test.ts
?? server/tests/admin-bootstrap.integration.test.ts
?? server/tests/admin-bootstrap.test.ts
?? server/tests/admin-safety.integration.test.ts
?? server/tests/app-states.test.ts
?? server/tests/auth-logging.test.ts
?? server/tests/auth-rate-limit.integration.test.ts
?? server/tests/auth-rate-limit.test.ts
?? server/tests/backend-guards.test.ts
?? server/tests/backend-regressions.integration.test.ts
?? server/tests/browser-http.test.ts
?? server/tests/client-api-flow.test.ts
?? server/tests/dispute-filter.integration.test.ts
?? server/tests/email-hooks.test.ts
?? server/tests/email-verification-ui.test.ts
?? server/tests/email.test.ts
?? server/tests/env.test.ts
?? server/tests/file-store.test.ts
?? server/tests/password-recovery-ui.test.ts
?? server/tests/profile-security.integration.test.ts
?? server/tests/profile-ui.test.ts
?? server/tests/provider-api.test.ts
?? server/tests/provider-availability.integration.test.ts
?? server/tests/provider-panel.test.ts
?? server/tests/schema-integrity.integration.test.ts
?? server/tests/session-actions.test.ts
?? src/components/AppStates.tsx
?? src/features/admin/AdminDataState.tsx
?? src/features/client/Addresses.tsx
?? src/features/client/RequestWizard.tsx
?? src/features/client/Requests.tsx
?? src/features/client/Security.tsx
?? src/features/landing/EmailVerification.tsx
?? src/features/landing/PasswordRecovery.tsx
?? src/features/provider/ProviderPanelStates.tsx
?? src/features/provider/ProviderProfileSetup.tsx
?? src/lib/profile-api.ts
?? src/lib/session-actions.ts
?? src/lib/use-api-polling.ts
```

### git diff --stat (tracked)

```text
 scripts/run-tests.mjs                    |   8 +-
 server/auth/auth.ts                      |  10 +-
 server/auth/email.ts                     | 118 +++--
 server/config/env.ts                     |  16 +-
 server/database/README.md                |  15 +-
 server/database/prisma.ts                |  16 +-
 server/database/seeds/seed.ts            |  64 +--
 server/index.ts                          |  14 +-
 server/lib/audit.ts                      |  13 +-
 server/lib/diag.ts                       |   8 +-
 server/lib/envelope.ts                   |   9 +-
 server/lib/files.ts                      |  26 +-
 server/lib/logger.ts                     |  29 +-
 server/lib/ratelimit.ts                  |  35 +-
 server/middleware/auth.ts                |  11 +-
 server/middleware/security.ts            |  11 +-
 server/requests/claimRequest.ts          |  35 +-
 server/routes/admin.ts                   | 159 +++---
 server/routes/disputes.ts                | 206 ++++----
 server/routes/providers-public.ts        |  99 +---
 server/routes/providers.ts               |  45 +-
 server/routes/requests.ts                |  56 +-
 server/tests/auth.integration.test.ts    | 108 +++-
 server/tests/claim.integration.test.ts   |   3 +-
 server/tests/providers-public.test.ts    |  12 +
 server/tests/security.test.ts            |  13 +
 server/tests/seed.integration.test.ts    |   2 +
 server/tests/setup.ts                    |   2 +-
 src/App.tsx                              |  52 +-
 src/features/admin/AdminHome.tsx         |  93 +---
 src/features/client/DisputeView.tsx      |  43 +-
 src/features/client/Flow.tsx             | 872 +------------------------------
 src/features/client/Home.tsx             | 581 ++++----------------
 src/features/client/Profile.tsx          | 264 ++--------
 src/features/landing/Landing.tsx         |  69 +--
 src/features/landing/Provider.tsx        | 359 +++----------
 src/features/provider/ProApp.tsx         | 361 +++++++------
 src/features/provider/ProDisputeView.tsx |  43 +-
 src/lib/api.ts                           |  74 ++-
 src/lib/http.ts                          |  21 +-
 src/lib/state.ts                         |  12 +-
 vite.config.js                           |   2 +
 42 files changed, 1296 insertions(+), 2693 deletions(-)
```

Este stat cuenta solo los 42 archivos tracked. Los 50 nuevos del inventario también forman parte de la revisión; siguen untracked por la prohibición de staging/commit.
