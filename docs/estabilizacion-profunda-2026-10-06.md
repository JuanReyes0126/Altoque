# Altoque · optimización y estabilización profunda

Base: `29335d77b42a4991f498e378399788106d660d21`, master. Fecha: 6 de octubre de 2026.

## Alcance y límites

Auditoría de fuentes, contratos, fixtures, árbol de dependencias y auditorías anteriores; correcciones locales dentro de la arquitectura actual. No se rediseñaron vistas ni retiraron controles, pantallas o flujos. No se reintrodujeron cifras, precios, ETAs, testimonios o profesionales ficticios. El switch Online/Offline conserva sus clases/estructura y su P3 visual pendiente.

No hubo staging, commit, push, deploy, escritura remota, correo, bootstrap remoto, cambios de variables/DNS ni conexión a Neon o Production. No se abrió `.env`. Esquema, tres migraciones y diagnóstico de `api/index.ts`/`edge-dual.test.ts` permanecen intactos. El runner aplica las tres migraciones existentes exclusivamente a su PostgreSQL temporal nuevo.

El incidente de `33dae51` continúa **no reproducido / causa no determinada / bajo observación**. La evidencia previa de `29335d7` —34/34 secuencias completas, cero errores observados— no identifica su causa. Esta ronda no produjo evidencia nueva ni intenta corregirlo especulativamente.

## Inventario y correcciones priorizadas

No se identificó un nuevo P0/P1 confirmado en las superficies revisadas; no equivale a pentest ni garantía de ausencia de vulnerabilidades. Se corrigieron primero problemas P2 con regresiones, y después robustez/performance/accesibilidad P3.

