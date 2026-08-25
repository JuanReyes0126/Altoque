# ALTOQUE · Vercel Preview — Preparación y Smoke Test

**Objetivo**: primer despliegue real en infraestructura Vercel + Neon, **solo Preview**.
Producción no se toca: ninguna variable, migración o deploy de este documento apunta a Production.

> **Honestidad de estado**: desde este entorno se verificó el build (`vite build` PASS, hashes
> idénticos al pre-F1 → frontend intacto) y se hizo revisión de código línea a línea. Los pasos
> que requieren tus credenciales (Neon, Vercel) están aquí como runbook ejecutable; el checklist
> final (§15) se marca ⏳ hasta que los corras y me pases los resultados (o los marques tú).

---

## 1 · Pre-flight final

| Paso | Comando | Estado |
|---|---|---|
| Instalación reproducible | `npm ci` | ⏳ ejecuta tú (aquí no hay shell) |
| Client de Prisma | `npx prisma generate` | ⏳ (no requiere BD viva) |
| Validez del schema | `npx prisma validate --schema server/database/schema.prisma` | ⏳ |
| Typecheck frontend | `npm run typecheck` | ⏳ |
| Typecheck servidor | `npx tsc --noEmit -p server/tsconfig.json` | ⏳ |
| Unit + security tests | `npx vitest run server/tests/unit.test.ts server/tests/security.test.ts` | ⏳ (no requieren BD) |
| Integration tests (Neon dev) | `ALTOQUE_TEST_DB=1 DATABASE_URL="<dev pooled>" BETTER_AUTH_SECRET="<32+>" npx vitest run` | ⏳ (requiere tu Neon dev) |
| Build | `npm run build` | ✅ PASS (ejecutado aquí; CSS/JS idénticos al pre-F1) |

**Corrección aplicada en esta preparación**: el seed importaba `dotenv` (no instalado) — eliminado;
ahora se ejecuta con `npx tsx --env-file=.env …`. También se pasó `server/tsconfig.json` a
`moduleResolution: Bundler` (el servidor corre bajo tsx/Vitest/Vercel, que resuelven como bundler).

## 2 · Producción: confirmación explícita

- `DATABASE_URL` **la defines tú en Vercel con scope por entorno**. En este documento y en el
  código no existe ninguna URL de base de datos; el seed y los tests se niegan a correr sin
  `DATABASE_URL` y el runbook solo usa ramas `dev`/`preview`.
- `prisma migrate dev` se ejecuta **solo** contra `DIRECT_DATABASE_URL` de la rama dev/preview.
- `APP_URL` de Production no se define todavía; si no existe, el servidor deriva el origen de
  `VERCEL_URL` (nunca hay un dominio hardcodeado que pueda apuntar a otro entorno).

## 3 · Variables para Vercel Preview

Todas provienen del código real (`server/config/env.ts`). **No existe ninguna `VITE_*` de servidor.**

| Variable | Obligatoria | Secreta | Origen | Scope |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ sí (runtime + `prisma generate` en build) | ✅ sí | **Neon** → rama *preview* → conexión **pooled** + `?pgbouncer=true` | Preview (y otra distinta para Production, en su momento) |
| `BETTER_AUTH_SECRET` | ✅ sí (mín. 32 chars) | ✅ sí | **Generamos nosotros**: `openssl rand -hex 32` — uno **distinto** por entorno | Preview |
| `APP_URL` | ❌ no — **dejarla vacía en Preview** | no | **Nosotros**: solo se fija en Production con el dominio real. En Preview el servidor la deriva de `VERCEL_URL` automáticamente | Production (futuro) |
| `EXTRA_TRUSTED_ORIGINS` | ❌ no | no | Nosotros (dominios adicionales separados por coma) | si aplica |
| `DIRECT_DATABASE_URL` | ❌ no en Vercel | ✅ sí | **Neon** → conexión **directa** (sin `-pooler`) | **solo tu máquina local** (migraciones/seed) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | ❌ no | ✅ sí | Nosotros | **solo local/CI — jamás en Vercel** |
| `RESEND_API_KEY` | ❌ no en F1 | ✅ sí | **Resend** (F2) | cuando se active email real |
| `EMAIL_FROM` | ❌ no | no | Nosotros (default: `Altoque <no-reply@altoque.do>`) | si aplica |
| `BLOB_READ_WRITE_TOKEN` / `BLOB_PRIVATE_READ_WRITE_TOKEN` | ❌ no en F1 | ✅ sí | **Vercel Blob** (F2/F3) | cuando se activen uploads |

