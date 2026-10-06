# Validación externa de Altoque Preview — 2026-10-06

## Resultado y límites

Checkpoint remoto: `f0cd1e9bfc490c467da9e7aface97b12ce94ce07`.
Deployment: `dpl_C26qJZeKFG5z1qGYk1yxYJFhTcKC`, READY, target null / Preview.
URL: https://altoque-1cbpmiwfh-juanprogamer597-5269s-projects.vercel.app

Se completaron migración, smoke, Auth por HTTP protegido, cliente/profesional y admin/RBAC con infraestructura real. El click desde Gmail reveló un **P1 confirmado** que el transporte OIDC no ejercitaba: Vercel SSO elimina el parámetro `token` al preparar el retorno. Existe un fix local probado; **todavía no está publicado ni verificado de extremo a extremo en el Preview**. La ronda no declara cerrado ese bloqueo.

No hubo staging, commit, push ni deployment nuevo. Production, DNS, dominios, variables Vercel/Resend y schema/migraciones locales permanecen intactos. La única modificación remota de schema fue aplicar la migración existente expresamente autorizada en Preview. La instrumentación diagnóstica actual permanece intacta.

## 1. Identidad y migraciones

- Proyecto Neon: `muddy-dawn-68115975`.
- Preview confirmado por metadata y por identidad PostgreSQL en transacción READ ONLY: `br-wandering-pine-auzjlfe8` / `ep-flat-violet-au1e8xde`.
- Production excluida: `br-spring-paper-auff9g85` / `ep-steep-hall-au81p0co`. No se abrió conexión a su base.
- Conexiones privadas guardadas fuera del repositorio, en `/Users/juankingss/.config/altoque/preview-validation.env`, permisos 600. No se imprimieron valores ni se cambió `.env`.
- Antes del deploy: las dos primeras migraciones estaban terminadas, sin rollback y con checksums correctos. La tercera era la única pendiente.
- Prisma migrate deploy: exit 0; aplicada únicamente `20260908120000_add_file_table`.
- Postcheck READ ONLY: tres migraciones exitosas, checksums coincidentes, `public.file`, diez columnas, cuatro índices, PK y FK con cascades esperados. El índice parcial de un trabajo activo por profesional permanece válido y listo.
- Prisma migrate status posterior: exit 0, schema actualizado, cero pendientes.

Checksums SHA-256 revisados y confirmados:

| Migración | Checksum |
| --- | --- |
| `00000000000000_init` | `431243b782da5954046bccead86c9ff8d06be0566f15dcfe5bd7c1fce44cb2dd` |
| `20260907192000_add_account_issuer` | `6eb4a293e4bdd2087c03cd35f5ebfdde6ec9c2c98ec96fb12530b495c2dbdc08` |
| `20260908120000_add_file_table` | `498730f6a753bf79a4f284474e426caf155607cffab63b0dbd969b6f80a4efb5` |

Una comprobación transitoria se detuvo porque esperaba solamente dos constraints de `file`. El catálogo también enumera ocho NOT NULL. La inspección posterior confirmó que PK/FK y columnas eran correctas; se corrigió el comprobador efímero, sin repetir deploy ni modificar schema.

## 2. Smoke y logs

| Ruta | Resultado |
| --- | --- |
| `/` | 200; landing observada también en navegador |
| `/api/v1/healthz` | 200, conexión funcional normal |
| `/api/v1/categories` | 200; 22 categorías |
| `/api/v1/zones` | 200; nueve zonas |
| `/api/v1/providers` | 200; lista vacía inicial y después de cuarentena |
| `/api/v1/auth/get-session` sin sesión | 200, null |
| `/api/v1/me` y `/api/v1/admin/users` sin sesión | 401 esperado |
| Ruta API inexistente | 404 NOT_FOUND esperado |

No se observó 5xx ni FUNCTION_INVOCATION_FAILED en las llamadas E2E. La consulta final de errores de runtime sobre los últimos 30 minutos no devolvió entradas. Una consulta de 90 minutos falló en el conector; no se interpreta ese fallo como ausencia de errores.

