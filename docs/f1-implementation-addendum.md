# ALTOQUE · F1 Final Implementation Addendum

> **Estado:** v1.1 aprobada en principio → este addendum resuelve las 5 correcciones finales.
> **Alcance:** sustituye (no complementa) las secciones §3, §4.3 y §7 de *f1-technical-architecture-v1.1.md* en los puntos que toca. El resto de v1.1 sigue vigente.
> **Regla de oro de F1:** Better Auth es la fuente de verdad de `user`, `session`, `account` y `verification`. PostgreSQL es la fuente de verdad del dominio. El frontend solo representa lo que el servidor autoriza.

---

## 1 · Auth: almacenamiento de tokens y sesiones (corrige §4.3 y §7 de v1.1)

Se elimina cualquier afirmación de hashing propio sobre la sesión. La separación exacta es:

| Elemento | Quién lo gestiona | Comportamiento |
|---|---|---|
| **Cookie de sesión** | Better Auth | Emitida, firmada y renovada por Better Auth. `HttpOnly`, `Secure`, `SameSite=Lax` (default oficial; ver §6 de v1.1). **El JavaScript del navegador nunca puede leerla.** |
| **Registro `session` en BD** | Better Auth | Estructura **oficial** de la versión pineada (id, token, userId, expiresAt, ipAddress, userAgent, createdAt, updatedAt). La columna `token` almacena el valor según el comportamiento oficial de Better Auth en esa versión. **No se añade hashing casero.** Si una versión futura incorpora hashing opcional de token, se habilitará **por configuración oficial**, nunca con criptografía propia. |
| **Identificadores de verificación/reset** | Better Auth + config | Se configura `verification: { storeIdentifier: "hashed" }` si la versión pineada lo soporta (verificado contra la documentación de esa versión exacta durante el paso 0 de F1). Si no estuviera soportado, las garantías equivalentes son: tokens de vida corta, **un solo uso** (invalidados tras el primer canje) y vinculados al identificador + usuario. |
| **Esquema de auth** | `@better-auth/cli` | `user`, `session`, `account` y `verification` se generan con `npx @better-auth/cli generate` **contra la versión pineada**. Nuestro `schema.prisma` contiene exactamente esos modelos, más las extensiones de dominio documentadas en §3. Cero estructuras paralelas. |

**Versión de Better Auth:** se fija en el paso 0 de F1 contra el registro (línea estable 1.x, patch exacto — política de pinning en §4). El comando `generate` contra esa versión es un paso obligatorio del checklist de F1; el schema resultante se commitea.

---

## 2 · Neon + Prisma: estrategia definitiva de transacciones (corrige §3 de v1.1)

### 2.1 La contradicción queda eliminada: **no usamos driver adapter**

El claim atómico de Altoque exige transacciones interactivas reales (`BEGIN → claim condicional → history → notificación → COMMIT`, con `ROLLBACK` total ante cualquier fallo).

- El modo HTTP del driver de Neon (una petición HTTP por query, sin sesión de conexión) no puede mantener un `BEGIN` abierto entre round-trips; Prisma documentó limitaciones de transacciones interactivas sobre driver adapters.
- Aunque los adapters alcanzaron GA (Prisma ≥ 6.16), Altoque elige el camino sin ambigüedad: **PrismaClient estándar (query engine) contra el pooler de Neon**, donde las transacciones interactivas siempre han estado soportadas.
- Consecuencia: **`@prisma/adapter-neon` no se instala**. Una dependencia menos, una clase de fallo menos.

### 2.2 Configuración final

```
Runtime (Vercel Functions)                 Prisma CLI / migraciones / seeds
──────────────────────────                 ────────────────────────────────
PrismaClient({ datasourceUrl })            prisma migrate / db seed
        │                                          │
   DATABASE_URL                               DIRECT_DATABASE_URL
   (endpoint -pooler,                          (endpoint directo,
    pgbouncer=true,                             sin pooler)
    connect_timeout=15)
        │                                          │
        ▼                                          ▼
   Neon pooler (transaction mode)              Neon compute
   cada transacción se fija a una
   conexión backend durante su duración
```

- **Interactivas soportadas:** el pooler de Neon opera en modo transacción; `$transaction(async tx => …)` abre, ejecuta y cierra sobre una conexión backend dedicada. Es el setup canónico documentado por Prisma + Neon (flag `pgbouncer=true` en la URL, que además desactiva prepared statements a nivel de sesión — incompatible con transaction pooling).
- **Instancia única:** singleton con `globalThis` en `server/database/client.ts`. **Cero `prisma.$disconnect()` por request.** Conexión lazy; el runtime de Vercel reutiliza la instancia dentro del contexto de la función.
- **Sin números fijos de pool:** el tamaño efectivo lo gobiernan el pooler de Neon y el plan contratado; no se documentan cifras que dependan del proveedor.

