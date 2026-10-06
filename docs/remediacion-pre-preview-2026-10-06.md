# Altoque · remediación pre-Preview

Fecha: 6 de octubre de 2026, America/Santo_Domingo. Base: `bd4b44a`.
Este informe complementa la auditoría aceptada; no altera su diagnóstico histórico.

La ronda se implementó en el orden A03 → A18 → A05 → A20 → A01/A02, con pruebas relevantes al cerrar cada bloque. HEAD permanece en `bd4b44a`; hay cambios locales sin staging ni commit. No hubo push, deploy, bootstrap/seed remoto, migraciones remotas ni operaciones sobre Neon, Vercel, Production o DNS.

## Resultado por hallazgo

| Hallazgo | Resultado comprobado | Evidencia |
| --- | --- | --- |
| A03 · P2, ranking incorrecto | Corregido. PostgreSQL calcula AVG/COUNT y aplica ORDER BY global antes de LIMIT/OFFSET. Después solo se hidratan los IDs de esa página, conservando su orden SQL. | `server/providers/public-directory.ts:38`; `server/routes/providers-public.ts:21,47`; 6 regresiones de integración. |
| A18 · P2, navegación administrativa ausente | Corregido en usuarios, proveedores, solicitudes, disputas y auditoría. Una consulta de 20 registros por página; total/rango y anterior/siguiente; loading/error/vacío/retry; descarte de respuestas obsoletas y recuperación si desaparece la página actual. | `src/features/admin/AdminHome.tsx`; `AdminPagination.tsx`; `use-admin-pagination.ts`; 18 pruebas offline y 17 de integración. |
| A05 · P2, contenido de demo presentado como real | Corregido en la landing. Retirados cifras, actividad EN VIVO, precios/ETAs ficticios, personas, testimonios, contactos y promociones no respaldadas. Categorías, zonas y perfiles proceden del API; vacío/error no usan fallback de demo. Copy explica el flujo real de solicitud/asignación. | `src/features/landing/Landing.tsx`; 10 regresiones offline y comprobación visual con fixtures locales. |
| A20 · P3, JSON inválido convertido en 500 | Corregido mediante parser común en 14 handlers. Solo SyntaxError producido por JSON.parse es 400; fallos de lectura y DB mantienen 500. Auth, email verificado y permisos preceden el parsing. | `server/lib/json.ts`; routes requests/providers/disputes/addresses/admin; 16 pruebas offline y 53 de integración. |
| A01 · P1, cadena crítica tinypool/Vitest | Remediado en el árbol instalado. Vitest/mocker 4.1.11; tinypool eliminado. Vitest pasa a devDependencies. | `package.json`, `package-lock.json`; npm ls, audit y suites completas con Vitest 4.1.11. |
| A02 · P2, demás advisories | Parcialmente remediado: Hono 4.13.7, source-map-js 1.2.2, Router DOM 6.30.6; retirada de UUID sin consumidores. Quedan la cadena Prisma/deepmerge y dos advisories heredados de Router. | Árbol final y npm audit: 0 critical, 3 high, 2 moderate. No se consideran resueltos los avisos restantes. |

### A03: filtros, privacidad e integridad

Se preservan categoría, zona, disponibilidad, perfil aprobado, usuario activo y email verificado. Los filtros/limit/offset son parámetros SQL; el orden usa exclusivamente fragmentos constantes. EXISTS para servicios/zonas evita multiplicar reseñas al combinar relaciones.

Ranking, count e hidratación usan una transacción RepeatableRead. Los empates tienen un ID de desempate estable. El DTO mantiene su selección pública explícita y no incorpora email, teléfono, usuario privado ni referral. Tanto el directorio como `/providers/available` usan ranking global. El detalle público permanece fuera de esta modificación.

Las regresiones incluyen un profesional antiguo con mayor rating/count que quedaba fuera de la antigua primera página; ahora aparece primero globalmente. Cubren páginas sucesivas, limit 1, filtros, usuarios/perfiles inelegibles, ausencia de PII, entradas de filtro hostiles, empates, cero reseñas y página fuera de rango.