La muestra diagnóstica inicial registró diez correlaciones con finish y close; nueve tenían las siete etapas completas en el resultado limitado a 100 registros. La décima carecía de un registro app_fetch_start en la muestra, pero tenía terminación. No se afirma que esta muestra sea una captura completa del historial.

En finish: headersSent/writableEnded/writableFinished true y destroyed false. En close: los primeros tres true y destroyed true. Cero excepciones diagnósticas y cero self-tests Prisma en esa muestra. El SELECT 1 de healthz es funcional, no el diagnóstico automático suprimido.

El incidente histórico FUNCTION_INVOCATION_FAILED sigue **no reproducido / causa no determinada / bajo observación**.

## 3. Better Auth y Resend

Tres cuentas de prueba identificables; cuatro correos estrictamente necesarios: tres verificaciones y una recuperación. Resend informó Delivered para los cuatro. Se inspeccionaron privadamente mensajes y enlaces; el origen de verificación/reset correspondía al Preview único. El correo contiene el botón profesional «Verificar mi correo».

Verificado sobre el deployment real mediante OIDC del mismo proyecto:

- Registro 200: usuario no verificado, token null y sin sesión.
- Login previo a verificación: 403 EMAIL_NOT_VERIFIED.
- Verificación: 302 y cookie; get-session y me confirman email verificado y sesión.
- Logout 200 y acceso posterior 401; login posterior 200.
- Recuperación enviada realmente; reset 200, token reutilizado 400 INVALID_TOKEN, contraseña antigua 401 y sesión previa revocada.
- Login con contraseña nueva 200; cambio de contraseña 200; otra sesión revocada, sesión actual conservada y revoke-other-sessions 200.
- Un intento adicional recibió 429. Se respetó el límite; después de la espera, el login con la última contraseña pasó.
- Cuenta E2E suspendida temporalmente: sesión existente 403 y login 403 ACCOUNT_INACTIVE. Se restauró para continuar y posteriormente se puso en cuarentena.

RESEND_API_KEY, EMAIL_FROM, BETTER_AUTH_SECRET, DATABASE_URL y ALTOQUE_DIAG figuran en los nombres de variables de este deployment Preview. Sus valores no se imprimieron. No se modificaron variables ni protección. El acceso usa un OIDC development temporal del mismo proyecto; no se creó automation bypass.

### P1 — pérdida de token durante el primer SSO

Cadena observada con valores ficticios, sin usar JWT reales ni modificar usuarios:

1. Better Auth, template HTML/texto, JSON hacia Resend y adaptador conservan el token.
2. El primer redirect del deployment hacia Vercel SSO conserva token y callbackURL dentro del destino codificado.
3. **La respuesta 307 de vercel.com/sso-api ya elimina token del Location de retorno**, conservando callbackURL y la credencial privada de protección.
4. El gateway establece la cookie de protección y redirige nuevamente; Better Auth recibe la ruta sin token y responde 400 VALIDATION_ERROR, igual a la captura del usuario.
5. Se reprodujo con marcador corto y JWT ficticio. Ningún salto API sirvió HTML/SPA. Con OIDC o autorización ya establecida, el marcador sí llega y Better Auth lo rechaza como token inválido.
6. La misma prueba de SSO confirmó que `verification_token` sobrevive al retorno.

Fix local: usar `verification_token` solamente como nombre de transporte en el correo, y convertirlo internamente al parámetro oficial `token` exclusivamente en GET de la ruta de verificación. Better Auth conserva generación, firma, expiración, verificación y sesiones. Requests legacy sin alias mantienen el mismo Request; POST/reset/otras rutas no se reconstruyen. Alias vacío, duplicado o combinado con token produce 400 genérico sin valores sensibles. Callback y query mantienen su semántica, aunque URLSearchParams pueda normalizar el encoding.