| ID / severidad / tipo | Causa y evidencia | Solución aplicada |
| --- | --- | --- |
| R01 / A15 · P2, autenticación | Better Auth validaba contraseña/email, pero `session.create.before` no verificaba `user.status`; suspend/block conservaban sesiones. `server/auth/auth.ts`, `server/routes/admin.ts`. | Hook oficial fail-closed consulta únicamente status, rechaza cuentas inactivas con 403 genérico y propaga errores DB. Revocación de sesiones del objetivo en la misma transacción que status y auditoría, sin tocar otras cuentas ni contraseña. **Parcial frente a concurrencia extrema**, ver límites. |
| R02 · P2, concurrencia | Dos altas profesionales superaban el precheck y una fallaba con P2002/500. `server/routes/providers.ts`. | Solo la colisión identificada de `provider_profile.user_id` pasa a 409. Retry de referral permanece específico y acotado; otros modelos/constraints/códigos siguen siendo errores reales. Resultado simultáneo probado: 201/409, un perfil y sus asociaciones. |
| R03 · P2, autorización/concurrencia | Claim validaba perfil/cuenta/categoría/zona antes de la transacción; revocación posterior permitía asignación. `server/requests/claimRequest.ts`. | Validación y locks `FOR SHARE` dentro de la transacción, con orden profile → user → service → zone, consistente con aprobación administrativa. CAS, índice de un trabajo activo, historial y notificaciones conservados. No se agregaron retries generales ni cambió la política Online/Offline. |
| R04 · P2, funcional | Inbox mostraba solicitudes propias que claim prohibía. `server/routes/providers.ts`. | Excluir customer_id del actor antes de paginar y contar. Un inbox solo de solicitudes propias es éxito vacío. |
| R05 · P2, validación | Backend admitía descripción de espacios y fecha programada pasada/presente, pese a la validación frontend. `server/routes/requests.ts`. | Trim y contenido obligatorio; scheduled requiere fecha estrictamente futura. Texto válido y fecha futura persisten. |
| R06 / A04 · P2, performance | Detalle público leía todos los ratings para calcular avg/count. `server/routes/providers-public.ts`. | Agregado SQL devuelve un resumen; mantiene diez reseñas recientes, redondeo y DTO público. Fixture de 503 reseñas verifica resumen global y ausencia de lectura ilimitada. Reduce transferencia, **no demuestra menor latencia**. |
| R07 · P2, funcional/race | Directorio podía quedar en página inexistente si disminuía el catálogo, mostrando vacío y perdiendo navegación. `src/features/client/Home.tsx`. | Validación de metadata, consulta de última página válida, controles de límites/carga/error y descarte de respuestas obsoletas; conserva filtros y creación de solicitud. |
| R08 · P2, funcional | ProApp consultaba siempre las primeras veinte solicitudes. `src/features/provider/ProApp.tsx`. | Paginación real de veinte con metadata, anterior/siguiente, loading/error/retry y clamp cuando desaparece una página. Sin cargar todo el dataset. |
| R09 · P2, funcional | Backend autorizaba y devolvía address del trabajo activo, pero el profesional no veía su línea. `ProApp.tsx`. | Mostrar dirección del servicio; si falta, explicar que la zona no reemplaza una dirección exacta. No ampliar DTO público ni exponer dirección de trabajos ajenos. |
| R10 · P2, funcional | Disputas se leían solo al montar; resolución administrativa permanecía abierta hasta refresh. `DisputeView.tsx`, `ProDisputeView.tsx`. | Polling secuencial de lectura, actualización de resolución, cancelación de consultas viejas y errores que bloquean otra apertura. Detiene polling tras estado terminal; null sigue consultando para detectar apertura. No simula notificaciones entregadas. |
| R11 · P3, paginación | Listas privadas ordenadas solo por created_at podían cambiar el orden de empates. requests/providers/disputes. | Desempate estable por id, con regresiones de páginas sin solapamiento. No promete snapshot entre páginas distintas. |
| R12 · P3, runtime/UX | AuthSheet permitía cerrar/cambiar modo/editar campos mientras un request de auth seguía pendiente. `Landing.tsx`. | Guardias de operación en curso, controles deshabilitados, nombres accesibles/autocomplete y alert de error; conserva composición y estilos. No pretende cancelar una sesión/correo ya procesados por el servidor. |
| R13 · P3, error honesto | Bootstrap confundía cualquier error de verifyEmail con token inválido, incluido ACCOUNT_INACTIVE tras verificación y fallos de red/servicio. `App.tsx`, `EmailVerification.tsx`. | Solo INVALID_TOKEN/TOKEN_EXPIRED culpan al enlace; cuenta inactiva y fallos inciertos tienen mensajes distintos sin datos internos ni falso éxito. |
| R14 · P3, bundle | App importaba estáticamente módulos profesional/admin para todos los visitantes. `App.tsx`. | Lazy imports a nivel de módulo con guards, Suspense y error boundary existentes. Sin retirar funciones ni estilos. Loading accesible. |
| R15 / A16 · P2, operación preparada | No había workflow reproducible de validación. | Nuevo `.github/workflows/ci.yml`: Node22, acciones oficiales fijadas por SHA, contents:read, checkout sin credenciales persistidas, sin secrets/deploy. Ejecuta validaciones y PostgreSQL local. Audit completo visible y gate de críticos. **No ejecutado en GitHub ni configurado enforcement remoto**. |
| R16 / A02 · P2, dependencias | Router6 mantenía dos advisories sin parche 6.x. | Router DOM/Router7.18.4: major analizado por necesidad, engines/peers/API y regresiones. Conserva HashRouter, React18 y modo declarativo. Prisma no se degradó ni actualizó; Hono/Vitest/source-map-js conservan sus versiones remediadas. |
| R19 · P2, concurrencia/API | Filas y total podían provenir de snapshots distintos. El nuevo inbox estricto, y la paginación admin existente, podían convertir un 200 con fila1/total0 en error. | `server/database/read-page.ts` aplica RepeatableRead a las ocho listas privadas/admin. Ocho pruebas confirman DELETE/claim entre SELECTs, conservando fila1/total1 del snapshot. Sin locks de filas ni cambios de contrato. |
| R20 · P2, recuperación runtime | El enlace del error boundary solo cambiaba el hash; su estado failed persistía y el router estaba desmontado. Relevante también ante fallo de chunk lazy. | `src/components/AppStates.tsx` conserva el enlace y fuerza recarga del documento al click normal; respeta modifiers para navegación nativa. Seis regresiones de render/recuperación. |

La revisión detectó y corrigió también un orden de locks candidato que habría invertido profile/user respecto a aprobación administrativa. Una regresión determinista exige que aprobación y claim completen sin deadlock. No se presenta como incidente ocurrido en Preview.

## Pruebas y medición

