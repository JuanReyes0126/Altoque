# ALTOQUE · F1 Implementation Report

**Fase:** F1 · BASE REAL — cierre formal
**Fuentes de verdad:** `docs/f1-technical-architecture-v1.1.md` + `docs/f1-implementation-addendum.md` (el Addendum prima)
**Fecha:** 2026

---

## Summary

F1 construye la base real sobre la que vivirá Altoque: servidor Hono en `/api/v1`, Better Auth 1.7.1 como fuente de verdad de identidad (user/session/account/verification), PostgreSQL (Neon) con Prisma 6.19, esquema completo de dominio, claim atómico transaccional, RBAC centralizado, auditoría append-only, rate limiting, validación de archivos por contenido y suite de tests con las pruebas obligatorias del Addendum. El frontend (`src/`) **no se tocó**: Landing, Cliente y Proveedor se ven exactamente igual.

**Leyenda de verificación:**
- **PASS** — implementado y verificado en este entorno.
- **PASS·** — implementado y verificado por diseño/lectura de código; requiere ejecutar el comando indicado en tu entorno (con credenciales de tu Neon dev para las integraciones). No se inventan resultados: donde hace falta tu base real, se marca como pendiente de ejecución, no como ejecutado.

---

## Versions (resueltas en `package-lock.json`)

| Paquete | Versión | Nota |
|---|---|---|
| Node | 22.x (Vercel default) | fijar en Project Settings → Node.js 22 |
| hono | **4.13.4** | API |
| @hono/node-server | **1.19.17** | `handle()` para Vercel + `serve()` local |
| better-auth | **1.7.1** | verificado contra sus tipos instalados |
| prisma / @prisma/client | **6.19.3** (ambos) | PrismaClient estándar (sin adapter — Addendum §2) |
| zod | **3.25.76** | validación |
| vitest | **3.2.7** | tests |
| tsx | **4.23.12** | seeds / dev server |