**Pendiente obligatorio:** aprobación de commit/push para Preview automático y repetición con un correo nuevo desde Gmail atravesando el primer SSO. Los mensajes antiguos conservan el formato anterior. No se presenta el fix como verificado remotamente.

## 4. Cliente y profesional

Comprobaciones reales por API del deployment:

- Direcciones: lista propia vacía, alta, edición, lectura persistente; lectura/edición/borrado ajenos 404. Solicitud con dirección ajena 404. El borrado exitoso propio está cubierto localmente; no se ejercitó remotamente.
- Catálogo real y creación de solicitud ficticia 201/searching.
- Perfil profesional creado pending_verification; disponibilidad e inbox 403 hasta aprobación.
- Aprobación administrativa real e idempotente; Online persistió en consultas posteriores con inbox vacío 200/data[] y active-job null.
- Inbox previo a claim sin dirección exacta; lectura de detalle cliente por profesional/otro cliente 403.
- Claim 200; repetición 409 REQUEST_ALREADY_CLAIMED.
- Dirección exacta disponible sólo en active-job del asignado; otro profesional recibe job null y no puede cambiar estado (403).
- Transiciones on_the_way → arrived → in_progress → completed, todas 200; confirmación cliente 200 y valoración 201. Segunda valoración 409.
- Lectura/cancelación/confirmación/valoración ajenas 403.
- Solicitud adicional cancelada por su dueño; cancelación 200 y estado persistente cancelled.
- Offline persistió después de finalizar el servicio.

El recorrido de negocio se verificó por HTTP contra la aplicación desplegada. En navegador se observaron landing/categorías y login/acceso administrativo; no se afirma automatización completa de todos los formularios cliente/profesional ni de móvil. La paginación API administrativa se ejercitó con páginas 1/2 y limit 2; la navegación UI multipágina con dataset grande permanece sin verificar en esta ronda.

No se implementaron pagos, uploads, schema nuevo ni onboarding documental. Historial profesional/rechazo persistente, archivos y otros hallazgos históricos continúan pendientes de sus rondas específicas.

## 5. Admin, cuarentena y CI

### P1 — guard obsoleto del bootstrap

El guard administrativo conservaba los IDs históricos, ahora Production. No se ejecutó contra ese destino. Se corrigió localmente a la identidad Preview actual y se añadieron diez regresiones independientes contra Production y combinaciones mixtas.

Bootstrap dedicado ejecutado únicamente sobre Preview verificado, para un administrador **E2E**, con credenciales generadas privadas y suministradas mediante variables del proceso. Usuario Better Auth real, role admin, admin_profile super_admin y email verificado. Repetición con otra contraseña de entrada no duplicó usuario ni cambió el hash existente; login con la original pasó. No se creó la cuenta personal del propietario: sus credenciales siguen pendientes de provisionamiento privado futuro.

Admin: login/session/role y acceso UI a #/admin; métricas, usuarios, proveedores, solicitudes, audit, timeline y lista de disputas 200. Metadata de páginas 1/2 correcta. Customer sin permisos 403; administrador E2E reducido temporalmente a support puede leer users pero no aprobar proveedores (403); después se restauró.

Cuarentena final reversible, exclusivamente IDs creados durante esta ejecución:

- Cuatro cuentas E2E bloqueadas.
- Dos perfiles profesionales ocultos/rejected y Offline.
- Cinco sesiones revocadas.
- Solicitudes, valoración y auditoría ficticias conservadas e identificables.
- No se borraron datos ni catálogos existentes; credenciales/cookies/tokens transitorios del harness se retiraron de su estado privado.
- Directorio público posterior: 200, cero profesionales visibles, igual que al iniciar.

### P2 — CI inválido antes de jobs