### A18: comportamiento de páginas

El frontend usa la metadata existente: page, limit, total y pages. Valida números enteros, coherencia de página/límite/total y que las filas no excedan lo permitido. Una respuesta inválida muestra error recuperable, no una tabla vacía engañosa. Durante carga/error oculta filas anteriores; anterior/siguiente respetan límites y operaciones en curso.

Cambiar página/reintentar incrementa la revisión de consulta. Respuestas de consultas canceladas no publican datos, errores ni saltos de página. Si disminuye el total y la página desaparece, se consulta la última página válida. El backend conserva filtros/permisos y añade ID al desempate de fechas. No se carga todo el dataset.

### A05: alcance de la landing

La búsqueda usa los IDs reales recibidos del catálogo. Los perfiles proceden del directorio público aprobado/disponible, ordenado por rating y limitado a seis; se puede filtrar por zona real. Las reseñas mostradas corresponden al DTO y cero reseñas se presenta como «Aún sin reseñas». La disponibilidad se describe como estado al consultar, no garantía de aceptación.

Se conserva íntegramente el AuthSheet de HEAD, comprobado mediante comparación del bloque completo. No se cambió registro, login ni verificación de email. La landing profesional de registro ya tenía copy del flujo real y no necesitó cambios. Los mocks legacy de otros módulos no se eliminaron en esta ronda.

### A20: errores que permanecen distintos

`readJsonBody` lee el body antes de entrar al catch del parser. Por tanto, un SyntaxError de lectura o de una consulta posterior no se clasifica como JSON inválido. JSON válido sigue sujeto a los schemas Zod de cada ruta. El mensaje 400 es común y no conserva cuerpo ni detalle del parser.

Las regresiones recorren los 14 handlers con JSON truncado, JSON válido semánticamente inválido y ausencia de sesión; prueban RBAC/email, tres fallos DB y dos fallos de lectura que conservan 500. Comprueban que no se creen solicitudes/perfiles/direcciones/disputas/auditorías al rechazar cuerpos y que body/detalles internos no aparezcan en respuestas ni logs.

## Dependencias: análisis y decisiones

Antes de modificar versiones se revisaron npm ls, metadata del registry, engines/peers, configuración/APIs de tests y advisories primarios. Node 24.15.0, Vite 6.4.3 y el peer opcional de Better Auth 1.7.1 admiten Vitest 4.1.11. No se usan poolOptions, pools personalizados ni APIs eliminadas identificadas en la revisión estática.