### 2.3 El claim, exactamente así

```ts
await prisma.$transaction(async (tx) => {
  const claimed = await tx.$queryRaw`
    UPDATE service_requests
       SET provider_id = ${providerId},
           status      = 'accepted',
           eta_minutes = ${etaMin},
           updated_at  = NOW()
     WHERE id = ${requestId}
       AND status = 'searching'
       AND provider_id IS NULL
     RETURNING id`;
  if (claimed.length === 0) throw new AppError("REQUEST_ALREADY_CLAIMED", 409);

  await tx.requestStatusHistory.create({ data: { requestId, from: "searching", to: "accepted", actorId: providerId } });
  await tx.notification.create({ data: { userId: request.customerId, type: "request_accepted", ... } });
}); // COMMIT — o ROLLBACK total si cualquier paso lanza
```

### 2.4 Integration test obligatorio (contra Neon real, rama dev)

| Caso | Aserción |
|---|---|
| **Commit feliz** | request `accepted` + `provider_id` fijado · **exactamente 1** fila en `request_status_history` · **exactamente 1** notificación |
| **Rollback** (fallo inyectado tras el history, p. ej. insert de notificación lanza) | request **sin cambios** · **0** filas de history · **0** notificaciones |
| **Concurrencia** (2 claims simultáneos al mismo request) | exactamente **1** ganador · el perdedor recibe `409 REQUEST_ALREADY_CLAIMED` · sin estados parciales ni history duplicado |

Este test se escribe **en F1**, no se pospone. Si no pasa, F1 no se cierra.

### 2.5 Versiones de esta decisión

- `prisma` y `@prisma/client`: **misma línea 8.x, mismo patch exacto** (si la versión pineada de Better Auth exigiera una línea Prisma inferior por compatibilidad de su adaptador, se pinea esa y se documenta el motivo).
- `prisma.config.ts` apunta a `DIRECT_DATABASE_URL`; el runtime usa `DATABASE_URL` vía `datasourceUrl`.

---

## 3 · Role y admin_role: esquema definitivo

Los valores viven **en PostgreSQL**, no en TypeScript. Tres mecanismos, una verdad:

### 3.1 `user.role` — Better Auth con `input: false`

```prisma
enum UserRole { customer provider admin }

// modelo user (generado por Better Auth + extensión oficial)
model User {
  // ...campos oficiales de Better Auth...
  role UserRole @default(customer)   // additionalField declarado en la config
  // ...
}
```

```ts
betterAuth({
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "customer", input: false },
    },
  },
  // ...
});
```

Triple barrera contra la escalada en el registro:
1. `input: false` → Better Auth ignora `role` en el payload de sign-up.
2. El esquema Zod de registro es estricto → campos no esperados se rechazan.
3. El enum de PostgreSQL → último muro: ningún valor fuera de `{customer, provider, admin}` persiste jamás.

### 3.2 `admin_profiles` — entidad explícita

```prisma
enum AdminRole { support moderator admin super_admin }

model AdminProfile {
  userId    String    @id @map("user_id")
  adminRole AdminRole @default(support) @map("admin_role")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("admin_profiles")
}
```

- Una fila solo nace por: **seed** (el super_admin fundador) o **operación de super_admin** auditada (`admin.role.change`).
- `user.role = admin` **sin** fila en `admin_profiles` ⇒ permisos vacíos ⇒ 403. No existen permisos implícitos.
- Solo `super_admin` puede insertar/modificar `admin_role` (matriz RBAC de v1.1 §11, forzada en servidor).

### 3.3 Cómo nace un provider — decisión tomada: **modelo de doble capacidad**

```
Registro → user.role = customer  (siempre, sin excepción)
    │
    ▼  "Quiero ofrecer servicios" (onboarding, usuario autenticado)
provider_profiles creado · verification_status = draft → pending_verification
user.role sigue siendo customer
    │
    ▼  aprobación del admin (transacción auditada)
provider_profiles.verification_status = verified  +  user.role = provider
```

Reglas de autorización resultantes (forzadas en servidor, endpoint por endpoint):

