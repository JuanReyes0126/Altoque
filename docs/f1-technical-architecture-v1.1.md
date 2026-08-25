# ALTOQUE · F1 — Propuesta de Arquitectura Técnica · v1.1

> **Estado:** Para aprobación · **Alcance:** F1 · BASE REAL (solo diseño, sin código aún)
> **Changelog v1.0 → v1.1:** 18 correcciones aplicadas — Better Auth sustituye a Lucia; registro con verificación obligatoria; estrategia de conexiones Neon corregida (pooled/direct, sin números fijos); Blob público/privado; SameSite=Lax + Origin check; máquina de estados estricta sin `any → cancelled`; disputas como entidad separada; IDs definitivos (ULID); rate limiting en dos capas; política de minimización de logs; batería de tests ampliada.

---

## 1 · Architecture Summary

```
 Cliente / Proveedor / Admin
            ↓
      React + Vite (SPA)
            ↓
         lib/api  ← frontera única UI↔datos (fetch, mismo origen)
            ↓
   /api/v1/*  (Hono, Vercel Function · Node runtime)
            ↓
  Better Auth (sesiones, verificación, reset)
   + Middleware (RBAC, ownership, validación Zod, CSRF, rate limit)
   + Servicios de dominio (máquina de estados, claim atómico, auditoría)
            ↓
   Prisma Client (instancia única) + @prisma/adapter-neon
            ↓
   Neon PostgreSQL (pooled para runtime · direct solo para migraciones)
            ↓
     ┌──────────────┴──────────────┐
  Vercel Blob                  Audit/Logs
  (público / privado)          (Vercel Logs + admin_audit_logs)
```

**Un solo origen.** SPA y API viven bajo el mismo dominio (`https://altoque.do` y `https://altoque.do/api/v1/*`). Esto elimina CORS, simplifica cookies (same-site reales) y permite rate limiting uniforme. No se introduce dominio separado de API hasta que una razón técnica lo exija.

---

## 2 · Technology Decisions

| Componente | Elección | Razón corta |
|---|---|---|
| Database | **Neon PostgreSQL** | Integración nativa Vercel, branches por entorno, pooling gestionado, PITR |
| ORM | **Prisma + `@prisma/adapter-neon`** | Recomendación actual de Prisma y Neon para serverless; type-safe; migraciones maduras |
| Backend | **Hono** | Ligero, TypeScript-first, middleware componible, corre igual en Node y (futuro) Edge |
| Validation | **Zod** | Validación runtime real con errores estructurados; esquemas reutilizables en cliente |
| Auth | **Better Auth** | Activo y mantenido (Lucia está deprecado); sesiones en BD; plugins Prisma y Hono oficiales; verificación de email y reset incluidos; 2FA como plugin futuro |
| Sessions | **Database-backed + cookies HttpOnly/Secure/SameSite=Lax** | Revocables, multi-dispositivo, invisibles al JS del navegador |
| Password hashing | **scrypt (default de Better Auth)** | Memory-hard, recomendado por el propio Better Auth; intercambiable a Argon2id vía config sin tocar lógica (no reinventamos criptografía) |
| Storage | **Vercel Blob** (store público + store privado) | Nativo de Vercel; uploads firmados; el store privado nunca expone URLs públicas permanentes |
| IDs | **ULID** (dominio) + **código humano** `ALT-YYYY-NNNNNN` para solicitudes | No secuenciales, ordenables por tiempo, 26 chars; el código no otorga acceso |
| API style | **REST `/api/v1`** con envelope `{data}` / `{data,meta}` / `{error}` | Simple, versionado desde el día 1 |
| Hosting | **Vercel** (Node Functions) + **GitHub** | Preview por PR, Production desde `main`, mismo origen que la SPA |
| Rate limiting | **Vercel Firewall (edge) + límites app en PostgreSQL** | Defensa en profundidad sin infraestructura nueva (sin Redis) |

---

## 3 · PostgreSQL Design (Neon)

### 3.1 Estrategia de conexiones — dos caminos, sin números mágicos

Los límites de conexiones dependen del plan de Neon y del tamaño de las Functions; por eso **no fijamos cifras** — fijamos la topología:

```
Runtime (API en Vercel)
  → DATABASE_URL  →  Neon POOLED endpoint (transaction mode)
  → Prisma Client (instancia única por runtime) + @prisma/adapter-neon (driver HTTP serverless)

Operaciones administrativas (migraciones, seeds, scripts)
  → DIRECT_DATABASE_URL  →  Neon DIRECT endpoint
  → prisma migrate deploy / db seed (nunca desde el runtime de producción)
```

**Por qué el adaptador:** la combinación `@prisma/adapter-neon` + `@neondatabase/serverless` (modo HTTP) es la recomendación vigente de Prisma y de Neon para serverless: cada consulta es una llamada HTTP sin estado, de modo que **ninguna Function mantiene conexiones TCP largas entre invocaciones** — el problema clásico de "demasiadas conexiones" en serverless desaparece por diseño, sin depender de cifras de pool.

**Reglas duras:**
- **Nunca** `prisma.$disconnect()` por request. Una única instancia reutilizable vía `globalThis` (patrón singleton).
- `DIRECT_DATABASE_URL` **jamás** se inyecta en Functions de producción: solo en CI/migraciones.
- Transacciones interactivas de Prisma (`$transaction`) para claim y cambios de estado (§11–§12).

### 3.2 Entornos — separación estricta

| Entorno | Base | Fuente de la URL | Regla |
|---|---|---|---|
| **Development** | Neon dev branch (o Postgres local con mismo esquema) | `.env` local | Nunca apunta a Production |
| **Preview/Test** | Neon branch aislada por entorno de preview | Vercel env vars (scope Preview) | Un PR jamás toca Production; datos desechables |
| **Production** | Neon production branch (protegida) | Vercel env vars (scope Production) | Solo `main`; migraciones controladas (§3.3) |

### 3.3 Migraciones y seeds

- `prisma/migrations/` versionado en Git. Cada PR corre `prisma migrate deploy` contra su **preview branch** (validación real del esquema).
- **Producción:** las migraciones se ejecutan **fuera del build**, como paso explícito y controlado (job de CI aprobado, o `npm run db:deploy` manual con `DIRECT_DATABASE_URL` de producción). El build de Vercel solo ejecuta `prisma generate`.
- Seeds: `seeds/index.ts` idempotente (upsert) — categorías, zonas de Santiago, primer super_admin (vía variables bootstrap de un solo uso), datos de demo para dev/preview.

### 3.4 Backups y recuperación

- **PITR** (point-in-time recovery) de Neon en Production (retención según plan).
- Snapshot manual antes de cada migración de producción.
- Recuperación: restaurar a branch nueva → validar → promover. El esquema vive en Git; los datos en Neon. Nunca hay una única copia.

### 3.5 Escalabilidad de la base