Referencia antes de editar: integración **525/525**, 48 suites, 27 tablas vacías. Suites nuevas:

- `auth-session-policy.test.ts`: siete pruebas offline de status, consulta mínima, opacidad, error DB y configuración sin cookie cache/secondary storage.
- `auth.integration.test.ts`: cuatro casos nuevos de login y auto-login de verificación para suspended/blocked.
- `admin-safety.integration.test.ts`: dos casos nuevos de revocación exclusiva/conservación de credencial; dos rollback existentes ampliados para sesiones.
- `backend-stabilization.integration.test.ts`: 29 regresiones de altas concurrentes, constraints, ownership, validación temporal/texto, revocación, locks reales y orden estable. Observa esperas de lock en el PostgreSQL exclusivo, sin imprimir SQL sensible.
- `provider-detail.integration.test.ts`: tres casos con 503 reseñas, cero reseñas y error DB opaco.
- `router-compatibility.test.ts`: seis pruebas con componentes/hooks reales de navegación, querystring, vuelta atrás y guards. **MemoryRouter; no constituye E2E de HashRouter en navegador**.
- `frontend-functional-regressions.test.ts`: 29 pruebas de componentes montados, promesas controladas, clicks, polling, cancelación y guardias del formulario durante auth.
- `page-snapshot.integration.test.ts`: ocho pruebas de concurrencia real entre filas/total en los ocho endpoints.
- `app-recovery.test.ts`: seis pruebas de recuperación del error boundary, modificadores y preservación del render normal.
- `email-verification-ui.test.ts`: seis casos nuevos de clasificación honesta de errores.
- `landing-content.test.ts`: import StaticRouter actualizado al export principal de Router7; expectativas de contenido se conservan.

Pruebas relevantes por bloque: auth 18 offline y 46 integración; backend 86 integración; agregado/directorio 25 integración; Router 55 pruebas existentes y seis nuevas; mensajes de verificación + router/app-states 19. Todas las integraciones mediante el runner local y cleanup comprobado. La validación global siguiente es la evidencia final.

Una primera corrida combinada de UI tuvo un timeout en una prueba preexistente de profile-ui. No se reprodujo: aislada 13/13, combinada con renderer 39/39 y lote completo 93 aprobadas/2 omitidas. No se cambió esa fixture para esconderlo; registrar como flake observado, no como bug de Preview ni causa del incidente histórico.

### Validación final