## 4 · Neon Preview — paso a paso

1. Entra a [console.neon.tech](https://console.neon.tech) → **Create Project** → nombre `altoque`,
   región `US East (N. Virginia)` (la más cercana a Vercel), PostgreSQL 16+. Se crea sola la rama
   `production` — **no la uses para nada en este documento**.
2. Menú lateral → **Branches** → **Create branch** → nombre `preview` (padre: `production`, o `main`
   si renombraste). Esta rama es tu base aislada; Neon también permite branches efímeros por PR más adelante.
3. Con la rama `preview` seleccionada → **Connect** → pestaña **Pooled connection** → copia la
   cadena (el hostname lleva `-pooler`) y añádele `?pgbouncer=true` al final. Esa es tu
   `DATABASE_URL` de Preview. Ejemplo de forma (no es una cadena real):
   `postgres://USER:PASS@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`
4. En la misma pantalla, pestaña **Direct connection** (hostname sin `-pooler`) → esa es tu
   `DIRECT_DATABASE_URL`, **solo para tu `.env` local** (migraciones y seed).
5. En tu máquina, con un `.env` local conteniendo `DIRECT_DATABASE_URL` y `DATABASE_URL`:
   ```bash
   npx prisma validate --schema server/database/schema.prisma
   npx prisma migrate dev --name init        # usa DIRECT_DATABASE_URL vía prisma.config.ts
   ```
   Después abre la migración generada (`server/database/migrations/<ts>_init/migration.sql`) y
   **añade al final los bloques EXTRA** de
   `server/database/migrations-reference/0001_init.reference.sql` (línea 438 en adelante:
   índice parcial *un provider = un trabajo activo*, índice *una disputa abierta por solicitud*,
   CHECKs de rangos de calificación). Vuelve a ejecutar `npx prisma migrate dev` para aplicarlos.
6. Verifica el alineado (debe devolver SOLO los bloques EXTRA o nada):
   ```bash
   npx prisma migrate diff --from-url "$DIRECT_DATABASE_URL" \
     --to-schema-datamodel server/database/schema.prisma --script
   ```
7. Seed (categorías + zonas + secuencia de códigos; super admin opcional):
   ```bash
   npx tsx --env-file=.env server/database/seeds/seed.ts
   ```
8. Confirma tablas en Neon → rama `preview` → **SQL Editor**:
   ```sql
   SELECT count(*) FROM category;            -- espera 22
   SELECT count(*) FROM zone;                -- espera 9
   SELECT last_value FROM request_code_seq;  -- espera 0
   ```

## 5 · Vercel Preview — paso a paso

1. **Project**: Vercel → *Add New… → Project* → importa el repo de GitHub. Framework preset:
   **Vite** (detectado). Build command y output los llena `vercel.json`
   (`npx prisma generate && npm run build` → `dist`).
2. **Environment Variables**: en el diálogo de import (o *Settings → Environment Variables*)
   crea, **con scope Preview** (y Development si quieres probar `vercel dev`):
   - `DATABASE_URL` = la cadena pooled de la rama `preview` de Neon.
   - `BETTER_AUTH_SECRET` = un `openssl rand -hex 32` nuevo.
   - **No** crees `APP_URL`. **No** marques Production en ninguna.
3. **Build**: primer deploy → revisa el log: `prisma generate` OK y `vite build` OK.
4. **Functions**: `api/index.ts` corre como **Node runtime** (no Edge — obligatorio por el
   PrismaClient estándar). Vercel lo detecta solo; si en *Project → Settings → Functions*
   apareciera Edge, cámbialo a Node.
5. **Routing**: `vercel.json` ya ordena el rewrite `/api/v1/:path* → /api` **antes** del
   fallback SPA `/(.*) → /index.html`. `/api/v1/*` nunca recibe `index.html`.
6. **Domain**: usa el `*.vercel.app` que genera el deployment. No agregues dominio propio todavía.
7. **Deploy**: push a una rama que **no** sea la de producción → Vercel crea el Preview
   automáticamente. **No promociones a Production** (botón *Promote to Production*: no tocar).

## 6 · Better Auth URL en Preview (estrategia)

El servidor resuelve su origen con `canonicalOrigin()` (`server/config/env.ts`):

```
APP_URL definida        →  úsala (Production: dominio real; dev local: http://localhost:3000)
APP_URL ausente         →  https://${VERCEL_URL}   ← cada Preview recibe la suya, automática
ni una ni otra          →  http://localhost:3000
```

- **No hay dominio hardcodeado**: cada Preview funciona con su URL efímera sin configurar nada.
- `trustedOrigins()` (usado por nuestro middleware de Origen **y** por Better Auth) incluye ese
  mismo origen, así cookies y verificación CSRF funcionan en cada Preview.
- Cuando exista Production: define `APP_URL=https://<dominio>` **solo con scope Production**.

## 7 · Email: qué se puede probar sin Resend

Sin `RESEND_API_KEY`, el transporte de email es el **fallback de desarrollo**: los correos se
imprimen en los **Function Logs de Vercel** (`server/auth/email.ts`).

| Flujo | ¿Probable en Preview sin Resend? | Cómo |
|---|---|---|
| Registro | ✅ sí | POST a `sign-up/email`; el usuario queda `emailVerified=false` y **sin sesión** |
| Verificación | ✅ sí | el enlace aparece en Function Logs; al abrirlo (GET) Better Auth crea la sesión |
| Login | ✅ sí | solo tras verificar |
| Forgot/reset | ✅ sí | el enlace de reset aparece en Function Logs; token de un solo uso |
| Entrega real en bandeja | ❌ no | requiere `RESEND_API_KEY` (F2) |

⚠️ Consecuencia aceptada en Preview (y solo ahí): el token de verificación es visible en los
Function Logs, porque es el mecanismo deliberado para probar sin proveedor de email. En
Production con Resend, los tokens **no** pasan por logs.

## 8 · Primer deploy

Push de la rama → Preview automático → abrir la URL `*.vercel.app`. **Nada de Production.**

## 9–14 · Smoke test (checklist ejecutable)

Sustituye `PV` por tu URL Preview. Todo desde terminal salvo lo marcado 🌐.

### Público y routing (§9, §14)

```bash
curl -s PV/api/v1/healthz | jq        # → {"status":"ok","db":"up",…}  (si db:down → revisar DATABASE_URL)
curl -s PV/api/v1/categories | jq     # → { "data": { "categories": [ …22… ] } }
curl -sI PV/app/perfil | head -1      # 🌐 además: abrir y REFRESCAR / , /app, /app/perfil, /pro → 200 (SPA)
curl -s PV/api/v1/healthz | grep -c html   # → 0: /api/v1/* NO devuelve index.html
```

### Registro + verificación (§9)

```bash
curl -si PV/api/v1/auth/sign-up/email -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test","email":"smoke@tu-dominio.com","password":"Password123!"}'
# esperado: 200, body con token de verificación, SIN cookie de sesión (requireEmailVerification)
```
→ Vercel → Deployments → tu Preview → **Logs** → busca `[altoque:email]` → copia el enlace →
ábrelo en el navegador 🌐 → redirige y **crea la cookie de sesión**.
→ Neon → SQL Editor (rama preview):
```sql
SELECT id, email, "emailVerified", role, status FROM "user";   -- espera emailVerified=true, role=customer
SELECT count(*) FROM session;                                   -- espera ≥1
```

### Sesión y logout (§9)

```bash
# copia el valor de la cookie better-auth.session_token del navegador (DevTools → Application → Cookies)
COOKIE='better-auth.session_token=…'
curl -s PV/api/v1/me -H "Cookie: $COOKIE" | jq      # → { "data": { "role":"customer", … } }
curl -si PV/api/v1/auth/sign-out -X POST -H "Cookie: $COOKIE" | head   # → revoca
curl -s PV/api/v1/me -H "Cookie: $COOKIE" | jq      # → { "error": { "code":"UNAUTHENTICATED" } } (401)
```
🌐 Con la cookie presente, refrescar `/app` entra; sin cookie, la guarda del router devuelve a la Landing.

### Seguridad y CSRF (§9, §10)

```bash
# mutación desde Origen externo → 403 FORBIDDEN
curl -si PV/api/v1/auth/sign-up/email -H 'Origin: https://evil.example.com' \
  -H 'Content-Type: application/json' -d '{}' | head -1     # → HTTP/2 403

# escalada de rol por body → el servidor la ignora
curl -s PV/api/v1/auth/sign-up/email -H 'Content-Type: application/json' \
  -d '{"name":"Hacker","email":"hack@x.com","password":"Password123!","role":"super_admin"}'
# → Neon: SELECT role FROM "user" WHERE email='hack@x.com';   espera 'customer'
```
🌐 Manipula `localStorage` (`altoque_session`) en DevTools → la UI mock cambia de rol, pero
`curl /api/v1/me` con tu cookie sigue devolviendo el rol real de PostgreSQL. **Cero privilegios.**

### Envelopes (§11)

- `GET /api/v1/healthz` → objeto plano de salud (sin secretos).
- `GET /api/v1/categories` → `{ "data": {…} }`.
- `GET /api/v1/me` sin sesión → `{ "error": { "code": "UNAUTHENTICATED" } }` + HTTP 401, sin datos.

### Logs (§12)

Vercel → Logs del Preview → buscar (case-insensitive): `password`, `session_token`, `secret`,
`cookie`. Esperado: **ninguna aparición**, con la única excepción documentada en §7
(`[altoque:email]` del fallback dev, que desaparece al conectar Resend).

### Datos en el lugar correcto (§13)

Neon → rama **preview** → SQL Editor:
```sql
SELECT count(*) FROM "user";      SELECT count(*) FROM session;
SELECT count(*) FROM account;     SELECT count(*) FROM customer_profile;  -- 0 hasta F2 (aún no se crea)
```
Confirma que las filas nuevas están en `preview` y que la rama `production` sigue vacía.

## 15 · Resultado (plantilla — marcar al ejecutar)

| Área | Estado |
|---|---|
| Landing | ⏳ pendiente de ejecución |
| SPA Routing | ⏳ |
| API Routing (`/api/v1/*` ≠ index.html) | ⏳ |
| Health (`db:"up"`) | ⏳ |
| Neon Connection (datos en rama preview) | ⏳ |
| Registration (sin sesión hasta verificar) | ⏳ |
| Verification (enlace vía logs → sesión) | ⏳ |
| Login | ⏳ |
| Session (cookie HttpOnly persiste) | ⏳ |
| Logout (revocación) | ⏳ |
| RBAC (body/localStorage sin efecto) | ⏳ |
| CSRF (Origin externo → 403) | ⏳ |
| Logs (sin secretos) | ⏳ |
| Build | ✅ PASS (verificado aquí; hashes frontend idénticos a pre-F1) |

**Regla acordada**: si algo falla, no se inicia F2 — se corrige solo el problema de Preview y se
re-prueba. Cuando todo sea PASS: **detenerse**. Sin Production y sin F2 hasta tu autorización
tras probar el Preview en navegador real.

## Notas de cierre

- Frontend: Landing / Cliente / Proveedor **intactos** (build con hashes idénticos). Todo lo que
  se ve sigue alimentado por mocks de `src/lib/state.ts` — eso es F2.
- F2 empieza **después** de que este smoke test esté completo en PASS y tú lo autorices.