- Índices definidos para los patrones de query reales (§4.11).
- Connection pooling delegada a Neon (transaction mode) — escala con el plan, no con nuestro código.
- Preparado para read replicas de Neon si el dashboard admin lo necesita (V3): Prisma apunta a otro endpoint sin tocar servicios.

---

## 4 · Prisma Design

### 4.1 Estructura

```
server/database/
├── client.ts            # singleton PrismaClient + adapter-neon (globalThis)
├── schema.prisma        # esquema completo (auth Better Auth + dominio)
├── migrations/          # versionadas en Git
├── seeds/
│   ├── index.ts         # orquestador idempotente
│   ├── categories.ts
│   ├── zones.ts
│   └── bootstrap-admin.ts
└── tx.ts                # helpers de transacción (claim, transiciones, auditoría)
```

### 4.2 Instancia única

```ts
// patrón: una sola instancia por runtime; en serverless se reutiliza entre
// invocaciones tibias y en dev sobrevive al HMR vía globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
```

- Sin `$disconnect()` en hot paths.
- Better Auth recibe **la misma instancia** vía su plugin `prismaAdapter` → cero clientes duplicados.

### 4.3 Tablas de auth — generadas por Better Auth

No creamos `users`/`sessions` propias: **Better Auth es la fuente única** de identidad y sesiones (evita estructuras duplicadas). El plugin de Prisma genera:

| Tabla | Campos clave | Notas |
|---|---|---|
| `user` | `id`, `name`, `email` **unique**, `emailVerified` (default `false`), `image`, `createdAt`, `updatedAt` | `emailVerified` es la puerta de todo el sistema |
| `session` | `id`, `token` **unique, almacenado hasheado**, `expiresAt`, `ipAddress`, `userAgent`, `userId`→user (onDelete Cascade), `createdAt`, `updatedAt` | Multi-dispositivo = varias filas por usuario |
| `account` | `id`, `userId`→user (Cascade), `accountId`, `providerId` (`credential`), `password` (**hash scrypt**), campos OAuth reservados (`accessToken`, `refreshToken`, `scope`, …) | El hash de contraseña vive aquí, jamás en `user` |
| `verification` | `id`, `identifier` (email), `value` (**token hasheado**), `expiresAt`, `createdAt`, `updatedAt` | Verificación de email y reset de contraseña |

**Ningún serializer del API devuelve jamás** `account.password`, `session.token` ni `verification.value`. No es una regla de UI: esos campos no entran en los `select`.

---

## 5 · IDs — decisión definitiva

| Contexto | Estrategia | Justificación |
|---|---|---|
| Tablas de Better Auth | Generador interno de Better Auth | No lo tocamos; son IDs internos |
| **Todas las tablas de dominio** | **ULID** (String, 26 chars, generado en app con `ulidx`) | No secuencial → no enumerable; embebido en tiempo → ordenable por ID sin índice extra de `created_at`; más corto que UUID; Prisma lo recibe como `String @id` sin defaults exóticos |
| `service_requests.code` | **Código humano** `ALT-2026-000001` | Contador atómico en `request_counters` (`UPDATE … SET last_value = last_value + 1 RETURNING last_value` dentro de la misma transacción de creación). **El código no concede autorización**: todo acceso pasa por ownership/permisos del servidor |

Descartados con razones: *UUIDv4* (no ordenable → peor para índices de feeds), *BIGINT autoincremental* (enumerable, fuga volumen de negocio), *CUID2* (no ordenable por diseño; Prisma no lo genera nativo).

---

## 6 · Authentication — Better Auth

### 6.1 Evaluación

| Opción | Ventajas | Desventajas | Veredicto |
|---|---|---|---|
| **Auth.js** | Maduro, muchos providers | Pesado, opiniones fuertes sobre rutas/DB, fricción con APIs propias tipo REST versionada | ✗ |
| **Lucia** | Control total | **Deprecado (2025)** — no se inicia una plataforma sobre una librería abandonada | ✗ (vetado) |
| **Custom propia** | Control absoluto | Hay que mantener hashing, tokens, expiraciones, verificación… superficie de error criptográfico propia | ✗ |
| **Better Auth** | Activo; sesiones en BD; **plugin Prisma oficial; middleware Hono oficial**; `emailAndPassword` con verificación y reset; cookies seguras por defecto; plugin 2FA (TOTP) listo para conectar; token de sesión hasheado en BD | Dependencia de un proyecto joven (mitigado: la superficie que usamos es pequeña y estándar) | ✓ **Elegido** |

### 6.2 Integraciones

- **Hono:** `import { betterAuth } from "better-auth"` + plugin `better-auth/hono` montado en `/api/v1/auth/*`; el resto de rutas usan `auth.api.getSession({ headers })` dentro de nuestro middleware `requireAuth`.
- **Prisma/PostgreSQL:** plugin `prismaAdapter(prisma)` apuntando a la misma instancia singleton. Esquema auth = las 4 tablas de §4.3.
- **Vercel:** funciona igual en Node runtime; `BETTER_AUTH_URL` y `BETTER_AUTH_SECRET` por entorno.

### 6.3 Flujo definitivo de registro y verificación

```
Registro (Zod: nombre, email, teléfono, contraseña)
   ↓
Cuenta creada con emailVerified = false · SIN sesión autorizada
   ↓
Email de verificación (token con expiración, hasheado en `verification`)
   ↓
Usuario abre el enlace (GET — inmune a CSRF)
   ↓
Servidor valida token + expiración → marca emailVerified = true
   ↓
autoSignInAfterVerification: true → Better Auth emite la sesión en ese momento
   ↓
Login/sesión válida (cookie HttpOnly)
```

**Decisión documentada:** usamos `emailAndPassword: { requireEmailVerification: true, autoSignInAfterVerification: true }`.
- Con `requireEmailVerification`, **Better Auth rechaza el sign-in** de cuentas no verificadas (error `EMAIL_NOT_VERIFIED`) → no existe "sesión normal previa a la verificación".
- Tras verificar, `autoSignInAfterVerification` crea la sesión automáticamente (el usuario no vuelve a teclear contraseña — UX tipo PedidosYa).
- **Capacidades de un no-verificado:** nulas sobre datos. Nuestro middleware `requireVerifiedEmail` bloquea todo `/api/v1/*` salvo `/auth/verify-email`, `/auth/resend-verification` y `/auth/logout`. Defensa propia, no dependiente del comportamiento interno de la librería.

### 6.4 Forgot / Reset password

`POST /auth/forget-password` → email con token de un solo uso (hasheado en `verification`, expiración corta) → `POST /auth/reset-password` lo consume y lo **invalida** (no reutilizable — verificado en tests).

### 6.5 Contraseñas — decisión final

- **scrypt** (algoritmo por defecto de Better Auth, memory-hard y CPU-intensivo).
- **No forzamos Argon2id:** Better Auth gestiona el hashing internamente y su default es seguro y recomendado por el propio proyecto. Sustituirlo sería reemplazar seguridad auditada sin ganancia real.
- Si en el futuro elegimos Argon2id, Better Auth lo soporta vía `advanced.password.{hash,verify}` — **un cambio de configuración, no de arquitectura**. Nada de criptografía propia.
- Requisitos de contraseña (Zod): mínimo 8 chars, al menos una letra y un número; no aparece en logs ni respuestas.

