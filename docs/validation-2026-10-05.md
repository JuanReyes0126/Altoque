# Validación de Altoque — 5 de octubre de 2026

Repositorio validado: `/Users/juankingss/Altoque`, rama Git `master`.
La carpeta `/Users/juankingss/Documents/ChatGPT/Altoque` contiene un repositorio
vacío y no es la copia con el código de la aplicación.

## Preview y migraciones

El usuario confirmó en Neon que el endpoint `ep-steep-hall-au81p0co` pertenece
a la rama `preview`. La conexión PostgreSQL, consultada dentro de una transacción
de solo lectura, devolvió ese endpoint y la rama `br-spring-paper-auff9g85`.
Las URLs pooled y direct tienen el mismo endpoint, base, usuario y credencial;
la URL de ejecución incluye `-pooler` y la del CLI no lo incluye.

La base conectada estaba vacía, sin tablas ni historial de Prisma. Por tanto,
las tres migraciones estaban pendientes, a diferencia del estado conocido
anteriormente. Se revisaron todas sus sentencias y se aplicaron exclusivamente
con `npx prisma migrate deploy`:

1. `00000000000000_init`: tipos, tablas, índices y constraints del esquema inicial.
2. `20260907192000_add_account_issuer`: columna nullable `account.issuer`.
3. `20260908120000_add_file_table`: tabla `file`, tres índices y FK de propietario.

`add_file_table` es aditiva: no borra ni transforma filas existentes. Su FK tiene
`ON DELETE CASCADE`, por lo que las futuras eliminaciones de usuarios eliminan
su metadata de archivos, conforme a `schema.prisma`.

Después del deploy se comprobaron los checksums de las tres migraciones y:

- 27 tablas de aplicación.
- 32 índices declarados por las migraciones, válidos y listos.
- 68 constraints declarados por las migraciones, validados.
- Índice único parcial `service_request_provider_active_unique` sobre `provider_id`,
  con exactamente `accepted`, `on_the_way`, `arrived`, `in_progress` y provider no nulo.
- Índice único parcial `dispute_one_open_per_request`, para disputas `open`.
- Los cuatro checks de calificaciones entre 1 y 5.
- `account.issuer` nullable y todas las columnas, índices y FK esperados de `file`.

`prisma migrate status` confirmó que no quedan migraciones pendientes.
La comparación de solo lectura con `schema.prisma` devolvió `No difference detected`
y código 0. No se conectó ni modificó Production. No se ejecutaron `db push`,
`migrate dev`, resets ni seed sobre Preview.

El verificador reproducible exige los IDs confirmados antes de acceder o escribir:

```sh
node scripts/validate-preview.mjs --endpoint=ep-steep-hall-au81p0co --branch=br-spring-paper-auff9g85
```

Sin `--deploy` solo inspecciona. `scripts/preview-validation.mjs` fija los nombres
y SHA256 de las tres migraciones previamente inspeccionadas. Cualquier edición
de sus bytes o cambio de inventario se rechaza antes de crear el cliente Prisma
o ejecutar el CLI; esos hashes no se aprueban automáticamente a partir del SQL.
Una migración nueva exige una revisión separada y actualización explícita del
manifiesto. La extracción de tablas/índices/constraints describe SQL ya aprobado,
sin usar su prefijo como garantía de seguridad.

Ambas conexiones deben usar schema ausente o `public`; otros schemas,
parámetros de schema duplicados y variantes de mayúsculas se rechazan antes de
Prisma. Para aplicar pendientes, `--deploy` comprueba nuevamente identidad,
historial y constraints, y relee los hashes inmediatamente antes de ejecutar
el deploy. Se detiene si hay tablas sin historial, migraciones fallidas o cambios
del destino. No incluir URLs ni credenciales en argumentos o logs.

El primer `migrate status` distingue exit 0 (sin pendientes) de exit 1:
este último solo se acepta si la salida conocida de Prisma 6.19.3 enumera
exactamente las pendientes confirmadas por la inspección SQL. Errores reales,
diagnósticos inesperados, señales, timeout, fallo de spawn o status nulo detienen
la ejecución. Una base vacía cuyo CLI indique que no está gestionada por Prisma
también se bloquea para revisión manual; no se hace baseline automáticamente.

## Integración aislada y correcciones

Las suites originales no eran adecuadas para una base compartida: había filtros
de cleanup con IDs potencialmente `undefined`, fixtures dependientes de catálogos
externos, efectos sobre todos los admins y notificaciones/auditorías sin limpiar.
También había cookies sin firma, IDs de usuario usados como IDs de perfil y
supuestos incorrectos sobre tokens de Better Auth.

El runner crea PostgreSQL 17 local con directorio, puerto, base y credenciales
exclusivos de cada ejecución. Escucha únicamente en `127.0.0.1`. Los tests
rechazan destinos remotos, nombres de base ajenos al run y parámetros que
podrían redirigir la conexión. No necesitan credenciales de Neon, Docker ni
un servidor PostgreSQL instalado globalmente. Los binarios son una dependencia
de desarrollo `embedded-postgres` fijada en el lockfile.