[Run 37521671667](https://github.com/JuanReyes0126/Altoque/actions/runs/37521671667): push master, SHA f0cd1e9, completed/failure, cero jobs. La anotación original no fue accesible.

El workflow usa runner.temp dentro de job.env, donde ese contexto no está permitido. Actionlint 1.7.12 reprodujo el original con exit 1 y ese diagnóstico; el fix local usa github.run_id/run_attempt para una ruta aislada y obtiene exit 0. [Contextos oficiales](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability).

No se hizo dispatch/re-run/push. **CI remoto sigue fallido** hasta publicar y comprobar la corrección.

## 6. Archivos y validación final

Cambios locales, sin staging:

- `.github/workflows/ci.yml`
- `docs/admin-bootstrap.md`
- `server/database/seeds/safety.ts`
- `server/tests/admin-bootstrap.test.ts`
- `server/auth/verification-link.ts` (nuevo)
- `server/auth/email.ts`
- `server/index.ts`
- `server/tests/verification-link.test.ts` (nuevo)
- `server/tests/email.test.ts`
- Este informe (nuevo).

32 regresiones nuevas respecto del checkpoint: diez de guard administrativo y 22 de verificación/reset. La prueba de verificación usa Better Auth real con adapter en memoria, modela la transformación observada del SSO, demuestra el 400 antiguo y verificación/sesión por alias, y rechaza JWT inválidos sin emitir sesión. HTML/texto y ambos anchors preservan los valores; no hay logs de secretos. No reemplaza la prueba del nuevo deployment.

| Validación final del código | Resultado |
| --- | --- |
| npm run typecheck | Exit 0 |
| npm run test:offline | 461 passed, 262 skipped; 32 suites passed, 24 skipped; 19.20 s |
| npm run test:integration | 723/723; 56/56 suites; 23.67 s |
| npm run build | Exit 0; 1.41 s; sin warnings |
| git diff --check | Exit 0 |
| npm audit | Exit 1; tres entradas HIGH, cero critical; sin remediación automática |

La integración usó exclusivamente PostgreSQL temporal en 127.0.0.1 y verificó 27 tablas vacías al finalizar. No usó Neon para tests destructivos. npm audit mantiene la cadena prisma/@prisma/config/deepmerge-ts; no se cambiaron versiones ni lockfile y no se ejecutó audit fix.

Mini-auditoría independiente del código: sin nuevos blockers, secretos, cambios de schema/migraciones ni de instrumentación. Index vacío; ambos stashes intactos. `.env` ignorado y no tracked. No se afirma cierre remoto de los fixes locales.

## 7. Calificación y siguiente barrera

Calificación del candidato local, apoyada en validación real pero con el click Gmail/SSO pendiente de publicación/retest:

| Categoría | Nota | Límite principal |
| --- | --- | --- |
| Arquitectura | 7.5 | Flujos operativos y vistas grandes pendientes |
| Backend/API | 8.4 | Archivos, notificaciones e historial profesional incompletos |
| Base de datos | 8.2 | Preview sincronizado; faltan decisiones de integridad y restore |
| Seguridad | 7.7 | Cadena HIGH, rate limiting distribuido y controles de archivos |
| Auth/autorización | 8.2 | Fix SSO sin prueba desplegada; race extrema de suspensión residual |
| Frontend/UX | 7.6 | Falta E2E completo de formularios/móvil y pulido visual separado |
| Testing | 8.3 | CI remoto fallido; falta regresión browser de primer SSO publicada |
| Performance | 7.3 | Sin pruebas de carga ni medición Web Vitals/contención |
| Mantenibilidad | 7.5 | Contratos duplicados, any y componentes grandes |
| Preparación Production | 6.3 | CI, verificación SSO, archivos, observabilidad/restore y pagos pendientes |

Nota técnica global: **7.7/10** (promedio 77.0/10). Production readiness: **6.3/10**; no se autoriza ni recomienda promoción automática.

Siguiente barrera: revisar estos fixes, autorizar commits/push y Preview automático; comprobar CI real y repetir correo/click/primer SSO con una cuenta nueva. Después preparar la cuenta personal administrativa con secretos privados y un nuevo guard de identidad. Production permanece fuera de alcance.
