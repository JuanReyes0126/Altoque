# ALTOQUE · Database (F1.1)

## Entornos (separación estricta — Addendum §4)

| Entorno       | Neon                              | Uso                                     |
|---------------|-----------------------------------|-----------------------------------------|
| Development   | rama `dev`                        | desarrollo local — jamás Production     |
| Preview       | rama/branch efímera por preview   | pruebas de PR/preview de Vercel         |
| Production    | rama `main` (protegida)           | solo migraciones controladas vía CI     |

Variables por entorno:

```
DATABASE_URL         = neon pooled  (…-pooler.…/?pgbouncer=true)   ← runtime
DIRECT_DATABASE_URL  = neon direct  (sin -pooler)                  ← CLI / migraciones
```

## Flujo oficial de migraciones

```bash
# 1) Primera migración (rama DEV):
npx prisma migrate dev --name init

# 2) Añadir los bloques "EXTRA" de migrations-reference/0001_init.reference.sql
#    al final de la migración generada (índices parciales + CHECKs).

# 3) Verificar equivalencia schema ↔ BD:
npx prisma migrate diff --from-url "$DIRECT_DATABASE_URL" \
  --to-schema-datamodel server/database/schema.prisma --script
#    → solo deben aparecer los bloques EXTRA.

# 4) Validar schema sin tocar la BD:
npx prisma validate

# 5) Seed de catálogo: solo una DB local dedicada altoque_dev,
#    después de configurar localmente su entorno ignorado:
node --env-file=.env --import=tsx server/database/seeds/seed.ts --apply

# 6) Producción (controlado, NUNCA en desarrollo):
npx prisma migrate deploy        # en CI, con las credenciales de Production
```

## Reglas

- **Nunca** `prisma db push` contra Production.
- **Nunca** migraciones destructivas (`--create-only` con drops) sin revisión manual.
- `migrations-reference/0001_init.reference.sql` es referencia legible; la
  migración oficial es la generada por el CLI en `migrations/`.

## Cliente runtime

`server/database/prisma.ts` — singleton `globalThis`, PrismaClient estándar
contra la URL pooled, **sin** `$disconnect()` por request. Las transacciones
interactivas (`$transaction(async tx => …)`) están soportadas: el pooler de
Neon fija cada transacción a una conexión backend (modo transacción).

## Administrador real

El bootstrap dedicado y sus guardias de destino están documentados en
[docs/admin-bootstrap.md](../../../docs/admin-bootstrap.md). El seed de catálogo
rechaza destinos remotos. Crear el administrador en Preview requiere una
autorización explícita y el CLI dedicado; no ejecuta migraciones ni catálogo.

La suite de integración crea un PostgreSQL local exclusivo por ejecución, aplica
las tres migraciones existentes y comprueba cleanup. No hereda ni lee `.env`.