### 6.6 2FA / MFA (slot, no F1)

Better Auth distribuye un plugin **two-factor (TOTP)**. La arquitectura no lo impide: sesiones en BD, freshness de sesión admin ya diseñada (§7.4) y auditoría central lista. Se activa para `admin`/`super_admin` en V2.

---

## 7 · Sessions

### 7.1 Política general

| Aspecto | Decisión |
|---|---|
| Almacenamiento | BD (`session` de Better Auth), **token hasheado** en reposo |
| Cookie | `HttpOnly` + `Secure` + **`SameSite=Lax`** + `Path=/` (§8 para el porqué de Lax) |
| Duración | 7 días, renovación deslizante tras 1 día de actividad (defaults de Better Auth) |
| Multi-dispositivo | Sí — cada login crea su sesión; listado y revocación individual vía endpoints de Better Auth |
| Revocación | `POST /auth/revoke-session` (una) y `revoke-sessions` (todas); logout = revocar la actual |
| Visibilidad JS | **Ninguna** — el navegador nunca puede leer el token |

### 7.2 Flujo conceptual

```
Browser → cookie HttpOnly (inaccesible a JS)
   → Function Hono → middleware requireAuth
   → lookup de sesión en PostgreSQL (token hasheado)
   → user + role → middleware de permisos → handler
```

### 7.3 Sesiones administrativas — requisitos superiores

| Requisito | Implementación desde F1 |
|---|---|
| Freshness | Operaciones destructivas (`users.block`, `admin.role.change`, `providers.approve/reject`, `dispute.resolve`) exigen `session.createdAt` < **2 h**; si no → `403 STALE_ADMIN_SESSION` → reautenticación (`POST /api/v1/auth/reauthenticate` con contraseña) |
| Reautenticación | Endpoint propio que valida contraseña y refresca la sesión (actualiza metadata) |
| Revocación forzada | `super_admin` puede revocar sesiones de otros admins (auditado) |
| Listado de dispositivos | Endpoints de sesión de Better Auth expuestos al propio usuario |
| MFA | Slot vía plugin TOTP (V2) — el diseño de sesión en BD ya lo soporta |
| Expiración corta | Política de freshness cumple el rol sin duplicar mecanismos de expiración |

---

## 8 · CSRF — decisión final

**No usamos `SameSite=Strict`.** Decisión: **`SameSite=Lax` + validación de `Origin`/`Host`** en requests mutables.

- `Strict` rompe flujos legítimos que entran por navegación de primer nivel: enlaces de verificación de email, reset de contraseña, volver desde el cliente de correo o WhatsApp.
- `Lax` ya bloquea POST cross-site con cookie (el vector clásico de CSRF).
- Capa adicional propia: middleware en todo `/api/v1/*` que, en métodos mutables (POST/PATCH/PUT/DELETE), exige cabecera `Origin` (o `Host`) que coincida con la allowlist (`APP_URL` + patrón de previews `*.vercel.app`). Sin `Origin` coincidente → `403 ORIGIN_MISMATCH`.
- Los endpoints de Better Auth heredan su política de cookies (Lax) y quedan cubiertos por el mismo middleware cuando son mutables.
- Sin double-submit token: con mismo origen + Lax + Origin check, añadirlo sería complejidad sin ganancia. Si algún día la API se abre a otros orígenes, se reevalúa con tokens dedicados.

---

## 9 · Esquema definitivo de base de datos (nivel campo)

Convenciones: dinero = `Decimal(12,2)` DOP · IDs dominio = ULID (String) · timestamps = `DateTime` UTC · `→` = FK · `U` = unique · `IX` = index · `AO` = append-only (sin UPDATE/DELETE a nivel de aplicación; `REVOKE` a nivel de BD donde aplique).

### 9.1 USERS

**`customer_profiles`** (1:1 con `user`)

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `user_id` | String | ✗ | — | **PK**, → `user.id` **Cascade** |
| `phone` | String | ✓ | — | **U** |
| `default_address_id` | String | ✓ | — | Sin FK (evita ciclo con `addresses`); integridad por servicio |
| `created_at` / `updated_at` | DateTime | ✗ | now() | — |

**`addresses`**

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `id` | String ULID | ✗ | — | **PK** |
| `user_id` | String | ✗ | — | → `user.id` **Cascade** · `IX(user_id)` |
| `label` | String | ✗ | — | máx 40 (Zod) |
| `zone_id` | String | ✗ | — | → `zones.id` **Restrict** |
| `line` | String | ✗ | — | dirección escrita |
| `lat` / `lng` | Decimal(9,6) | ✓ | — | slot GPS (V3); nunca obligatorios en V1 |
| `is_default` | Boolean | ✗ | `false` | una default por usuario (servicio) |

### 9.2 PROVIDERS

**`provider_profiles`** (1:1 con `user`)

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `user_id` | String | ✗ | — | **PK**, → `user.id` **Cascade** |
| `business_name` | String | ✓ | — | |
| `bio` | String | ✗ | `""` | máx 600 |
| `years_exp` | Int | ✓ | `0` | ≥0 |
| `avg_eta_min` | Int | ✓ | — | |
| `verification_status` | Enum `draft·pending_verification·verified·rejected·suspended·blocked` | ✗ | `draft` | `IX(verification_status, is_available)` |
| `is_available` | Boolean | ✗ | `false` | solo `verified` puede ponerse true (servicio) |
| `available_since` | DateTime | ✓ | — | |
| `zone_default_id` | String | ✓ | — | → `zones.id` **SetNull** |
| `referral_code` | String | ✗ | generado | **U** |
| `referred_by` | String | ✓ | — | → `provider_profiles.user_id` **SetNull** |
| `founder` | Boolean | ✗ | `false` | primeros 100 verificados |
| `created_at` / `updated_at` | DateTime | ✗ | now() | |

**`provider_services`** — PK(`provider_user_id`,`category_id`) · FKs Cascade / **Restrict** a `categories` · `price_from Decimal(12,2)`.

**`provider_zones`** — PK(`provider_user_id`,`zone_id`) · Cascade / Restrict.

**`provider_documents`**

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `id` | ULID | ✗ | — | PK |
| `provider_user_id` | String | ✗ | — | → `provider_profiles` **Cascade** · `IX(provider_user_id, type, status)` |
| `type` | Enum `cedula_front·cedula_back·selfie·phone_proof·certification` | ✗ | — | |
| `file_id` | String | ✗ | — | → `files.id` **Restrict** (blob en store **privado**) |
| `status` | Enum `pending·approved·rejected` | ✗ | `pending` | |
| `reviewed_by` | String | ✓ | — | → `user.id` **SetNull** |
| `reviewed_at`, `reject_reason` | — | ✓ | — | motivo obligatorio al rechazar (Zod) |