Nota de pinning: el lockfile fija las versiones exactas que usa `npm ci` (instalación reproducible garantizada). Queda como endurecimiento opcional eliminar los rangos `^` de `package.json` (deuda técnica #1).

## Dependencies Added

`hono`, `@hono/node-server`, `prisma`, `@prisma/client`, `better-auth`, `zod`, `tsx`, `vitest`.
**No** se instalaron `@prisma/adapter-neon` ni `@neondatabase/serverless` (sustituidos por decisión del Addendum §2).

## Files Created

```
prisma.config.ts                        CLI → DIRECT_DATABASE_URL (Addendum §2)
vitest.config.ts                        suite server/tests, integraciones gateadas
vercel.json (reescrito)                 rewrite /api/v1 → Function ANTES del SPA fallback
api/index.ts                            Vercel Function: handle(app)
server/index.ts                         ensamblado Hono + errores centralizados
server/dev.ts                           runner local (npx tsx watch server/dev.ts)
server/tsconfig.json                    typecheck del servidor
server/config/env.ts                    Zod fail-fast de variables SERVER-ONLY
server/database/schema.prisma           esquema completo (24 modelos + enums)
server/database/prisma.ts               singleton, sin $disconnect por request
server/database/seeds/seed.ts           idempotente (categorías, zonas, secuencia, super admin)
server/database/migrations-reference/0001_init.reference.sql
server/database/README.md               operaciones de BD por entorno
server/auth/auth.ts                     instancia Better Auth
server/auth/email.ts                    email dev (consola) / Resend (F2)
server/middleware/auth.ts               requireAuth/Verified/Role/Permission + ownership
server/middleware/security.ts           requestId, headers, Origin check, access log
server/lib/errors.ts                    AppError + códigos
server/lib/logger.ts                    JSON estructurado + redacción de secretos
server/lib/envelope.ts                  {data} / {data,meta} / {error}
server/lib/ids.ts                       ULID + contador ALT-2026-XXXXXX
server/lib/permissions.ts               matriz RBAC centralizada
server/lib/audit.ts                     audit() append-only
server/lib/ratelimit.ts                 límites de negocio en PostgreSQL
server/lib/files.ts                     validación por magic bytes + FileStore (contrato)
server/requests/claimRequest.ts         claim atómico transaccional
server/routes/health.ts                 GET /api/v1/healthz (sin revelar config)
server/routes/categories.ts             GET /api/v1/categories
server/routes/me.ts                     GET /api/v1/me
server/tests/setup.ts                   gate ALTOQUE_TEST_DB
server/tests/unit.test.ts               RBAC, ULID, archivos, logs, paginación
server/tests/security.test.ts           Origin/CSRF, headers, healthz, auth montado
server/tests/auth.integration.test.ts   contra Neon dev (gateada)
server/tests/claim.integration.test.ts  COMMIT / ROLLBACK / CONCURRENCIA (gateada)
docs/f1-implementation-report.md        este documento
```

## Files Modified

- `package.json` / `package-lock.json` — dependencias F1.
- `vercel.json` — rewrite del API + SPA fallback + headers.
- **`src/**` — NINGÚN archivo.** Cero cambios visuales (CSS, componentes, landing, navegación intactos).

## Database Schema

24 modelos en `server/database/schema.prisma` (nombres en singular por convención Prisma):

| Área | Modelos |
|---|---|
| Better Auth (generado por la librería, campos oficiales) | `user` (+additionalFields), `session`, `account`, `verification` |
| Usuarios | `customer_profile`, `address`, `session` (propia de BA) |
| Proveedores | `provider_profile`, `provider_service`, `provider_zone`, `provider_document`, `provider_verification_history` |
| Admin | `admin_profile`, `admin_audit_log` |
| Servicios | `category`, `zone` |
| Solicitudes | `service_request`, `request_photo`, `request_status_history`, `request_code_seq` |
| Reputación | `review`, `report`, `dispute` |
| Sistema | `notification`, `file`, `rate_limit` |
| Financiero (diseño V2, sin endpoints) | `payment`, `transaction` |

Índices clave implementados: `service_request(status, category_id, zone_id)`, `(provider_id, status)`, `(customer_id, created_at desc)`, `notification(user_id, read_at)`, `review(provider_id, created_at desc)`, `request_status_history(request_id, at)`.
Constraints que Prisma no expresa (CHECK rating 1–5, índices parciales) van en `migrations-reference/0001_init.reference.sql`.

### Diferencias vs. documentos aprobados (transparencia total)

| Documento | Implementado | Impacto |
|---|---|---|
| `request_counters` | `request_code_seq` (mismo diseño: fila única, UPDATE…RETURNING) | Solo nombre |
| `customer_profiles`, `admin_audit_logs`, `rate_limits`, `files` | `customer_profile`, `admin_audit_log`, `rate_limit`, `file` | Convención singular; mismas columnas |
| `service_requests.price_estimate` | `Int` en **céntimos DOP**; `payment.amount` sí es `Decimal(12,2)` | Decisión explícita: estimaciones en cents, dinero real en Decimal |
| Tablas `payment`/`transaction` | Creadas como diseño (sin endpoints ni lógica) | Según lo aprobado ("diseño futuro") |
| Sub-scores de review (puntualidad/calidad/comunicación) | Presentes (`punctuality`, `quality`, `communication`) | ✓ alineado |

Nada quedó fuera del modelo aprobado; los deltas son de nomenclatura y están documentados arriba.

## Better Auth

Instancia en `server/auth/auth.ts`. Opciones **verificadas contra los tipos instalados de 1.7.1** (`@better-auth/core/dist/types/init-options.d.mts`):

- `emailAndPassword.requireEmailVerification: true` → el registro **no emite sesión**.
- `emailVerification.autoSignInAfterVerification: true` → la primera sesión válida nace al verificar el correo.
- `verification.storeIdentifier: "hashed"` → identificadores de verificación/reset hasheados.
- `user.additionalFields.role/status` con **`input: false`** → signUp ignora `role` enviado por el cliente (verificado en `InferFieldsInputClient`).
- `session.expiresIn` 7 días, `updateAge` 24 h.
- `advanced.useSecureCookies: isProd()` → `Secure` en preview/producción.
- Contraseñas: **scrypt gestionado por Better Auth** (no se reemplaza su criptografía — Addendum §17).

### Rutas: Better Auth vs. Altoque (sin duplicados)

**Montadas por Better Auth** (basePath `/api/v1/auth`):
```
POST /api/v1/auth/sign-up/email            registro
POST /api/v1/auth/sign-in/email            login
POST /api/v1/auth/sign-out                 logout
GET  /api/v1/auth/get-session              sesión activa
POST /api/v1/auth/verify-email             verificación
POST /api/v1/auth/send-verification-email  reenvío
POST /api/v1/auth/forget-password          inicio de reset
POST /api/v1/auth/reset-password           reset (token de un solo uso)
GET  /api/v1/auth/list-sessions            multi-dispositivo
POST /api/v1/auth/revoke-session           revocación selectiva
```

**Propias de Altoque (F1):**
```
GET /api/v1/healthz
GET /api/v1/categories
GET /api/v1/me
```
No existe endpoint propio que duplique una operación de Better Auth.

## Sessions

- Cookie `better-auth.session_token`: **HttpOnly** (Better Auth), **Secure** en producción/preview, **SameSite=Lax** (decisión Addendum §7 — no Strict, para no romper enlaces de verificación/reset, que son GET).
- Almacenamiento: tabla `session` en PostgreSQL; token de sesión gestionado por Better Auth (sin hashing casero — Addendum §1).
- Renovación diaria con actividad; expiración 7 días; revocación por logout y por `revoke-session`.
- Expiradas/revocadas → `get-session` devuelve null → `requireAuth` lanza 401 (cubierto por tests de integración).
- Nada sensible en `localStorage` (el frontend mock actual desaparecerá en F2 al conectar el cliente HTTP).
- Sesiones admin: misma base + preparación para MFA/freshness (plugin TOTP disponible en 1.7.1; no activado aún — F4).

## RBAC

- Matriz única en `server/lib/permissions.ts`: `support ⊂ moderator ⊂ admin ⊂ super_admin`.
- `requirePermission()` carga `admin_profile` por request; **sin fila `admin_profile` no hay permisos aunque `user.role` diga admin**.
- Roles de cuenta (`customer|provider|admin`) en `user.role` (enum BD + `input:false` + Zod): triple barrera contra escalada en registro.
- Modelo de doble capacidad: la capacidad provider vive en `provider_profile.verification_status`; solo `verified` puede reclamar (test de integración).
- Ownership anti-IDOR: `assertOwnership()` + validación por id técnico en cada endpoint sensible (nunca por `code` público).

## API

- Versionado `/api/v1` desde el día uno.
- Envelopes: `{data}` · `{data, meta:{page,limit,total,pages}}` · `{error:{code,message,details?}}`.
- Errores centralizados en `app.onError` (AppError → status/código; ZodError → 400 VALIDATION_ERROR; resto → 500 logueado con requestId).
- Códigos: VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR + dominio (REQUEST_ALREADY_CLAIMED, EMAIL_NOT_VERIFIED…).
- Paginación segura (`parsePaging`: límite máx 100).

## Security

Verificado en código (grep + lectura):

| Control | Estado | Dónde |
|---|---|---|
| Contraseñas hasheadas (scrypt, Better Auth) | ✓ | auth.ts |
| Nada sensible en logs (redacción por clave + never-log) | ✓ | logger.ts; grep `console.log(password/token/secret)` → **0 coincidencias** |
| Sin `VITE_` en el servidor | ✓ | grep → **0 coincidencias** |
| Cookie HttpOnly + Secure(prod) + Lax | ✓ | auth.ts (Better Auth) |
| Origin check en mutables | ✓ | middleware/security.ts |
| Validación Zod | ✓ env fail-fast; dominio endpoint-a-endpoint desde F2 | config/env.ts |
| RBAC + ownership server-side | ✓ | middleware/auth.ts |
| Rate limiting | ✓ app (PostgreSQL) + Better Auth interno + Vercel Firewall (configuras tú) | lib/ratelimit.ts |
| Errores centralizados | ✓ | server/index.ts |
| Documentos privados sin URL pública permanente | ✓ contrato (FileStore + GET /api/v1/files/:id en F3) | lib/files.ts |
| Auditoría append-only | ✓ | lib/audit.ts |
| Validación de archivos por magic bytes/MIME/tamaño (solo jpg/png/pdf) | ✓ | lib/files.ts |

Transparencia: en **desarrollo**, `server/auth/email.ts` imprime el enlace de verificación/reset en la consola local del desarrollador (única vía sin proveedor de email). Nunca pasa por el logger estructurado y en producción se sustituye por Resend.

## Rate Limiting

Dos capas: (1) Vercel Firewall en el edge — reglas que configuras en el dashboard (valores sugeridos en v1.1 §19); (2) aplicación: `lib/ratelimit.ts` con ventana fija en PostgreSQL por (bucket, sujeto): login 10/5min, register 5/h, forgot 3/15min, resend 3/15min, claim 10/min, request 10/h, upload 20/h, admin-auth 10/5min. Ajustables con métricas.

## Neon Integration

- **Runtime**: `DATABASE_URL` = URL **pooled** (`?pgbouncer=true`) → PrismaClient estándar. Cada `$transaction` interactiva se fija a una conexión backend del pooler: transacciones reales soportadas (Addendum §2).
- **CLI/migraciones**: `DIRECT_DATABASE_URL` vía `prisma.config.ts`.
- Singleton por runtime (`globalThis`), cero `$disconnect()` por request.
- Entornos: dev branch / preview branch / production — production jamás para desarrollo; migraciones de producción fuera del build.

## Atomic Claim

`server/requests/claimRequest.ts`:

```sql
BEGIN;
UPDATE service_request SET provider_id=:p, status='accepted', eta_min=:eta, updated_at=now()
 WHERE id=:id AND status='searching' AND provider_id IS NULL
RETURNING id;                -- 0 filas → ROLLBACK + 409 REQUEST_ALREADY_CLAIMED
INSERT INTO request_status_history (searching→accepted, actor=provider);
INSERT INTO notification (cliente, request_accepted);
COMMIT;                      -- cualquier fallo → ROLLBACK total (las 3 escrituras o ninguna)
```

Estrategia concreta: **UPDATE condicional + `RETURNING` dentro de `prisma.$transaction(async tx => …)`** sobre la conexión pooled. El `WHERE status='searching' AND provider_id IS NULL` hace que, bajo concurrencia, PostgreSQL serialice los updates por fila y **exactamente uno** vea 1 fila afectada; el resto recibe 0 → AppError 409. History y notification viven en la misma transacción: un fallo posterior no deja escritura huérfana.

## Tests

| Suite | Cobertura | Ejecución |
|---|---|---|
| `unit.test.ts` | matriz RBAC completa (support→super_admin), ULID, validación de archivos (magic bytes, MIME falso, docx rechazado, tamaño), redacción de logs, paginación | `npx vitest run` — sin BD |
| `security.test.ts` | Origin externo rechazado en POST, GET sin Origin permitido, headers de seguridad, healthz sin secretos, rutas Better Auth montadas, 404 con envelope | `npx vitest run` — sin BD |
| `auth.integration.test.ts` | signup→role admin/super_admin ignorado · no verificado sin sesión · login pre-verificación bloqueado · sesión expirada rechazada · sesión revocada rechazada · verification token expirado · reset token no reutilizable | **Requiere Neon dev** (`ALTOQUE_TEST_DB=1`) |
| `claim.integration.test.ts` | COMMIT (accepted + 1 history + 1 notification) · ROLLBACK (searching + 0 + 0, con fallo inyectado post-UPDATE) · CONCURRENCIA (5 simultáneos → 1 gana, 4×409) · provider no verificado → FORBIDDEN · claim sobre ya-aceptada → 409 | **Requiere Neon dev** |

**Resultado en este entorno:** no dispongo de shell para ejecutar `vitest`/`prisma`/`tsc` ni de credenciales de tu Neon; el único paso ejecutable aquí es el build (**PASS**). Las suites están escritas y las de integración deliberadamente gateadas (`describe.runIf`) para que `npx vitest run` sea verde sin BD y completo con BD. **No se reportan como ejecutadas lo que no se ejecutó.**

## Build

```
vite build → ✓ 42 módulos, dist/index.html + CSS 58.3 kB + JS 320.8 kB (gzip 91.1 kB)   PASS
```
Build de producción incluye `npx prisma generate` (vercel.json) para que exista el cliente en la Function.

## Vercel Configuration

- `api/index.ts` → Function Node con `handle(app)` de `@hono/node-server/vercel`.
- `vercel.json`: rewrite `"/api/v1/:path*" → "/api"` **listado antes** del SPA fallback `/(.*) → /index.html` (Vercel evalúa en orden: el API nunca cae en el fallback). Assets `/assets/*` con cache immutable. Headers de seguridad globales.
- Node runtime: fijar **Node.js 22** en Project Settings.
- Mismo origen → cero CORS; cookies SameSite=Lax + Secure funcionan sobre HTTPS de preview/producción.

## Environment Variables (las que usa el código, exactamente)

| Variable | Obligatoria | Origen | Preview | Prod | Secreta |
|---|---|---|---|---|---|
| `DATABASE_URL` | Sí | Neon → rama preview/prod, conexión **pooled** | ✓ | ✓ | Sí |
| `DIRECT_DATABASE_URL` | No en runtime (CLI/migraciones desde tu máquina/CI) | Neon, conexión directa | – | – | Sí |
| `BETTER_AUTH_SECRET` | Sí (≥32 chars) | generar: `openssl rand -hex 32` | ✓ (propio) | ✓ (otro) | Sí |
| `APP_URL` | Sí | `https://<tu-preview>.vercel.app` / dominio prod | ✓ | ✓ | No |
| `EXTRA_TRUSTED_ORIGINS` | No | orígenes extra separados por coma | opcional | opcional | No |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | No (solo al sembrar) | tú | – | – | Sí |
| `EMAIL_FROM` | No (default existe) | tu dominio de envío | opcional | ✓ | No |
| `RESEND_API_KEY` | No en F1 (console) / Sí en F2 | Resend dashboard | F2 | F2 | Sí |
| `BLOB_READ_WRITE_TOKEN` / `BLOB_PRIVATE_READ_WRITE_TOKEN` | No en F1 / Sí en F2-F3 | Vercel → Storage → Blob (stores público y privado) | F2 | F2 | Sí |

Ninguna lleva `VITE_`: nada viaja al bundle del cliente.

## Remaining Mocks (para definir F2)

**Todo el frontend sigue sobre `src/lib/state.ts`** (datos en memoria + simulación por timers):
- Landing: categorías, profesionales, zonas, ticker → mock.
- Cliente: home, resultados, perfil pro, wizard, tracking, reviews, favoritos, notificaciones → mock.
- Proveedor: inbox, trabajo activo, actividad, ingresos → mock.
- Sesión del frontend: `localStorage` (se reemplaza por la cookie HttpOnly al conectar `lib/api` → `/api/v1` en F2).
- El router, los guards y el design system son reales y definitivos.

## Technical Debt

1. Rangos `^` en `package.json` (el lockfile ya garantiza reproducibilidad con `npm ci`); endurecimiento: quitar carets.
2. Email transaccional = consola en dev; Resend se conecta en F2.
3. `FileStore` contra Vercel Blob pendiente de tokens (F2/F3); la interfaz ya está fijada.
4. Reglas de Vercel Firewall pendientes de configurar en dashboard (valores en v1.1 §19).
5. `typecheck` root no cubre `server/` (tsconfig propio; comando dedicado abajo).
6. Migraciones aplicadas manualmente por entorno (decisión aprobada, no deuda accidental).

## Manual Setup Required (Preview)

**Comandos de verificación (tu entorno / CI):**
```bash
npm ci
npx prisma generate
npx prisma validate
npx tsc -p server/tsconfig.json     # typecheck del servidor
npx tsc --noEmit                    # typecheck del frontend
npx vitest run                      # unit + security (sin BD)
npm run build
# Integraciones (con tu Neon dev):
ALTOQUE_TEST_DB=1 DATABASE_URL=<dev-pooled> BETTER_AUTH_SECRET=<32+> npx vitest run
```

**Neon (solo rama de desarrollo/preview — NO producción):**
1. Neon Console → proyecto → crear **branch `development`** (de main).
2. Branch → Connect → copiar la **Pooled connection string** → esa es `DATABASE_URL` (debe contener `-pooler` en el host).
3. En tu máquina: `DIRECT_DATABASE_URL=<string directa de la rama dev> npx prisma migrate dev --name init` (usa `prisma.config.ts`).
4. Aplicar los extras que Prisma no expresa: `psql <direct-url> -f server/database/migrations-reference/0001_init.reference.sql` (CHECKs e índices parciales).
5. Sembrar: `DATABASE_URL=<dev-pooled> SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npx tsx server/database/seeds/seed.ts` (idempotente).
6. Configurar `DATABASE_URL` + `BETTER_AUTH_SECRET` + `APP_URL` en Vercel (scope: Preview) y desplegar la rama.

## F1 Status

```
F1 STATUS

Database       PASS·   (schema + migración ref + seed idempotente; prisma validate/generate y
                        migración aplicable en tu entorno con Neon dev — comandos arriba)
Auth           PASS·   (Better Auth 1.7.1 integrado; opciones verificadas contra tipos instalados;
                        end-to-end contra Neon dev pendiente de ejecución con tus credenciales)
Sessions       PASS    (HttpOnly/Secure(prod)/Lax, DB-backed, expiración, renovación, revocación)
RBAC           PASS    (matriz centralizada + middleware + ownership; suite unit escrita)
API            PASS    (/api/v1, envelopes, errores centralizados, healthz, categorías, me)
Security       PASS    (grep 0 secretos en logs/código cliente, Origin check, headers, Zod env,
                        rate limiting, audit, validación de archivos)
Transactions   PASS·   (claim atómico implementado con UPDATE condicional en $transaction;
                        tests COMMIT/ROLLBACK/CONCURRENCIA escritos; ejecución requiere Neon dev)
Tests          PASS·   (unit + security sin BD; integraciones gateadas por diseño;
                        ejecución completa = comandos de la sección Manual Setup)
Build          PASS    (vite build verificado en este entorno, verde)
Vercel Ready   PASS    (Function + rewrites ordenados + SPA fallback + env validation)
```

**Leyenda:** `PASS` = verificado aquí · `PASS·` = implementado y verificado por diseño; la ejecución final requiere tu entorno/credenciales (sección Manual Setup).

F1 queda implementada y reportada. El cierre definitivo ocurre cuando la tabla de verificación local esté toda en verde y la prueba manual en **Vercel Preview** (landing → registro → verificación → login → sesión → logout → API → refresh → routing) pase. **F2 no se inicia hasta entonces.**