| Recurso | Requisito |
|---|---|
| Endpoints de **cliente** (pedir, seguir, reseñar) | `user.role ∈ {customer, provider}` — un provider sigue siendo persona que contrata servicios |
| Endpoints de **provider** (inbox, claim, trabajo, ingresos) | `user.role = provider` **Y** `provider_profiles.verification_status = verified` |
| Onboarding provider | autenticado + `role = customer` + sin provider_profile verificado |
| Endpoints **admin** | `role = admin` + fila en `admin_profiles` + permiso según `admin_role` |
| Suspensión de un provider | `verification_status = suspended` → pierde capacidades provider; **conserva** las de cliente |

Razón de la decisión: coincide con la UX ya construida (misma cuenta, cambio de modo cliente↔pro), evita cuentas duplicadas por persona, y convierte la capacidad provider en **datos verificables** (`provider_profiles`) en lugar de un flag de rol — que es exactamente lo que el admin aprueba, suspende y audita.

---

## 4 · Versiones que se fijan

Política: **versiones exactas en `package.json` (sin `^`, sin `~`, sin `*`, sin `latest`) y `package-lock.json` commiteado.** El paso 0 de F1 materializa los patches exactos vigentes y commitea el lockfile antes de escribir código de servidor.

| Componente | Línea objetivo | Nota |
|---|---|---|
| **Node.js** | 22 LTS | `engines` en package.json + `.nvmrc` + runtime Vercel `nodejs22.x` |
| **prisma / @prisma/client** | 8.x (mismo patch ambos) | o la línea que la versión de Better Auth requiera; se documenta si ocurre |
| **@prisma/adapter-neon** | — | **no se instala** (§2.1) |
| **@neondatabase/serverless** | — | no se instala (el engine estándar de Prisma gestiona la conexión) |
| **better-auth** | 1.x estable | patch exacto fijado en paso 0; `@better-auth/cli generate` contra esa versión |
| **hono** | 4.x | patch exacto |
| **zod** | 3.25.x | alineada con el zod interno de Better Auth para no duplicar dependencia transitiva |

Un deploy futuro no podrá cambiar comportamiento crítico por deriva de versiones: el lockfile lo impide.

---

## 5 · Tests añadidos (se suman a la suite de v1.1 §23)

**Auth y roles**
- Registro con `role: "admin"` en el payload → ignorado/rechazado; el usuario se crea como `customer`.
- Registro con `role: "super_admin"` → ignorado/rechazado.
- Payload de request manipulado para incluir/alterar `role` → ignorado/rechazado por el esquema estricto.
- Solo `super_admin` puede modificar `admin_role` (intento de `admin` → 403 + audit log del intento).
- El comportamiento de sesión coincide con el esquema oficial de Better Auth (columnas, cookie, expiración).
- Sesión expirada → rechazada. Sesión revocada → rechazada.
- Cuenta no verificada → no accede a operaciones protegidas (solo verificación/resend).
- Los permisos de admin se comprueban en servidor (llamada directa al API sin pasar por la UI).
- Cambiar el rol en `localStorage` del cliente → **no produce ningún efecto** (el rol viene de la sesión de BD).
- Un provider que cambia el ID de request en el frontend → no obtiene acceso a requests ajenos (ownership).
- Un documento privado de provider (cédula, selfie) → inaccesible sin sesión + permiso (403/404, nunca URL pública).

**Transacción de claim**
- **Commit:** request `accepted`, exactamente 1 history, exactamente 1 notificación.
- **Rollback:** fallo inyectado → request sin cambios, 0 history, 0 notificaciones.
- **Concurrencia:** dos claims simultáneos → 1 ganador, 1 perdedor con `409 REQUEST_ALREADY_CLAIMED`, sin estados parciales.

---

## Estado final

| Corrección | Resolución |
|---|---|
| 1 · Token storage | Better Auth fuente de verdad; sin hashing casero; `storeIdentifier: "hashed"` si la versión lo soporta |
| 2 · Transacciones | Adapter eliminado; PrismaClient estándar + pooler Neon (`pgbouncer=true`); `$transaction` interactiva garantizada; integration test obligatorio en F1 |
| 3 · Roles | `user.role` (enum, `input: false`) + `admin_profiles` (enum) + doble capacidad provider vía `provider_profiles` — todo en PostgreSQL |
| 4 · Versiones | Pinning exacto, lockfile commiteado, líneas objetivo fijadas |
| 5 · Tests | Suite ampliada con los 14 casos anteriores |

**Los cinco puntos quedan resueltos.** Con tu confirmación, arranca **F1 · BASE REAL — IMPLEMENTACIÓN** exactamente sobre v1.1 + este addendum.