**`provider_verification_history`** (AO) — `id`, `provider_user_id` (Cascade), `from_status`, `to_status`, `reason`, `actor_id` (→user SetNull), `created_at` · `IX(provider_user_id, created_at)`.

### 9.3 SERVICES

**`categories`** — `id` slug (PK, `"plomeria"`), `name` (**U**), `icon`, `group`, `is_active` (default true), `sort`. CRUD solo admin (F4); nada hardcodeado en frontend: siempre `GET /api/v1/categories`.

**`zones`** — `id` slug (PK), `name`, `city` (default "Santiago de los Caballeros"), `province`, `country` (default "RD"), `lat`/`lng` Decimal(9,6)? (centroides — base de la distancia pre-GPS), `is_active`. Jerarquía país→provincia→ciudad→zona lista para expansión nacional.

### 9.4 REQUESTS

**`service_requests`** — la tabla central

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `id` | ULID | ✗ | — | PK (técnico, no enumerable) |
| `code` | String | ✗ | — | **U** · `ALT-2026-000001` · no concede acceso |
| `customer_id` | String | ✗ | — | → `user.id` **Restrict** |
| `provider_id` | String | ✓ | `NULL` | → `user.id` **Restrict** |
| `category_id` | String | ✗ | — | → `categories.id` **Restrict** |
| `zone_id` | String | ✗ | — | → `zones.id` **Restrict** |
| `address_id` | String | ✓ | — | → `addresses.id` **SetNull** (el request conserva `zone` + descripción como snapshot) |
| `description` | String | ✗ | — | máx 500 (Zod) |
| `when_type` | Enum `now·scheduled·quote` | ✗ | `now` | |
| `scheduled_at` | DateTime | ✓ | — | obligatorio si `scheduled` (Zod refinado) |
| `status` | Enum `searching·accepted·on_the_way·arrived·in_progress·completed·confirmed·reviewed·cancelled·expired` | ✗ | `searching` | transiciones SOLO vía máquina central (§11) |
| `eta_min` | Int | ✓ | — | fijado en el claim |
| `price_estimate` | Decimal(12,2) | ✓ | — | |
| `cancelled_by` | Enum `customer·provider·admin·system` | ✓ | — | |
| `cancel_reason` | String | ✓ | — | |
| `releases_count` | Int | ✗ | `0` | releases del pro (máx 2, §11) |
| `created_at` / `updated_at` / `completed_at` | DateTime | — | now() | |

**Índices y por qué:**

| Índice | Razón |
|---|---|
| `IX(status, category_id, zone_id)` | Inbox del proveedor: "searching + mi categoría + mi zona" es LA query caliente |
| `IX(provider_id, status)` | Trabajo activo del pro + histórico/ingresos por provider |
| `IX(customer_id, created_at DESC)` | Historial del cliente ordenado |
| `U(code)` | Resolución de códigos humanos |
| `U PARCIAL(provider_id) WHERE status IN (accepted, on_the_way, arrived, in_progress)` | **Un pro = un trabajo activo, garantizado en BD** (segunda capa del claim atómico) |

**`request_photos`** — `id`, `request_id`→**Cascade** `IX(request_id)`, `file_id`→`files` **Restrict**, `sort`. Fotos de solicitud en store **privado** (§13).

**`request_status_history`** (AO) — `id`, `request_id`→Cascade, `from_status` (null en creación), `to_status`, `actor_id`→user SetNull, `actor_role`, `note`, `created_at` · `IX(request_id, created_at)` → de aquí sale el **timeline del admin** sin trabajo extra.

### 9.5 REPUTATION

**`reviews`**

| Campo | Tipo | Null | Default | Constraints |
|---|---|---|---|---|
| `id` | ULID | ✗ | — | PK |
| `request_id` | String | ✗ | — | **U** → `service_requests.id` **Restrict** = **una review por servicio, garantizada en BD** |
| `reviewer_id` | String | ✗ | — | → `user.id` **Restrict** (debe ser el customer del request — validado en servicio) |
| `provider_id` | String | ✗ | — | → `user.id` **Restrict** |
| `rating` | Int | ✗ | — | `CHECK (rating BETWEEN 1 AND 5)` |
| `punctuality` / `quality` / `communication` | Int | ✓ | — | `CHECK 1..5` cada uno |
| `comment` | String | ✓ | — | máx 500 |
| `created_at` | DateTime | ✗ | now() | `IX(provider_id, created_at DESC)` (perfil del pro) |

Solo existe si el request está en `confirmed` (o `completed` como gracia) — validado en servicio + la FK unique lo hace idempotente.

**`reports`** — `id`, `reporter_id`→user Restrict, `target_type` Enum(`user·provider·review·request`), `target_id`, `reason`, `details`?, `status` Enum(`open·resolved·dismissed`) default `open`, `resolved_by`→user SetNull, `created_at` · `IX(status, created_at)`.

**`disputes`** — ver §12 (entidad separada del estado operacional).

### 9.6 SYSTEM

**`notifications`** — `id`, `user_id`→user **Cascade**, `type` String, `title`, `body`, `data` Json?, `read_at`?, `created_at` · **`IX(user_id, read_at, created_at DESC)`** → la query "no leídas del usuario, recientes" sin escanear todo.

**`admin_audit_logs`** (AO) — `id`, `actor_id`→user **Restrict** (la historia sobrevive al admin), `actor_role`, `action` (nombres de §10.3), `entity_type`?, `entity_id`?, `metadata` Json?, `ip`?, `ua_hash`?, `created_at` · `IX(created_at DESC)`, `IX(actor_id)`, `IX(action)`.

**`files`** — `id`, `owner_id`→user Restrict, `visibility` Enum(`public·private`), `blob_key` (clave, **nunca la URL**), `mime`, `size_bytes`, `purpose` Enum(`avatar·portfolio·request_photo·doc_cedula·doc_selfie·doc_cert·dispute_evidence`), `request_id`?, `provider_user_id`?, `created_at` · `IX(owner_id)`.

**`rate_limits`** — `key` String **PK** (`"login:ip:…:ventana"`), `count`, `window_start`, `expires_at` · `IX(expires_at)` para limpieza programada.

**`request_counters`** — `year` Int **PK**, `last_value` Int. Genera `ALT-2026-000001` atómicamente (§5).

### 9.7 FINANCIAL — diseño futuro (sin implementar en F1–F3)

**`payments`** — `id`, `request_id` **U** → Restrict, `customer_id`, `provider_id`, `amount` Decimal(12,2), `currency` default `DOP`, `method` Enum(`cash·card·transfer`) default `cash`, `status` Enum(`pending·paid·refunded·held`) default `pending`, `paid_at`?, `created_at`.
**`transactions`** — `id`, `provider_id`, `payment_id`?, `amount` Decimal(12,2), `concept`, `created_at` · `IX(provider_id, created_at DESC)`.
Las tablas se crean en F4 (vacías) para que el esquema final exista; el procesamiento real llega en V2. Disputas con `status=open` podrán marcar `payments.status = held`.

