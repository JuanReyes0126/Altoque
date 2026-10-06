# Bootstrap administrativo seguro

El administrador utiliza la misma autenticación de Better Auth que el resto de
usuarios. Una cuenta administrativa efectiva requiere `user.role = admin`,
`emailVerified = true`, estado `active`, una credencial local válida y
`admin_profile.admin_role = super_admin`. El frontend no concede permisos.

## Preparación manual

1. Introduce localmente `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en un archivo
   de entorno ignorado por Git. La contraseña debe tener entre 16 y 128 caracteres.
   No las pegues en el chat, argumentos del comando, historial de shell ni informes.
2. Confirma el destino antes de ejecutar. Production está prohibido. El bootstrap
   no crea bases, no aplica migraciones y no cambia categorías ni zonas.
3. Ejecuta únicamente el comando apropiado después de autorizar la creación de
   esta cuenta. Sin `--apply`, el CLI se detiene antes de conectar.

Para una base local dedicada `altoque_dev`, accesible por `127.0.0.1` en un puerto
explícito no privilegiado, configura su `DATABASE_URL` localmente y ejecuta:

```sh
node --env-file=.env --import=tsx server/database/seeds/bootstrap-admin.ts --apply
```

Para Preview, esta ronda solo dejó preparado el comando; no lo ejecutó. Primero
comprueba manualmente en Neon que la rama se llama **preview** y conserva estos
identificadores previamente confirmados. Configura localmente `DATABASE_URL`
pooled y `DIRECT_DATABASE_URL` direct de esa misma rama, con schema ausente o
`public`. Después de autorizar esa escritura, el comando exacto es:

```sh
node --env-file=.env --import=tsx server/database/seeds/bootstrap-admin.ts --apply --preview-endpoint=ep-steep-hall-au81p0co --preview-branch=br-spring-paper-auff9g85
```

El script restringe el endpoint y la rama a esos identificadores, compara el par
pooled/direct y verifica la identidad real de PostgreSQL en una transacción
`READ ONLY` antes de escribir. Cualquier diferencia detiene la operación. No
imprime email, contraseña, hashes, tokens, cookies o conexiones.

## Login y repetición

Después de crear la cuenta, inicia sesión desde el formulario normal con los
valores introducidos localmente. El servidor devuelve el rol real y la app abre
`#/admin`; `/api/v1/admin/*` sigue comprobando los permisos de `admin_profile`.

Repetir el bootstrap con el mismo email devuelve
`ADMIN_ALREADY_PROVISIONED_PASSWORD_UNCHANGED`: conserva ID, contraseña,
verificación y permisos. Una contraseña distinta en el archivo no rota la
existente. Para cambiarla usa el flujo real de autenticación autorizado.

Si ese email ya pertenece a un cliente, admin incompleto, cuenta suspendida o
credencial incompatible, se detiene con
`ADMIN_EXISTING_ACCOUNT_REQUIRES_REVIEW`. No promueve usuarios, crea credenciales
adicionales, verifica cuentas ni modifica privilegios silenciosamente. Revisa la
cuenta con una operación administrativa separada y autorizada, o elige un email
nuevo para el bootstrap.

Tras completar la creación, elimina `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`
del archivo local. Estas variables no pertenecen al runtime de Vercel.

## Seed de catálogo

`server/database/seeds/seed.ts` ahora admite únicamente una base local dedicada
`altoque_dev` con `--apply`, o la base temporal identificada del runner. Rechaza
todos los destinos remotos. El bootstrap dedicado anterior permite crear el admin
en Preview sin ejecutar upserts de categorías, zonas o secuencia.

Los tests usan exclusivamente el PostgreSQL temporal de `npm run test:integration`,
con credenciales sintéticas generadas y cleanup de sus propias filas.