La última ejecución corresponde al código final, después de los dos cierres independientes R19/R20:

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` | 0 | `tsc --noEmit`, sin errores. |
| `npm run test:offline` | 0 | 363 aprobadas / 262 omitidas de625; 31 archivos aprobados / 24 omitidos de55; 14.02s. |
| `npm run test:integration` | 0 | 625/625, 55/55 archivos; 20.79s. PostgreSQL temporal127.0.0.1, 27 tablas vacías al finalizar. |
| `npm run build` | 0 | Vite6.4.3, 74 módulos, 1.11s. |
| `git diff --check` | 0 | Código/documentación sin errores de whitespace; repetido después del informe. |
| `npm audit` | 1 | 0 critical, 0 moderate, 3 HIGH: deepmerge-ts/@prisma/config/prisma, un advisory heredado. No fix/force/downgrade. |

**100 pruebas nuevas netas**, frente a525 del checkpoint. Los262 skips offline son casos que necesitan DB y se ejecutaron todos en integración. Sin errores en la última ejecución ni repetición del timeout transitorio. Esquema e índices/constraints existentes cubiertos por la suite de integridad.

Build utilizó entorno saneado y `ALTOQUE_SAFE_VALIDATION=1`; Vite no leyó `.env`. El runner no heredó conexiones Neon, comprobó identidad loopback y aplicó exclusivamente las tres migraciones existentes a su DB recién creada. CI sigue pendiente de ejecución real en Ubuntu/Node22; estas salidas locales no la sustituyen.

### Bundle

El checkpoint `29335d7` medido previamente tenía JS inicial **330.61 kB / 94.70 gzip**. Tras Router7 y correcciones, antes de splitting: **352.42 / 102.55**. El build final tiene JS inicial **300.87 / 93.04**, con chunks ProApp **33.83 / 8.95** y AdminHome **20.42 / 5.36**. HTML1.47/0.80 y CSS48.49/9.22. La carga inicial baja aproximadamente9.0% en bytes y1.8% gzip respecto al checkpoint; el total de JS distribuido aumenta, y profesional/admin descargan su chunk al acceder. No atribuir a estos números mejoras de TTFB, cold start, memoria o Web Vitals ni desaparición de vistas.

## Dependencias y compatibilidad

Node requerido por Router7 es >=20, React/DOM >=18; proyecto React18.3.1 y Vercel Node22 compatibles. Altoque usa HashRouter/Routes/Navigate/hooks y rutas absolutas, no data-router, SSR/hidratación ni loaders. El cambio de splats relativos no afecta las llamadas revisadas y lazy se define fuera del render. `react-test-renderer`/tipos18.3.1 son solo dev para comprobar hooks y eventos; no llegan al bundle frontend.

Fuentes primarias: [migración oficial v6→v7](https://raw.githubusercontent.com/remix-run/react-router/refs/heads/v7/docs/upgrading/v6.md), [advisory de navegación](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6), [advisory deepmerge](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx), [hooks Better Auth](https://better-auth.com/docs/concepts/database#database-hooks).

Prisma/@prisma/client/config **6.19.3** y deepmerge-ts **7.1.5** siguen presentes. El registry no ofrece un parche 6.19.x superior compatible que resuelva esta cadena; deepmerge corregido requiere >=8.0.0. No se forzó override major, prerelease ni downgrade6.12.0 recomendado por npm. Exposición observada: CLI/configuración Prisma; no se encontró entrada HTTP que entregue grafos cíclicos. JSON no representa ciclos. Prisma permanece en dependencies, por lo que el aviso sigue en instalación de Production. **No se considera remediado**.

## Pendientes vigentes e históricos

| Hallazgo | Estado y motivo |
| --- | --- |
| A01 | Cerrado desde ronda anterior: Vitest4.1.11, tinypool ausente. Verificado de nuevo en árbol/suites. |
| A02 | Router cerrado en árbol actual; cadena Prisma/deepmerge permanece P2 según exposición. npm conserva tres entradas HIGH heredadas de un advisory. |
| A03/A05/A18/A20 | Cerrados en código actual y conservados: ranking global SQL, landing honesta, paginación admin y JSON400. No se repitieron fixes históricos. |
| A04 | Cerrada lectura ilimitada de ratings en detalle/lista. Queda medición de ranking/OFFSET/planes/volumen y carga real. |
| A06/A07/A08 · P2 | Archivos: lectura privada autorizada, compensación de Blob huérfano y FKs/dominios siguen pendientes. Requieren diseño de almacenamiento/retención; cambios de esquema solo tras autorización. No se ocultaron ni retiraron controles. |
| A09 · P2 | Identidad account sin unique compuesto compatible con Better Auth. No se observó duplicación; evaluar/migrar solo con autorización. |
| A10/A11 · P2 | Expiración automática, entrega/lectura completa de notificaciones y pagos reales no implementados. Polling de disputas no cierra entrega de notificaciones. Arquitectura/operación por decidir. |
| A12 · P2 | Onboarding documental, portfolio/horario y revisión de identidad incompletos. No se inventó validación ni se retiró UI. |
| A13/A14 · P2 | Precedencia APP_URL y cookies/enlaces entre host único/alias son riesgos de configuración/E2E. No se cambiaron variables ni se enviaron correos. Validación externa pendiente de autorización. |
| A15 · P2 residual | Hook consulta status y Better Auth hace INSERT después: una suspensión entre ambas operaciones puede dejar una sesión nueva posterior a revocación. Negocio vuelve a consultar status y niega acceso. Garantía estricta requiere diseño del adapter/transacción; no se declara atomicidad total. |
| A16/A17 · P2 | Workflow preparado localmente; ejecución CI real, required checks, gate de deploy, alertas, restore, retención y runbooks operativos no comprobados. No se configura infraestructura remota automáticamente. |
| A19 · P2 | Dirección activa mutable/eliminable y FK SetNull. Mostrar la dirección no soluciona snapshot/política histórica. Requiere decisión de producto/esquema aprobada. |
| A21 · P3 | Cancelación del read timeout y backpressure del adaptador siguen riesgos sin benchmark. No se modifica diagnóstico ni se atribuye causa al incidente. |
| A22/A23 · P3 | Minimización adicional de DTOs privados/admin y contratos/any/legacy siguen pendientes. No se borraron módulos/demos históricos sin demostrar inutilidad ni se conectaron mocks nuevos al producto. |
| A24 · P3 parcial | Mejorados nombres/autocomplete/alerts de auth y loading accesible. Focus trap, modales completos, axe/lector de pantalla requieren pasada propia. Sin rediseño. |
| A25/A26 · P3 | Retención/purga de rate_limit, dev/E2E navegador+API+DB aislado y prueba en dispositivos reales pendientes. No job destructivo ni DB compartida. |
| A27 · P3 | Switch Online/Offline visual, expresamente fuera de esta ronda. |
| A28 · P3 | RequestWizard con profesional inexistente necesita fallback a solicitud genérica conservando selección. No se elimina la preferencia ni se oculta el límite. |
| R17 · P2, función incompleta | ProApp tiene rama de disputa en completed, pero active-job excluye completed y falta historial profesional navegable. Requiere cerrar recorrido/API de historial; rama conservada, no inventar éxito. |
| R18 · P2, función incompleta | Rechazar solicitud en ProApp filtra memoria; polling la repone. Falta semántica/registro backend de rechazo. No se fingió rechazo persistente ni se añadió esquema/sessionStorage para simularlo. |
| P3 residual de paginación/performance | Filas/total ya comparten snapshot en las ocho listas; páginas distintas siguen siendo consultas distintas. RepeatableRead fija una conexión y añade BEGIN/aislamiento/COMMIT. Benchmark de ese coste y de los locks del claim pendiente. No se agregan consultas de datos al snapshot de página. |
| P3, operación/UX | Aprobación profesional requiere refresh del perfil; detalles de scheduled/quote en incoming card, polling de otras vistas terminales/fondo y accesibilidad de toasts requieren seguimiento. Mapas/avatar ilustrativos permanecen; no equivalen a GPS/identidad verificada. |

No se identificó necesidad de una nueva migración para las correcciones aplicadas. Antes de modificaciones de esquema/servicios remotos se necesita aprobación concreta. Bootstrap admin dedicado permanece preparado según `docs/admin-bootstrap.md`, sin ejecutarse contra Neon: credenciales privadas por entorno y nueva verificación endpoint/branch antes de cualquier escritura autorizada.

## Mini-auditoría independiente y privacidad

Tres revisiones cruzadas inspeccionaron áreas que no habían editado: backend/constraints/locks/aggregate/dependencias, auth/admin/CI/lazy/Router y frontend/hooks/metadata/privacidad. La revisión frontend encontró los dos P2 R19/R20 después de la primera ejecución global verde de611 pruebas: fueron corregidos, se añadieron14 regresiones y se repitieron las validaciones. Su observación P3 sobre mensaje de verificación también se corrigió. La revisión posterior independiente confirmó ambos cierres **sin nuevos bloqueantes P0/P1/P2**; mantiene los límites de snapshots entre peticiones y presión/timeout de transacciones. No se confunde verde previo con validación del diff posterior.

Escaneo de patrones y diff sin abrir `.env`, sin imprimir coincidencias sensibles. No garantiza detectar cualquier secreto imaginable. `.env` ignorado/no tracked; index vacío. Stashes esperados intactos:

- `9ca0850fa010f49e14d485b1c2aa89f8a181feed`
- `c98a2e8b0ed75649e31f2b5204de0114ef9bc464`

No se eliminaron backups existentes. Las claves/tokens de pruebas son fixtures locales; no se introdujeron valores reales ni URLs PostgreSQL privadas. No hay staged diff ni se modificó HEAD.

## Archivos afectados

**33 archivos:23 modificados y10 nuevos**, todos sin staging. Rutas relativas al repositorio:

| Área | Archivos |
| --- | --- |
| Backend/DB | `server/auth/auth.ts`; `server/requests/claimRequest.ts`; `server/routes/admin.ts`; `server/routes/disputes.ts`; `server/routes/providers-public.ts`; `server/routes/providers.ts`; `server/routes/requests.ts`; nuevo `server/database/read-page.ts`. |
| Frontend | `src/App.tsx`; `src/components/AppStates.tsx`; `src/features/client/Home.tsx`; `src/features/client/DisputeView.tsx`; `src/features/landing/EmailVerification.tsx`; `src/features/landing/Landing.tsx`; `src/features/provider/ProApp.tsx`; `src/features/provider/ProDisputeView.tsx`; `src/lib/api.ts`; `src/lib/use-api-polling.ts`. |
| Tests ampliados | `server/tests/admin-safety.integration.test.ts`; `server/tests/auth.integration.test.ts`; `server/tests/email-verification-ui.test.ts`; `server/tests/landing-content.test.ts`. |
| Tests nuevos | `server/tests/auth-session-policy.test.ts`; `server/tests/backend-stabilization.integration.test.ts`; `server/tests/frontend-functional-regressions.test.ts`; `server/tests/provider-detail.integration.test.ts`; `server/tests/router-compatibility.test.ts`; `server/tests/app-recovery.test.ts`; `server/tests/page-snapshot.integration.test.ts`. |
| Infra/config | `package.json`; `package-lock.json`; nuevo `.github/workflows/ci.yml`. |
| Informe | Nuevo `docs/estabilizacion-profunda-2026-10-06.md`. Informes históricos sin cambios. |

## Calificación comparable y roadmap

Las diez categorías son las mismas; base comparativa es la remediación pre-Preview7.2/10, posterior a la auditoría6.8/10. Verde local no significa launch readiness.

| Categoría | Antes | Ahora | Qué impide10/10 |
| --- | --- | --- | --- |
| Arquitectura | 7.3 | 7.5 | Vistas grandes, contratos duplicados/any, legacy y flujos operativos incompletos. |
| Backend/API | 7.9 | 8.3 | Archivos/notificaciones/historial/rechazo aún incompletos; metadata concurrente y más contratos selectivos. |
| Base de datos | 7.8 | 8.0 | Locks/constraints probados; faltan integridad de archivos/identidad/ubicación, restore y planes con volumen. |
| Seguridad | 7.0 | 7.5 | Cadena HIGH pendiente, lectura privada/retención, rate limiting distribuido y pentest sin comprobar. |
| Autenticación/autorización | 7.7 | 8.0 | Emisión/suspensión no totalmente atómica; correo/cookies/reset multihost reales y operación admin no validados. |
| Frontend/UX | 7.2 | 7.6 | Historial/rechazo y onboarding incompletos, modales/foco y pasada visual/móvil pendientes. |
| Testing | 7.6 | 8.0 | Más hooks/eventos/races reales; falta CI ejecutado, E2E navegador/API/DB y dispositivos/HashRouter real. |
| Performance | 6.8 | 7.3 | Menos transferencia/JS inicial; no carga, contención, EXPLAIN con volumen ni Web Vitals/cold-start reales. |
| Mantenibilidad | 7.0 | 7.4 | Workflow/contratos y regresiones mejores; siguen any, grandes vistas y mocks legacy sin limpieza probada. |
| Preparación para Production | 5.7 | 6.1 | CI enforcement, advisories, archivos, integraciones reales, restore/alertas, E2E y decisiones operativas pendientes. |

**Nota técnica global7.6/10** (75.7/10=7.57, redondeada). **Production readiness6.1/10**. No se recomienda promoción automática ni afirmar lanzamiento listo.

1. **Antes del próximo Preview:** revisar diff y autorizar checkpoint, después E2E real HashRouter/origen/auth y sesión; instrumentación conservada. CI preparado, sin deploy automático desde esta ronda.
2. **Antes de Production:** remediación compatible Prisma/deepmerge, CI ejecutado/checks requeridos/gate de deploy, E2E correo/reset/cookies, diseño y pruebas de archivos, identidad/dirección histórica, alertas/restore/retención.
3. **Antes del lanzamiento público:** cerrar historial/rechazo/onboarding, expiración/notificaciones y modelo operativo de pagos con aprobación; accesibilidad completa, carga y dispositivos reales.
4. **Posterior:** pulido UI/UX incluyendo A27, mediciones continuas, contratos compartidos y retirada de legacy solo con evidencia.

Trabajo local, detenido para revisión una vez completadas las salidas finales. Ningún commit/push/deploy autorizado en esta ronda.