---

## 10 · RBAC & Authorization

### 10.1 Middlewares en cadena (Hono)

```
requireAuth          → sesión válida en BD, o 401 UNAUTHENTICATED
requireVerifiedEmail → user.emailVerified = true, o 403 EMAIL_NOT_VERIFIED
requireRole(...)     → rol base customer | provider | admin
requirePermission(p) → matriz central (§10.3), o 403 FORBIDDEN
requireOwnership(f)  → el recurso pertenece al actor, o 403/404 (§10.4)
```

**Prohibido** el patrón `if (user.role === "admin")` disperso: toda autorización pasa por estos cinco helpers. Los guards del frontend son solo UX (ya está anotado en `lib/router.tsx`); **la decisión real ocurre siempre en el servidor**.

### 10.2 Roles

`customer` · `provider` · `admin` — y dentro de admin: `support` < `moderator` < `admin` < `super_admin` (campo `admin_role` en la tabla de admins, gestionable solo por `super_admin`).

### 10.3 Permisos — nombres definitivos y matriz

| Permiso | support | moderator | admin | super_admin |
|---|:---:|:---:|:---:|:---:|
| `users.read` | ✓ | ✓ | ✓ | ✓ |
| `requests.read` | ✓ | ✓ | ✓ | ✓ |
| `reports.read` | ✓ | ✓ | ✓ | ✓ |
| `reviews.moderate` | | ✓ | ✓ | ✓ |
| `disputes.resolve` | | ✓ | ✓ | ✓ |
| `providers.verify` (approve/reject/suspend/reactivate) | | ✓ | ✓ | ✓ |
| `users.block` | | | ✓ | ✓ |
| `categories.manage` | | | ✓ | ✓ |
| `operation.manage` (adminForce, config operativa) | | | ✓ | ✓ |
| `admins.manage` (roles admin) | | | | ✓ |
| `finance.read` | | | | ✓ |
| `audit.export` | | | | ✓ |
| `system.configure` | | | | ✓ |

Implementación: `PERMISSIONS: Record<AdminRole, Set<string>>` acumulativa en `server/lib/permissions.ts`; el mismo objeto alimenta la UI admin (ocultar lo que no se puede) y el servidor (decidir).

### 10.4 Autorización por recurso (anti-IDOR)

Cada endpoint sensible valida propiedad además de rol:

```
GET /api/v1/requests/:id
  customer → request.customer_id === session.user.id
  provider → request.provider_id === session.user.id
  admin    → requiere requests.read
  otro     → 404 (no 403: no confirmar existencia)

POST /api/v1/requests/:id/claim
  provider verificado + disponible + categoría en provider_services
  + transición atómica (§12) — manipular el ID en el frontend no otorga nada

GET /api/v1/files/:id
  owner === actor  OR  parte del request  OR  permiso admin correspondiente
```

Regla de diseño: **toda lectura/escritura con `:id` pasa por un resolvedor que carga el recurso y verifica vínculo** antes del handler.

---

## 11 · API Architecture

### 11.1 Contratos

```jsonc
// éxito            { "data": { … } }
// paginado         { "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 152, "pages": 8 } }
// error            { "error": { "code": "REQUEST_NOT_FOUND", "message": "…", "details"?: [ … ] } }
```

Paginación obligatoria en toda lista (`limit` máx 50); filtros por query params tipados con Zod.

### 11.2 Catálogo de códigos de error

`VALIDATION_ERROR`(400) · `UNAUTHENTICATED`(401) · `FORBIDDEN`(403) · `EMAIL_NOT_VERIFIED`(403) · `STALE_ADMIN_SESSION`(403) · `ORIGIN_MISMATCH`(403) · `NOT_FOUND`(404) · `CONFLICT`(409) · `REQUEST_ALREADY_CLAIMED`(409) · `INVALID_STATE_TRANSITION`(409) · `REVIEW_ALREADY_EXISTS`(409) · `UPLOAD_REJECTED`(422) · `RATE_LIMITED`(429) · `INTERNAL`(500, sin detalles internos).

### 11.3 Endpoints por fase

**F1 — fundación**
```
POST  /api/v1/auth/register          POST /api/v1/auth/login
POST  /api/v1/auth/logout            GET   /api/v1/auth/me
POST  /api/v1/auth/verify-email      POST /api/v1/auth/resend-verification
POST  /api/v1/auth/forget-password   POST /api/v1/auth/reset-password
POST  /api/v1/auth/reauthenticate    (admin freshness)
GET   /api/v1/categories
GET   /api/v1/me · PATCH /api/v1/me
GET|POST /api/v1/addresses · PATCH|DELETE /api/v1/addresses/:id
GET   /api/v1/healthz
```

**F2 — cliente real**
```
GET   /api/v1/pros?category&zone&available&sort
GET   /api/v1/pros/:id
GET|POST /api/v1/favorites · DELETE /api/v1/favorites/:proId
POST  /api/v1/requests               GET  /api/v1/requests?scope=active|history
GET   /api/v1/requests/:id           POST /api/v1/requests/:id/cancel
POST  /api/v1/requests/:id/confirm   POST /api/v1/requests/:id/review
GET   /api/v1/notifications · POST /api/v1/notifications/read
POST  /api/v1/uploads (token firmado) · GET /api/v1/files/:id (autorizado)
```

**F3 — proveedor real**
```
GET|PATCH /api/v1/provider/me        PATCH /api/v1/provider/availability
GET   /api/v1/provider/inbox         POST /api/v1/requests/:id/claim
POST  /api/v1/requests/:id/status    GET  /api/v1/provider/earnings?range
CRUD  /api/v1/provider/services      CRUD /api/v1/provider/zones
POST  /api/v1/provider/documents     GET  /api/v1/provider/reviews
```

**F4 — admin real**
```
GET   /api/v1/admin/metrics
GET   /api/v1/admin/users · GET /admin/users/:id
POST  /api/v1/admin/users/:id/{suspend,block,reactivate}
GET   /api/v1/admin/providers?status=pending
POST  /api/v1/admin/providers/:id/{approve,reject}
GET   /api/v1/admin/requests · GET /admin/requests/:id/timeline
POST  /api/v1/admin/requests/:id/force-cancel   (auditado, motivo obligatorio)
CRUD  /api/v1/admin/categories
GET   /api/v1/admin/reviews · POST /admin/reviews/:id/hide
GET   /api/v1/admin/reports · POST /admin/reports/:id/resolve
GET   /api/v1/admin/disputes · POST /admin/disputes/:id/resolve
GET   /api/v1/admin/audit?action&actor&from&to
POST  /api/v1/admin/admins/:id/role   (solo super_admin)
```

---

## 12 · Server Structure