Las fixtures tienen IDs propios y cleanup filtrado, incluso ante setup incompleto.
El runner comprueba todas las tablas después de las suites. En éxito cierra el
cluster y elimina solo el directorio temporal recién creado por esa ejecución.
En fallo conserva ese directorio para diagnóstico y devuelve código distinto
de cero; esta ruta se comprobó con un fallo controlado de selección de tests.

Se corrigieron dos defectos del código de aplicación:

- El alta de proveedores usa códigos de referido con 96 bits criptográficos
  (12 bytes, sin truncar). Reintenta como máximo tres veces exclusivamente ante
  `P2002` del unique de `provider_profile.referral_code`. Cada intento abre una
  transacción nueva; otros errores y la última colisión se propagan intactos.
  Esto elimina la colisión por prefijo temporal del ULID y gestiona una eventual
  colisión aleatoria sin reutilizar una transacción abortada.
- El seed crea cuentas nuevas con `accountId = user.id` y el issuer oficial de
  Better Auth. Se preserva la omisión de usuarios existentes, sin rotar passwords.

Las regresiones comprueban altas HTTP concurrentes con reloj fijo, login real
del admin sembrado y repetición del seed sin duplicación ni cambio de credenciales.
Una nueva regresión ocupa un código con un fixture propio y fuerza la secuencia
ocupado → libre: comprueba HTTP 201, dos generaciones, conservación del fixture
y creación completa del nuevo perfil con categorías y zonas. El seed y la
colisión real se ejecutaron únicamente dentro del PostgreSQL local del runner.

La ronda de correcciones de auditoría cerró los tres P2 y el P3: colisiones de
referidos, aprobación insuficiente del SQL, schema sin restringir y exit code
del primer status ignorado. Se añadieron 11 tests offline de referrals (incluidos
límite y errores no elegibles) y 32 de los guards de Preview. Estos últimos usan
URLs ficticias y funciones puras, sin conectar a Neon: cubren `ADD` seguido de
`DROP`, inventario/checksums alterados, schemas rechazados antes de Prisma y
pendientes frente a fallos reales del CLI. Una revisión independiente de los
cambios no encontró otros hallazgos.

## Resultado final

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobado |
| `npm run test:offline` | 77 aprobados, 64 de integración omitidos |
| `npm run test:integration` | 141 aprobados, 0 omitidos, 15 archivos |
| Cleanup de integración | Las 27 tablas de aplicación vacías |
| `npm run build` | Aprobado |
| `git diff --check` | Aprobado |
| Preview migrate status (etapa anterior) | Sin migraciones pendientes |
| Preview schema diff (etapa anterior) | Sin diferencias |

La validación final de las correcciones terminó el 5 de octubre de 2026 a las
05:45 UTC. En esta ronda no se conectó a Neon Preview ni Production: únicamente
se aplicaron las tres migraciones al PostgreSQL temporal exclusivo creado por
el runner. Las migraciones SQL y las dependencias no se modificaron.

Se preservaron los cambios locales previos y ambos stashes. No se hizo commit,
push ni deploy de la aplicación a Vercel. `.env` quedó con permisos privados y
excluido de Git. Ninguna credencial o URL completa real se imprimió en logs.

## Dependencias revisadas y pendientes de remediación

La auditoría adicional `npm audit` informa 9 avisos: 6 moderados y 3 altos,
sin críticos. Los tres HIGH corresponden a una sola vulnerabilidad de agotamiento
del stack ante objetos cíclicos, GHSA-ggr8-5vv4-36mx / CVE-2026-40345:
`deepmerge-ts@7.1.5` → `@prisma/config@6.19.3` → `prisma@6.19.3`.
El uso identificado en Altoque es tooling/configuración del CLI; Prisma está
declarado en dependencies, por lo que también se instala en producción.
No se identificó una ruta de exposición en el servidor Hono.

El parche mínimo de deepmerge-ts es 8.0.0, con cambios incompatibles.
No se verificó un parche compatible de Prisma 6.x. La prerelease
`prisma@8.1.0-dev.5` incorpora una config de la misma versión con
`deepmerge-ts@8.0.2`; no se instaló. La propuesta de npm de bajar Prisma a 6.12.0
es un downgrade fuera del rango actual, no un parche de 6.19.3.

Los moderados afectan Vitest/mocker, Hono, React Router y uuid. Las versiones
afectadas coinciden con las del lockfile anterior a este trabajo; los avisos no
proceden de las nuevas dependencias de test. No se ejecutó `npm audit fix` ni
`--force`, y no se actualizaron Prisma, deepmerge-ts ni las dependencias auditadas.
Su remediación queda como trabajo separado; esta validación no constituye
aprobación para publicar en Production.