Vitest 3.2.7 es la última 3.x disponible y mantiene la cadena afectada. El major 3→4 era necesario para eliminar tinypool; no se forzó tinypool 2 debajo de Vitest 3. Vitest 4 reescribe el pool sin tinypool. La compatibilidad quedó comprobada por typecheck y las 487 pruebas con el runner existente, sin cambiar su aislamiento ni configuración. [Guía oficial de migración](https://v4.vitest.dev/guide/migration).

| Paquete | Antes instalado | Después instalado | Decisión |
| --- | --- | --- | --- |
| vitest / @vitest/mocker | 3.2.7 | 4.1.11 | Major justificado; Vitest ahora devDependency y pin exacto. |
| tinypool | 1.1.1 | Ausente | Eliminado por el nuevo árbol de Vitest. |
| hono | 4.13.4 | 4.13.7 | Patch exacto; cubre los cuatro avisos del audit previo. |
| source-map-js | 1.2.1 | 1.2.2 | Patch transitivo permitido por PostCSS/Tailwind; sin override ni dependencia directa nueva. |
| react-router-dom / react-router | 6.30.4 | 6.30.6 | Patch de DOM y paquete alineado. Quedan avisos heredados que requieren 7.18.0. |
| @remix-run/router | 1.23.3 | 1.23.4 | Patch de la misma cadena Router 6. |
| uuid / @types/uuid | 9.0.1 / 9.0.8 | Ausentes | Sin referencias de código ni consumidores transitivos; retirada evita un major innecesario. |
| prisma / @prisma/client / @prisma/config | 6.19.3 | 6.19.3 | Sin cambios de rango ni versión instalada. |
| deepmerge-ts | 7.1.5 | 7.1.5 | No override major bajo Prisma. |
| better-auth / vite / react | 1.7.1 / 6.4.3 / 18.3.1 | Iguales | Preservados frente al lock de HEAD. |

Cambios transitivos mayores de Chai, std-env, es-module-lexer y tinyrainbow pertenecen al árbol de Vitest 4; no se actualizaron majors de la aplicación. npm ls no presenta peers inválidos. También desaparece vite-node por el nuevo runner. Instalación con `--ignore-scripts`; sin npm audit fix, --force, downgrade de Prisma, prerelease ni major de Router.

### Advisories que permanecen

Cinco entradas de paquete representan tres advisories únicos; las severidades heredadas no son vulnerabilidades independientes.

| Advisory / paquetes | Severidad npm | Exposición observada y versión requerida |
| --- | --- | --- |
| GHSA-ggr8-5vv4-36mx: stack exhaustion por grafos recursivos. deepmerge-ts 7.1.5 → @prisma/config 6.19.3 → prisma 6.19.3 | 3 HIGH heredados | Uso encontrado en CLI/configuración Prisma, sin cadena HTTP de Altoque que le entregue un grafo cíclico. JSON de red no representa ciclos. deepmerge-ts ≥8.0.0 requiere evaluar compatibilidad de Prisma. Prisma figura en dependencies: el aviso también aparece con `npm audit --omit=dev`; no se declara ausente de la instalación de Production. [Mantenedor](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx). |
| GHSA-wrjc-x8rr-h8h6: redirect externo por paths con backslash en Link/useNavigate. react-router 6.30.6, heredado por DOM 6.30.6 | MODERATE | Frontend runtime. Navegación interna controlada revisada; no se identificó destino externo no confiable. Corrección ≥7.18.0: migración major a revisar aparte. [Mantenedor](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6). |
| GHSA-337j-9hxr-rhxg: constructor injection en deserializeErrors de hidratación SSR. Mismos dos paquetes Router | MODERATE, mismas entradas | Altoque usa HashRouter + createRoot en Declarative Mode, sin hidratación SSR. El advisory excluye ese modo; permanece en audit del árbol. Corrección ≥7.18.0. [Mantenedor](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg). |

El propio aviso de Router DOM 6 fue parcheado; no equivale a resolver todos los avisos de Router. npm recomienda actualmente Prisma 6.12.0 y Router DOM 7.18.4 con force: esas sugerencias no se ejecutaron. Los avisos restantes deben remediarse/revisarse antes de Production.

## Tests añadidos y verificación

| Suite nueva | Pruebas | Cobertura principal |
| --- | --- | --- |
| provider-ranking.integration.test.ts | 6 | Ranking global fuera de la antigua primera página, filtros, privacidad, empates, vacío y available. |
| admin-pagination.test.ts | 18 | Controles/estados, metadata inválida, límites, contratos de cinco endpoints y cancelación de respuestas. |
| admin-pagination.integration.test.ts | 17 | Cinco listas, páginas sin solapamiento con fechas empatadas, límites, fuera de rango y RBAC. |
| landing-content.test.ts | 10 | Ausencia de demo, IDs reales, datos recibidos, ratings, vacío/loading/error y escape de HTML. |
| json-body.test.ts | 16 | JSON inválido/válido, errores de lectura/parser ajenos y ausencia de body sensible en error. |
| json-body.integration.test.ts | 53 | Los 14 handlers, 400/401/403, errores DB/lectura 500, logs y ausencia de escrituras. |
| hono-query.test.ts | 4 | Query no interpreta parámetros después de fragmentos; `%23` codificado sigue siendo dato válido. |

Total añadido: **124 pruebas en siete suites**. El checkpoint tenía 363; ahora hay 487. Las fixtures de integración usan IDs propios y borran exclusivamente sus datos; el runner verifica cleanup de todas las tablas.

### Validaciones relevantes al cerrar bloques

- A03: typecheck exit 0; ranking + providers-public: 22/22 integración local.
- A18: typecheck exit 0; 31/31 offline relevantes; 56/56 integración local de paginación/RBAC/safety/disputes; diff check 0.
- A05: typecheck exit 0; 37/37 offline relevantes (landing/email/password/client API). La suite landing volvió a pasar 10/10 usando StaticRouter para SSR sin warnings de useLayoutEffect; diff check 0.
- A20: typecheck exit 0; 16/16 offline y 53/53 integración local; diff check 0.
- A01/A02: todas las validaciones completas siguientes ejecutadas con el árbol actualizado; cuatro regresiones Hono incluidas.

### Validación final exacta

| Comando | Exit | Resultado |
| --- | --- | --- |
| npm run typecheck | 0 | tsc --noEmit sin errores. |
| npm run test:offline | 0 | 271 passed, 216 skipped de 487; 27 archivos passed, 21 skipped de 48; 23.65 s. |
| npm run test:integration | 0 | 487/487 passed; 48/48 archivos; 30.06 s. Las 27 tablas de aplicación vacías al terminar. |
| npm run build | 0 | Vite 6.4.3, 65 módulos, 1.84 s. HTML 1.47 kB / 0.80 gzip; CSS 48.46 kB / 9.21 gzip; JS 330.61 kB / 94.70 gzip. |
| git diff --check | 0 | Sin errores de whitespace, repetido al cerrar este informe. |
| npm audit | 1 | 0 critical, 3 high, 2 moderate: cinco entradas de paquete, tres advisories únicos pendientes. |

Los skips offline corresponden a pruebas que requieren DB; la integración las ejecutó todas. Los tiempos se registran como evidencia de esta ejecución, no como benchmark comparable de rendimiento.

La integración verificó PostgreSQL exclusivo en 127.0.0.1 y no heredó credenciales Neon. Aplicó las tres migraciones existentes y migrate status solamente en la DB temporal recién creada; schema up to date. No se creó ni editó ninguna migración. Runner y configuración de aislamiento permanecen iguales a HEAD. Build se ejecutó con entorno permitido y ALTOQUE_SAFE_VALIDATION para evitar cargar archivos `.env`.

El bundle JS anterior era 347.51 kB / 98.17 gzip; el nuevo es 330.61 / 94.70. Esto demuestra menor tamaño de build, no latencia/cold-start ni rendimiento de consultas en Production.

### Comprobación visual local y sus límites

Harness temporal fuera del repo, Vite sin config/env files, sin backend/DB/proxy remoto. La API del harness solo devolvía fixtures; cualquier método distinto de GET era rechazado con 405. Se comprobaron landing cargada, navegación a Servicios, categorías/perfiles recibidos, filtro por zona y ausencia de errores de consola en landing.

En usuarios se observaron consultas page 1/2/3 con limit 20; rangos 1–20/21–40/41–41 de 41, primera/última página y Siguiente desactivado al final. Las demás listas no tenían fixtures completos en el harness y devolvieron errores de fixture; no se clasifican como bugs confirmados de Altoque. Un sign-out interactivo fue rechazado por el harness (405), sin invocar Better Auth ni escribir datos reales. La integración sí verificó los cinco endpoints administrativos reales contra PostgreSQL temporal.

El harness requirió ajustes por rutas temporales macOS, log de requests observado por Vite y DTO de métricas incompleto; fueron problemas del harness, corregidos fuera del repo. No son regresiones del producto. No se presenta esta revisión como E2E completo navegador + DB, validación móvil completa ni revisión de Vercel. Tabs creados para QA cerrados y servidor temporal detenido; evidencia visual fuera del repo.

## Mini-auditoría final específica

Revisión independiente adicional de SQL/filtros/DTO, hooks/metadata/cancelación, landing/AuthSheet, parser/rutas/fixtures y árbol/peers. **Sin bloqueadores P1/P2 ni nuevas regresiones confirmadas en los cambios de esta ronda.** Esto no cierra hallazgos anteriores fuera de alcance.

| Pendiente / tipo | Evidencia y límite |
| --- | --- |
| A04 · P2, riesgo de performance parcialmente reducido | El listado ya no carga todas las reviews en JS; el detalle sigue consultando todos los ratings (`server/routes/providers-public.ts:127`). El agregado global (`server/providers/public-directory.ts:38`) y OFFSET no tienen benchmark/EXPLAIN con volumen. No marcado como resuelto. |
| P2, riesgo residual de concurrencia administrativa | Filas y total se consultan por separado (`server/routes/admin.ts:83,168,266,328`; `disputes.ts:33`). Escrituras simultáneas pueden cambiar metadata. Frontend valida y permite reintentar/clamp; no se promete snapshot entre páginas. Sin reproducción de un fallo nuevo en esta ronda. |
| A01/A02, dependencias | A01 resuelto en árbol/suites; A02 parcial por cadena Prisma y Router. No se fuerza resolución incompatible para conseguir audit exit 0. |
| P3, mejora de testing | Añadir E2E persistente navegador/API/DB y CI; la revisión visual con fixtures y SSR/contratos no cubre todo el ciclo React ni dispositivos reales. |
| A27 · P3 visual | Switch Online/Offline expresamente pendiente. ProApp/ProviderPanelStates/kit no tienen diff; no corregido aquí. |

Escaneo de tracked y nuevos sin abrir `.env`: 161 archivos de texto revisados antes de añadir este informe. Coincidencias PostgreSQL preexistentes clasificadas como placeholders o fixtures; ninguna URL privada nueva, clave privada o secreto literal reconocible en los 22 archivos de código/config/tests afectados. El informe también se escaneó al cierre. Esto es inspección de patrones y diff, no garantía universal de ausencia de toda clase de secreto.

`.env` continúa ignorado y no tracked. Index vacío. Ambos stashes conservan sus hashes anteriores:

- stash@{0}: `9ca0850fa010f49e14d485b1c2aa89f8a181feed`
- stash@{1}: `c98a2e8b0ed75649e31f2b5204de0114ef9bc464`

No se eliminaron backups/stashes existentes. Esquema, migraciones, uploads/archivos, expiración/notificaciones, pagos, switch y bootstrap remoto permanecen fuera de alcance y sin cambios.

## Archivos afectados

Diez archivos modificados y trece nuevos, incluido este informe: **23 archivos**. Todos los cambios permanecen sin staging.

| Grupo | Archivos |
| --- | --- |
| A03 | `server/routes/providers-public.ts`; nuevo `server/providers/public-directory.ts`; nueva suite `server/tests/provider-ranking.integration.test.ts`. |
| A18 | `src/features/admin/AdminHome.tsx`; nuevos `AdminPagination.tsx`, `admin-pagination.ts`, `use-admin-pagination.ts` en esa carpeta; orderBy de `server/routes/admin.ts` y `server/routes/disputes.ts`; dos nuevas suites admin-pagination. |
| A05 | `src/features/landing/Landing.tsx`; nueva `server/tests/landing-content.test.ts`. |
| A20 | Nuevo `server/lib/json.ts`; `server/routes/requests.ts`, `providers.ts`, `disputes.ts`, `addresses.ts`, `admin.ts`; dos nuevas suites json-body. Los hunks A18 de admin/disputes se conservan. |
| A01/A02 | `package.json`, `package-lock.json`; nueva `server/tests/hono-query.test.ts`. |
| Informe | Nuevo `docs/remediacion-pre-preview-2026-10-06.md`. La auditoría anterior permanece intacta. |

### git status --short

```text
 M package-lock.json
 M package.json
 M server/routes/addresses.ts
 M server/routes/admin.ts
 M server/routes/disputes.ts
 M server/routes/providers-public.ts
 M server/routes/providers.ts
 M server/routes/requests.ts
 M src/features/admin/AdminHome.tsx
 M src/features/landing/Landing.tsx
?? docs/remediacion-pre-preview-2026-10-06.md
?? server/lib/json.ts
?? server/providers/
?? server/tests/admin-pagination.integration.test.ts
?? server/tests/admin-pagination.test.ts
?? server/tests/hono-query.test.ts
?? server/tests/json-body.integration.test.ts
?? server/tests/json-body.test.ts
?? server/tests/landing-content.test.ts
?? server/tests/provider-ranking.integration.test.ts
?? src/features/admin/AdminPagination.tsx
?? src/features/admin/admin-pagination.ts
?? src/features/admin/use-admin-pagination.ts
```

## Calificación técnica comparativa

Se conservan las diez categorías y la media simple de la auditoría anterior. Las notas evalúan el proyecto completo, no solo el diff; verde local no equivale a preparación comercial demostrada.

| Categoría | Antes | Ahora | Qué mejoró / qué impide 10 |
| --- | --- | --- | --- |
| Arquitectura | 7.2 | 7.3 | Parser/directorio/paginación separados; siguen contratos duplicados/any, vistas grandes y legacy. |
| Backend/API | 7.4 | 7.9 | Ranking global, 400 consistente y listas auditables; faltan flujos operativos y optimización del detalle/contratos. |
| Base de datos | 7.8 | 7.8 | Sin cambios de esquema. Constraints anteriores siguen cubiertos; archivos/identidad, planes y restore pendientes. |
| Seguridad | 6.2 | 7.0 | Sin críticos en árbol, patches Hono/tooling y manejo de errores probado; quedan advisories, lectura privada/retención y pentest. |
| Autenticación/autorización | 7.7 | 7.7 | Conservada y con regresiones de precedencia adicionales; correo/cookies reales y bootstrap Preview no ejecutados. |
| Frontend/UX | 6.5 | 7.2 | Paginación real y landing honesta con estados; faltan funciones fuera de alcance, accesibilidad y pasada visual completa. |
| Testing | 7.2 | 7.6 | 487 pruebas y cleanup aislado, migración Vitest validada; falta CI/E2E persistente y dispositivos reales. |
| Performance | 6.2 | 6.8 | Listado agregado en DB, páginas acotadas y bundle menor; sin pruebas de carga/planes/Web Vitals/cold starts. |
| Mantenibilidad | 6.8 | 7.0 | Utilidades comunes, dependencias revisadas/pins, informe trazable; permanecen mocks legacy y tipos inconsistentes. |
| Preparación para Production | 5.0 | 5.7 | Bugs de esta ronda corregidos y crítico tooling eliminado; faltan dependencias restantes, integraciones externas, CI/alertas/restore/operación. |

**Nota técnica global: 7.2/10**, suma 72.0 / diez categorías, frente a **6.8/10**. Mejoró 0.4 puntos; no se atribuye mejora a autenticación o esquema que no cambiaron.

## Siguiente ronda, sujeta a aprobación

- Revisar el diff y autorizar organización/commits antes de cualquier push/Preview.
- Remediación específica de Prisma/deepmerge y Router 7 con análisis de compatibilidad, pruebas y sin downgrade automático.
- A04: agregado del detalle y medición de planes/volumen; mayor cobertura E2E/CI.
- A06/A07/A08: decidir lectura privada, compensación/retención y relaciones de archivos antes de arquitectura/migraciones.
- A09 y demás cambios de esquema: revisión separada compatible con Better Auth.
- A10: diseño de expiración y entrega/lectura de notificaciones; A11: decisión operativa de pagos reales.
- Correo Resend, cookies/dominio, almacenamiento y bootstrap admin Preview: validación externa separada y autorizada; volver a verificar branch/endpoint antes de escribir.
- A27 y pulido visual/UI/UX: pasada posterior; permanece pendiente.

Trabajo detenido para revisión. Sin commit, staging, push, deploy ni modificaciones remotas.