```
server/
├── index.ts                  # app Hono: monta auth + v1 + middleware global + onError
├── config/
│   └── env.ts                # validación Zod de variables al arrancar (falla rápido)
├── database/
│   ├── client.ts             # singleton Prisma + adapter-neon
│   ├── schema.prisma
│   ├── migrations/
│   ├── seeds/
│   └── tx.ts                 # helpers transaccionales
├── auth/
│   ├── better-auth.ts        # instancia Better Auth (prismaAdapter, emailAndPassword)
│   └── routes.ts             # montaje + endpoints de negocio (reauthenticate)
├── middleware/
│   ├── require-auth.ts  ├── require-permission.ts  ├── require-ownership.ts
│   ├── validate.ts (Zod) ├── origin-check.ts (CSRF) ├── rate-limit.ts
│   └── request-id.ts
├── categories/  requests/  providers/  reviews/  files/  notifications/
│   └── cada uno: routes.ts · services.ts · schemas.ts (Zod)
├── admin/
│   ├── routes.ts  ├── services.ts  └── audit.ts   # wrapper central de auditoría
├── lib/
│   ├── permissions.ts        # matriz única de permisos
│   ├── state-machine.ts      # máquina de estados central (§13)
│   ├── errors.ts             # AppError + catálogo
│   ├── blob.ts               # tokens de upload, proxy privado
│   └── ids.ts                # ULID + códigos ALT-…
└── types/                    # DTOs compartidos (espejo de lib/api del frontend)
```

Arquitectura por dominio: cada carpeta conoce su esquema Zod, sus servicios y sus rutas. Nada de `routes.ts` de 4,000 líneas.

---

## 13 · Request State Machine — matriz corregida

Estados: `searching · accepted · on_the_way · arrived · in_progress · completed · confirmed · reviewed · cancelled · expired`.
(**`DISPUTED` se elimina del status** — §14.)

### 13.1 Matriz exacta `ALLOWED_TRANSITIONS[estado][actor]`

| Estado actual | customer | provider (asignado) | system |
|---|---|---|---|
| `searching` | → `cancelled` | → `accepted` **(solo vía claim atómico §12)** | → `expired` (cron de expiración) |
| `accepted` | → `cancelled` | → `on_the_way` · → `searching` *(release)* | — |
| `on_the_way` | → `cancelled` | → `arrived` · → `searching` *(release)* | — |
| `arrived` | → `cancelled` | → `in_progress` | — |
| `in_progress` | — *(ya no puede cancelar: vía disputa)* | → `completed` | — |
| `completed` | → `confirmed` | — | — |
| `confirmed` | → `reviewed` *(al crear la review)* | — | — |
| `reviewed` | **terminal** | **terminal** | **terminal** |
| `cancelled` | **terminal** | **terminal** | **terminal** |
| `expired` | **terminal** (el cliente duplica → request nuevo) | **terminal** | **terminal** |

- **Ninguna transición fuera de la matriz existe.** No hay `any → cancelled`.
- **Release del provider** (`accepted`/`on_the_way` → `searching`): máximo **2** por request (`releases_count`); al tercero, el sistema sugiere cancelación al cliente. Notifica al cliente en cada release.
- **Acción extraordinaria admin:** `POST /admin/requests/:id/force-cancel` — requiere `operation.manage`, motivo obligatorio, solo desde estados **no terminales** hacia `cancelled`, escribe history con `actor_role=admin` y audit log `request.force_cancel`. Un admin no puede saltar a `completed` ni reabrir un `reviewed`: si hace falta, es un proceso de disputa/soporte, no una transición.

### 13.2 Ejecución de cada transición (una transacción de BD)

```
BEGIN
  validar actor + rol + ownership
  validar allowedTransitions[current][actor] → si no: 409 INVALID_STATE_TRANSITION
  UPDATE service_requests SET status = :to, updated_at = now()
    WHERE id = :id AND status = :current        ← guard optimista
  INSERT request_status_history (from, to, actor, note)
  INSERT notification (si la transición la define)
COMMIT
```

Si el `UPDATE` toca 0 filas (carrera), rollback y `409 CONFLICT`.

---

## 14 · Disputes — entidad separada (decisión)

**Decisión:** las disputas **NO** son un estado de `service_requests`. El estado operacional del servicio y el estado de resolución del conflicto son dimensiones distintas; mezclarlos obligaría a "des-destruir" el estado anterior al resolver.

```
service_requests.status  =  completed / confirmed / …   (intocado)
disputes.status          =  open → under_review → resolved_for_customer
                                              → resolved_for_provider → rejected
```

**`disputes`** — `id`, `request_id`→Restrict, `opened_by`→Restrict, `reason`, `status` (default `open`), `resolved_by`→SetNull, `resolution_note`?, `created_at`, `resolved_at` · `IX(status)` · **`U PARCIAL(request_id) WHERE status='open'`** (una disputa abierta por request).

Efectos colaterales mientras hay disputa abierta: la review no puede editarse, `payments` (V2) pasa a `held`, el admin ve badge en el timeline. Resolver una disputa exige `disputes.resolve` + audit log `dispute.resolve`.

---

## 15 · Atomic Claim — implementación exacta

```ts
// server/requests/services.ts (pseudo-código fiel)
await prisma.$transaction(async (tx) => {
  // 1) elegibilidad del provider (antes de tocar el request)
  assert(pro.verification_status === "verified" && pro.is_available);
  assert(pro.provider_services.includes(request.category_id));

  // 2) UPDATE condicional — ES el lock: o lo gano yo o 0 filas
  const rows = await tx.$executeRaw`
    UPDATE service_requests
       SET provider_id = ${proId}, status = 'accepted',
           eta_min = ${eta}, updated_at = now()
     WHERE id = ${requestId}
       AND status = 'searching'
       AND provider_id IS NULL`;
  if (rows === 0) throw new AppError(409, "REQUEST_ALREADY_CLAIMED");

  // 3) history + notificación EN LA MISMA transacción
  await tx.requestStatusHistory.create({ … from: 'searching', to: 'accepted', actor: proId });
  await tx.notifications.create({ … userId: request.customer_id });
  // COMMIT automático; cualquier fallo arriba → ROLLBACK total,
  // nunca "request actualizado + history perdido"
});
```

Tercera capa: el índice parcial unique de §9.4 hace físicamente imposible un segundo trabajo activo del mismo pro. Si el claim falla: **no se escribe history, no se notifica, 409 limpio**.

---

## 16 · Storage — Vercel Blob público/privado

### 16.1 Clasificación

| Store | Contenido | Acceso |
|---|---|---|
| **Público** | avatares, fotos públicas de perfil, portfolio/fotos de trabajos | URL directa (CDN) |
| **Privado** | cédula, selfie de verificación, certificaciones, documentos internos, evidencias sensibles de disputa, **fotos de solicitudes** (muestran el hogar del cliente) | **Jamás URL pública permanente** — proxy autorizado |

### 16.2 Flujo de subida

```
upload (cliente auth)
  → POST /api/v1/uploads {purpose, size, mime}      ← valida autorización + límites
  → servidor valida y emite token firmado (handleUpload, maxDuration corto)
  → PUT directo a Blob con el token
  → servidor registra `files` (blob_key, visibility, mime, size, purpose)
  → PostgreSQL guarda la CLAVE, nunca el binario
```

### 16.3 Flujo de acceso privado (documentos)

```
Admin (o parte autorizada) solicita documento
  → GET /api/v1/files/:id
  → servidor: requireAuth → requirePermission('providers.verify') o ownership
  → servidor obtiene/autoriza el archivo con el token de Blob (lado servidor)
  → stream o URL firmada de vida corta al navegador
NUNCA: frontend → URL pública de la cédula
```

### 16.4 Validación de archivos (no solo extensión)

- **Tamaño:** fotos ≤ 5 MB, documentos ≤ 10 MB (rechazo antes del token de upload).
- **MIME permitido:** `image/jpeg`, `image/png`, `application/pdf` — **nada de `.docx`** (superficie mínima, decisión explícita).
- **Magic bytes:** verificación de firma (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`) — el MIME declarado no se cree.
- **Autorización del uploader:** el token de subida está ligado a `user_id` + `purpose`; subir "avatar" como `doc_cedula` se rechaza.
- Descargas privadas con `Content-Disposition` controlado.

---

## 17 · Environment Variables

**Regla:** todo secreto es `SERVER ONLY`. Nada sensible lleva prefijo `VITE_`.

| Variable | Dev | Preview | Prod | Exposición |
|---|:--:|:--:|:--:|---|
| `DATABASE_URL` (Neon **pooled**) | dev branch | preview branch | prod branch | SERVER ONLY |
| `DIRECT_DATABASE_URL` (Neon **direct**, migraciones) | dev | preview | prod (solo CI/step manual) | SERVER ONLY · **no existe en Functions** |
| `BETTER_AUTH_SECRET` | local random | por preview | fuerte, única | SERVER ONLY |
| `BETTER_AUTH_URL` | `http://localhost:5173` | `https://<preview>.vercel.app` | `https://altoque.do` | SERVER ONLY |
| `APP_URL` (allowlist CSRF/emails) | localhost | preview URL | dominio | SERVER ONLY |
| `BLOB_READ_WRITE_TOKEN` | store dev | store preview | store prod (público + privado) | SERVER ONLY |
| `EMAIL_API_KEY` (Resend) | sandbox | sandbox | productiva | SERVER ONLY |
| `EMAIL_FROM` | test@ | test@ | noreply@altoque.do | SERVER ONLY |
| `ADMIN_BOOTSTRAP_EMAIL` / `…_PASSWORD` | — | — | un solo seed, luego se eliminan | SERVER ONLY · efímeras |
| `LOG_LEVEL` | debug | info | warn | SERVER ONLY |
| `VITE_API_BASE` | `""` (mismo origen) | `""` | `""` | **Pública, NO sensible** |

---

## 18 · Vercel Deployment — arquitectura exacta

```
GitHub
 ├─ main        →  Vercel PRODUCTION  →  Neon production
 └─ pull request→  Vercel PREVIEW     →  Neon preview branch (aislada)
Local (vite dev + túnel o env local) → Neon dev branch
```

**Un solo proyecto Vercel.** La SPA (Vite) y la API (Hono) se despliegan juntas:

- `api/v1.ts` — único archivo Function: exporta la app Hono (`handle(app)`), Node runtime, `maxDuration: 30`.
- `vercel.json`: rewrite `{ "source": "/api/v1/:path*", "destination": "/api/v1" }` + el rewrite SPA existente (`/(.*)` → `/index.html`) — **los assets y `/api/*` se sirven antes que el fallback** por precedencia de Vercel.
- Build command: `npm ci && prisma generate && npm run build` (sin `migrate` en prod).
- **Migraciones de producción:** paso controlado fuera del build (job CI con aprobación, o `npm run db:deploy` manual con `DIRECT_DATABASE_URL` de prod). Un merge nunca migra producción por sí solo.
- Runtime **Node** (no Edge) en F1: Prisma completo, librerías de validación de archivos, compatibilidad total. El adaptador-neon mantiene abierta la puerta a Edge si se desea en V3.
- Headers de seguridad (ya presentes en `vercel.json`): `X-Content-Type-Options`, `X-Frame-Options` + añadir `Referrer-Policy` y `Permissions-Policy` en F1.
- HTTPS automático de Vercel; cookies `Secure` siempre en preview/prod.

### CORS — decisión

**Mismo origen** (`altoque.do` + `altoque.do/api/v1/*`) → **sin configuración CORS**: las cookies son same-site de verdad y no hay preflights que optimizar. Se mantiene una allowlist defensiva por si el día de mañana se separa la API; hoy no se configura nada.

---

## 19 · Rate Limiting — dos capas

**Capa 1 · Edge (Vercel Firewall / WAF):** protección bruta por IP antes de tocar una Function.

| Endpoint | Límite inicial |
|---|---|
| `auth/login` | 20 / 5 min / IP |
| `auth/register` | 5 / hora / IP |
| `auth/forget-password` | 3 / 15 min / IP |
| `auth/resend-verification` | 3 / 10 min / IP |
| `uploads` | 30 / hora / IP |
| API global | 600 / min / IP (anti-bot) |

**Capa 2 · Aplicación (tabla `rate_limits` en PostgreSQL, sin Redis):** límites de negocio por usuario.

| Acción | Límite inicial |
|---|---|
| Crear requests | 10 / hora / usuario |
| Claim attempts | 30 / 5 min / provider |
| Reviews | 20 / hora / usuario |
| Auth admin (reauthenticate) | 5 / 15 min / admin |

Valores iniciales; se ajustan con métricas reales. Implementación: `INSERT … ON CONFLICT (key) DO UPDATE SET count = count + 1` con ventana temporal en la clave; limpieza por `expires_at` vía cron/vercel cron.

---

## 20 · Security — checklist F1

HTTPS (Vercel) · cookies HttpOnly/Secure/Lax · validación de Origin en mutables · rate limiting en dos capas · hashing scrypt (Better Auth) · RBAC con matriz central · ownership por recurso (anti-IDOR) · validación Zod en todo input · inyección SQL: imposible por diseño (Prisma parametrizado + raw solo en el claim, parametrizado) · XSS: React escapa por defecto + headers · validación de archivos (tamaño/MIME/magic bytes) · audit logs append-only · secretos solo server-side · tokens de verificación/reset **hasheados en BD y de un solo uso**.

---

## 21 · Logging & Errors

### 21.1 Logging estructurado + minimización

Cada request loguea: `request_id` (UUID), `timestamp`, `method`, `route` (normalizada, sin IDs), `status`, `duration_ms`, `actor_id` **solo si autenticado**.

**Nunca se loguea:** contraseña · cookie/token de sesión · tokens de verificación/reset · OTP · contenido de documentos · direcciones completas · coordenadas GPS completas (solo `zone_id`).

El **audit log administrativo** es la excepción controlada: conserva actor, acción, entidad y metadatos sanitizados + IP + `ua_hash` (hash del user-agent, no el raw) — suficiente para investigación, mínimo para privacidad.

### 21.2 Errores centralizados

`AppError(status, code, message?, details?)` + un solo `app.onError` en Hono que mapea: 400 validación (detalles Zod) · 401 sin sesión · 403 sin permiso/origen/email · 404 inexistente (o existencia no confirmable) · 409 conflictos de estado/claim/duplicados · 422 upload · 429 límites · 500 interno (mensaje genérico, stack solo en logs). **Cero try/catch repetidos por endpoint.**

---

## 22 · Observabilidad (preparada, no montada)

F1 deja los ganchos: logs estructurados → **Vercel Logs**; `request_id` de punta a punta; endpoint `healthz` (sin secretos); consultas indexadas (§9.4) → **Neon console insights** para slow queries. Slots sin implementar: Sentry (error tracking), uptime externo, alertas — se enchufan sin tocar servicios.

---

## 23 · Testing Strategy

**Stack:** Vitest · tests de API con `app.request()` de Hono (sin levantar servidor) · BD real contra la **preview branch** efímera por suite · seed mínimo por test.

| Capa | Cobertura |
|---|---|
| Unit | máquina de estados (matriz completa), generador de códigos, validadores Zod, permisos |
| Integración API | flujos register→verify→login→request→claim→status→review |
| Autorización | la lista crítica, abajo |
| Concurrencia | N claims simultáneos al mismo request → exactamente 1 gana |

**Pruebas de autorización obligatorias (lista aprobada + ampliada):**
- customer no puede leer el request de otro customer
- provider no puede clamar un request ya asignado (**y el claim fallido no escribe history**)
- provider **no verificado** no puede clamar
- customer no puede aprobar providers
- support no puede convertirse en super_admin (ni ejecutar `admins.manage`)
- review solo tras `completed`/`confirmed` · **una review por request**
- transición de estado inválida → rechazada
- **sesión expirada → rechazada · sesión revocada → rechazada**
- **cuenta no verificada → sin operaciones protegidas**
- permisos de admin verificados **en servidor**
- **cambiar el rol en localStorage del cliente no produce nada** (la sesión real vive en BD)
- **alterar el ID de request en el frontend no otorga acceso**
- **documento privado de provider inaccesible sin permiso**
- claim + history son **atómicos**
- **token de reset no reutilizable · token de verificación expira**
- **protección CSRF/Origin funciona** (Origin externo en POST → 403)

---

## 24 · Scaling Considerations — sin sobreingeniería

Lo que alcanza para 0 → 100k usuarios: un monolito modular Hono + PostgreSQL bien indexado + Blob + edge rate limiting. **Explícitamente NO se introduce:** microservicios, Kafka, Kubernetes, clúster de Redis, event sourcing, CQRS, GraphQL, múltiples bases de datos.

Puntos de crecimiento ya previstos (cambian configuración, no arquitectura): read replica de Neon para el admin · mover rate limits a Vercel KV si el volumen lo pide · plugin 2FA de Better Auth · separar la API a su propio deployment solo si el equipo crece.

---

## 25 · Final Architecture Diagram

```
                        ALTOQUE
                          │
                     Vercel CDN
                          │
                  React + Vite (SPA)
                          │
                     /api/v1 (mismo origen)
                          │
                    Hono (Node Function)
        ┌─────────────────┼──────────────────┐
        │                 │                  │
   Better Auth      Middleware          Dominios
  (sesiones DB,   (RBAC, ownership,   (requests, providers,
   verify, reset)  Zod, CSRF, RL)      reviews, files, admin)
        │                 │                  │
        └─────────────────┼──────────────────┘
                          │
            Prisma singleton + adapter-neon
                          │
                 Neon PostgreSQL (pooled)
            ┌─────────────┼──────────────┐
            │             │              │
        Vercel Blob   admin_audit    request_status
        pub/priv      _logs (AO)      _history (AO)

   GitHub ──PR──► Vercel Preview ──► Neon branch aislada
   GitHub ──main► Vercel Production► Neon production
                  (migraciones: paso controlado aparte)
```

---

## 26 · Decisiones (tabla final)

| Componente | Elección |
|---|---|
| Database | Neon PostgreSQL (dev / preview / production aisladas) |
| ORM | Prisma + `@prisma/adapter-neon` (instancia única, sin `$disconnect` por request) |
| Backend | Hono (Node runtime en Vercel, `/api/v1`) |
| Validation | Zod |
| Auth | Better Auth (emailAndPassword + Prisma plugin + Hono) |
| Sessions | Database-backed + cookies HttpOnly/Secure/**SameSite=Lax** + Origin check |
| Password hashing | **scrypt** (default recomendado de Better Auth; Argon2id disponible por config si se desea) |
| Storage | Vercel Blob (público + privado; privados solo vía proxy autorizado) |
| API | REST `/api/v1` · envelope `{data}`/`{data,meta}`/`{error}` |
| IDs | ULID (dominio) + código humano `ALT-YYYY-NNNNNN` (sin valor de autorización) |
| Hosting | Vercel + GitHub (un proyecto, mismo origen) |
| Rate limiting | Vercel Firewall + tabla `rate_limits` (sin Redis) |

---

## 27 · Cumplimiento de los 13 puntos solicitados en v1.1

| # | Punto requerido | Sección |
|---|---|---|
| 1 | Better Auth | §6 |
| 2 | Esquema de tablas de auth | §4.3 |
| 3 | Integración Better Auth + Hono | §6.2 |
| 4 | Integración Better Auth + Prisma/PostgreSQL | §6.2 · §4.2 |
| 5 | Política de sesiones | §7 |
| 6 | Política CSRF | §8 |
| 7 | Neon pooled vs direct | §3.1 |
| 8 | Vercel Blob público/privado | §16 |
| 9 | Máquina de estados corregida | §13 |
| 10 | Tratamiento definitivo de disputas | §14 |
| 11 | Estrategia definitiva de IDs | §5 |
| 12 | Rate limiting | §19 |
| 13 | Arquitectura exacta de Vercel | §18 |

---

## 28 · Decisions Requiring Approval

1. **scrypt vs Argon2id:** recomiendo conservar scrypt (default de Better Auth). ¿Confirmado, o prefieres Argon2id desde el día 1 (cambio de configuración, no de arquitectura)?
2. **Fotos de solicitudes → store privado** (decisión de seguridad: muestran el hogar del cliente; visibles solo para las partes + admin). ¿Confirmado?
3. **Freshness admin = 2 h** para operaciones destructivas, con reautenticación. ¿Valor aceptable?
4. **Valores iniciales de rate limiting** (§19) — ajustables luego con métricas. ¿Aceptados como punto de partida?
5. **Migraciones de producción fuera del build** (paso CI/manual controlado). ¿Confirmado?
6. **Dinero como `Decimal(12,2)` DOP** desde F1. ¿Confirmado?
7. **ULID** como ID definitivo del dominio. ¿Confirmado?

---

*Fin del documento. Esperando aprobación para iniciar la implementación de F1.*
