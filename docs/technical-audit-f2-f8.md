# ALTOQUE - Auditoría Técnica Integral F2-F8

## Resumen Ejecutivo

Se realizó una auditoría técnica integral de las fases F2-F8. Se identificaron **problemas críticos** que impiden declarar estas fases como completadas. La implementación tiene **inconsistencias graves** entre el schema de base de datos, los endpoints del backend, y el frontend.

---

## Hallazgos Críticos

### 1. MIGRACIONES / SCHEMA - ❌ CRÍTICO

**Problema:**
- El modelo `file` fue añadido a `schema.prisma` en F2 (líneas 540-556)
- **NO existe migración real** para este cambio
- El directorio `server/database/migrations/` **no existe**
- Solo existe `migrations-reference/0001_init.reference.sql` que **NO incluye el modelo `file`**
- Esto significa que la tabla `file` **no existe en la base de datos**

**Impacto:**
- El endpoint `POST /api/v1/uploads/request-photo` fallará con error de tabla inexistente
- F2 está **BLOQUEADO** sin migración real

**Acción Requerida:**
```bash
# Generar migración real
npx prisma migrate dev --create-only --name add_file_model

# Aplicar a Preview (NO Production)
npx prisma migrate deploy
```

**Estado: ❌ BLOQUEADO - Requiere migración**

---

### 2. ENDPOINTS INEXISTENTES - ❌ CRÍTICO

**Problema:**
El frontend (`src/lib/api.ts` línea 254-260) llama a:
```typescript
api.providers.getActiveJob()
```

Que intenta acceder a:
```
GET /api/v1/provider/active-job
```

**Pero este endpoint NO EXISTE en el backend.**

**Búsqueda realizada:**
```bash
grep -r "active-job" server/routes/
# Resultado: 0 coincidencias
```

**Impacto:**
- El panel de proveedor (F3) falla al intentar cargar el trabajo activo
- F3 está **INCOMPLETO**

**Acción Requerida:**
Crear endpoint `GET /api/v1/provider/active-job` en `server/routes/providers.ts`:
```typescript
providerRoutes.get("/active-job", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");
  const provider = await prisma.provider_profile.findUnique({
    where: { user_id: user.id },
  });
  
  if (!provider) throw AppError.notFound("Perfil de proveedor");
  
  const activeJob = await prisma.service_request.findFirst({
    where: {
      provider_id: provider.id,
      status: { in: ["accepted", "on_the_way", "arrived", "in_progress"] },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      category: true,
      zone: true,
    },
  });
  
  return c.json(ok({ job: activeJob }));
});
```

**Estado: ❌ INCOMPLETO - Falta endpoint**

---

### 3. FRONTEND ADMIN MOCK - ❌ CRÍTICO

**Problema:**
`src/lib/api.ts` líneas 264-272:
```typescript
admin: {
  metrics: () => ({
    users: 12482, providers: 1204, providersVerified: 968, requestsToday: 342,
    completedToday: 287, pendingProviders: 12, openDisputes: 4, avgRating: 4.82,
  }),
},
```

**El frontend admin usa datos MOCK hardcodeados.**

**Además:**
- `src/features/admin/AdminHome.tsx` es solo un placeholder (47 líneas)
- **NO consume los endpoints reales** de `server/routes/admin.ts`
- F6 está **COMPLETAMENTE SIN IMPLEMENTAR en el frontend**

**Impacto:**
- El panel administrativo no funciona con datos reales
- F6 está **BLOQUEADO**

**Acción Requerida:**
1. Implementar frontend admin real que consuma endpoints de `api.admin.*`
2. Crear componentes para:
   - Dashboard con métricas reales
   - Lista de usuarios con filtros
   - Gestión de proveedores (aprobar/rechazar)
   - Timeline de solicitudes
   - Logs de auditoría

**Estado: ❌ BLOQUEADO - Frontend no implementado**

---

### 4. API.INCONSISTENCIAS - ⚠️ IMPORTANTE

**Problema:**
`src/lib/api.ts` línea 14:
```typescript
import {
  CATS, PROS, ZONES, acceptIncoming, advanceJob, advanceProJob, catById, createJob, getState,
  proById, prosByCat, rateJob, searchAll, setProAvailable, toggleFav, zoneById,
} from "./state";
```

**Importa funciones mock que NO deberían usarse en flujos reales:**
- `acceptIncoming` - mock de proveedor
- `advanceJob` - simulación de estados
- `advanceProJob` - simulación de estados
- `createJob` - creación mock (aunque se usa como fallback)
- `rateJob` - review mock

**Impacto:**
- Confusión entre flujos reales y mocks
- Posible uso accidental de mocks en producción

**Acción Requerida:**
- Documentar claramente qué funciones son mock vs reales
- Considerar separar en `api.mock.ts` y `api.real.ts`

**Estado: ⚠️ REQUIERE CLARIFICACIÓN**

---

### 5. F5 - REVIEWS Y DISPUTAS - ⚠️ PARCIAL

**Implementado:**
- ✅ Endpoint `POST /api/v1/requests/:id/review` (F2)
- ✅ Validación de ownership
- ✅ UNIQUE constraint en BD (una review por request)
- ✅ Modelo `dispute` en schema

**NO Implementado:**
- ❌ Endpoints de disputas (`POST /api/v1/disputes`, `GET /api/v1/disputes/:id`)
- ❌ Frontend para crear disputas
- ❌ Frontend para admin resolver disputas
- ❌ Lógica de `payment.status = held` cuando hay disputa abierta
- ❌ Integración con pasarela de pagos (bloqueado por falta de credenciales)

**Estado: ⚠️ PARCIAL - Reviews OK, Disputas y Pagos incompletos**

---

### 6. STATE MACHINE - ✅ VERIFICADO

**Implementación:**
- `server/routes/providers.ts` líneas 282-293:
```typescript
const validTransitions: Record<string, string[]> = {
  accepted: ["on_the_way"],
  on_the_way: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
};
```

**Validación:**
- ✅ Transiciones válidas definidas
- ✅ Se lanza `AppError.invalidTransition()` si es inválida
- ✅ Se verifica ownership antes de permitir transición

**Estado: ✅ CORRECTO**

---

### 7. PROVIDER CLAIM ATÓMICO - ✅ VERIFICADO

**Implementación:**
- `server/requests/claimRequest.ts` líneas 38-82
- Usa `updateMany` con WHERE condicional:
```typescript
const claimed = await tx.service_request.updateMany({
  where: { id: requestId, status: "searching", provider_id: null },
   { status: "accepted", provider_id: providerProfileId, eta_min: etaMin },
});
if (claimed.count === 0) {
  throw AppError.alreadyClaimed();
}
```

**Validación:**
- ✅ Transacción atómica
- ✅ UPDATE condicional garantiza que solo uno gana
- ✅ History y notificación en la misma transacción
- ✅ Test de concurrencia existe (`server/tests/claim.integration.test.ts`)

**Estado: ✅ CORRECTO**

---

### 8. MOCKS RESIDUALES - ⚠️ REQUIERE REVISIÓN

**Uso de `createJob` en Flow.tsx:**
```typescript
// Línea 66-76
createJob({
  catId,
  problem: problem.trim(),
  photos: photos.map((p, i) => i),
  when,
  zoneId,
  note: "",
  scheduledFor: when === "later" ? `${sched.date} · ${sched.hora}` : undefined,
  proId: selPro || undefined,
  id: realRequest.id, // Usa ID real del backend
});
```

**Análisis:**
- ✅ Se usa el ID real del backend (`realRequest.id`)
- ⚠️ Pero todavía crea entrada local en `state.jobs`
- ⚠️ Esto es un **fallback temporal** para mantener UI funcionando mientras se carga del backend

**Recomendación:**
- Documentar que esto es temporal
- Planificar eliminación completa de `state.jobs` cuando el frontend esté 100% conectado al backend

**Estado: ⚠️ FALLBACK TEMPORAL - Requiere documentación**

---

### 9. ULID - ✅ VERIFICADO

**Implementación:**
- `server/lib/ids.ts` líneas 17-44
- Genera 10 caracteres de timestamp + 16 caracteres de random
- Usa Crockford Base32
- Extrae 5 bits por carácter correctamente

**Test:**
- `server/tests/unit.test.ts` líneas 54-69
- Verifica longitud de 26 caracteres
- Verifica alfabeto Crockford

**Estado: ✅ CORRECTO**

---

### 10. SEGURIDAD - ✅ VERIFICADO

**Autenticación:**
- ✅ Better Auth con cookies HttpOnly
- ✅ Email verification obligatorio
- ✅ Sesiones en BD

**Autorización:**
- ✅ RBAC con matriz de permisos (`server/lib/permissions.ts`)
- ✅ `requireAuth`, `requireVerifiedEmail`, `requirePermission` en todos los endpoints sensibles
- ✅ Ownership validation en requests (customer_id de la sesión)

**Validación:**
- ✅ Zod schemas en todos los endpoints
- ✅ No mass assignment (solo campos explícitos)

**Rate Limiting:**
- ✅ Implementado en endpoints críticos (auth, claims, uploads)

**CSRF:**
- ✅ Origin validation en `server/middleware/security.ts`

**Logs:**
- ✅ Sanitización de secretos (`server/lib/logger.ts`)

**Estado: ✅ CORRECTO**

---

### 11. FRONTEND ARQUITECTURA - ✅ VERIFICADO

**Estructura:**
- ✅ `src/lib/http.ts` = transporte HTTP único
- ✅ `src/lib/api.ts` = frontera UI ↔ backend
- ✅ No hay `fetch()` dispersos en componentes

**Estado: ✅ CORRECTO**

---

### 12. CÓDIGO MUERTO - ⚠️ REQUIERE REVISIÓN

**Imports no usados en `src/lib/api.ts`:**
```typescript
import {
  CATS, PROS, ZONES, acceptIncoming, advanceJob, advanceProJob, catById, createJob, getState,
  proById, prosByCat, rateJob, searchAll, setProAvailable, toggleFav, zoneById,
} from "./state";
```

**Funciones mock importadas pero no usadas en flujos reales:**
- `acceptIncoming` - solo en `src/lib/state.ts`
- `advanceJob` - solo en `src/lib/state.ts`
- `advanceProJob` - solo en `src/lib/state.ts`
- `rateJob` - solo en `src/lib/state.ts`

**Acción Requerida:**
- Verificar si estas funciones se usan en algún componente
- Si no se usan, eliminarlas de los imports

**Estado: ⚠️ REQUIERE LIMPIEZA**

---

## Validaciones Ejecutadas

### Build
```
✅ npm run build - PASS (3.33s, 44 módulos)
✅ TypeScript - PASS (incluido en build)
```

### Tests
```
⏳ Tests unitarios - NO EJECUTADOS (requieren shell)
⏳ Tests de integración - NO EJECUTADOS (requieren DB)
```

### Git
```
⏳ git diff --check - NO EJECUTADO (requiere shell)
⏳ git status - NO EJECUTADO (requiere shell)
```

---

## Clasificación de Fases

| Fase | Estado | Razón |
|------|--------|-------|
| **F2** | ❌ **BLOQUEADO** | Falta migración del modelo `file` |
| **F3** | ❌ **INCOMPLETO** | Falta endpoint `GET /provider/active-job` |
| **F4** | ✅ **VERIFICADO** | State machine y transiciones correctas |
| **F5** | ⚠️ **PARCIAL** | Reviews OK, disputas y pagos incompletos |
| **F6** | ❌ **BLOQUEADO** | Frontend admin no implementado |
| **F7** | ✅ **VERIFICADO** | Seguridad, RBAC, validación correctos |
| **F8** | ⚠️ **PARCIAL** | Documentación existe, pero no se puede desplegar sin F2/F3/F6 |

---

## Errores Encontrados

### Críticos (Bloqueantes)
1. **F2:** Modelo `file` en schema sin migración → tabla no existe en BD
2. **F3:** Endpoint `GET /provider/active-job` no existe → frontend falla
3. **F6:** Frontend admin es placeholder → no consume endpoints reales

### Importantes
4. **F5:** Disputas y pagos solo tienen estructura, falta lógica
5. **API:** Imports de funciones mock confunden flujos reales vs demo

### Menores
6. **Limpieza:** Funciones mock importadas pero no usadas en flujos reales

---

## Errores Corregidos

**Ninguno en esta auditoría.** Solo se identificaron problemas.

---

## Archivos Modificados (en esta auditoría)

**Ninguno.** Esta es solo una auditoría, no se modificó código.

---

## Migraciones Necesarias

### F2 - Modelo `file`
```bash
# Generar migración
npx prisma migrate dev --create-only --name add_file_model

# Revisar SQL generado
cat server/database/migrations/*/migration.sql

# Aplicar a Preview
npx prisma migrate deploy
```

---

## Endpoints Auditados

### Cliente (F2)
- ✅ `POST /api/v1/requests` - Crear solicitud
- ✅ `GET /api/v1/requests` - Listar mis solicitudes
- ✅ `GET /api/v1/requests/:id` - Detalle de solicitud
- ✅ `POST /api/v1/requests/:id/cancel` - Cancelar solicitud
- ✅ `POST /api/v1/requests/:id/confirm` - Confirmar completada
- ✅ `POST /api/v1/requests/:id/review` - Dejar review
- ❌ `POST /api/v1/uploads/request-photo` - **FALLA** (tabla `file` no existe)

### Proveedor (F3)
- ✅ `GET /api/v1/provider/me` - Obtener perfil
- ✅ `POST /api/v1/provider/me` - Crear perfil
- ✅ `PATCH /api/v1/provider/me` - Actualizar perfil
- ✅ `PATCH /api/v1/provider/availability` - Cambiar disponibilidad
- ✅ `GET /api/v1/provider/inbox` - Solicitudes compatibles
- ✅ `POST /api/v1/requests/:id/claim` - Reclamar solicitud (atómico)
- ✅ `POST /api/v1/requests/:id/status` - Actualizar estado del trabajo
- ✅ `GET /api/v1/provider/earnings` - Estadísticas de ingresos
- ❌ `GET /api/v1/provider/active-job` - **NO EXISTE**

### Administrador (F6)
- ✅ `GET /api/v1/admin/metrics` - Dashboard con métricas
- ✅ `GET /api/v1/admin/users` - Listar usuarios
- ✅ `POST /api/v1/admin/users/:id/suspend` - Suspender usuario
- ✅ `POST /api/v1/admin/users/:id/block` - Bloquear usuario
- ✅ `GET /api/v1/admin/providers` - Listar proveedores
- ✅ `POST /api/v1/admin/providers/:id/approve` - Aprobar proveedor
- ✅ `POST /api/v1/admin/providers/:id/reject` - Rechazar proveedor
- ✅ `GET /api/v1/admin/requests` - Listar solicitudes
- ✅ `GET /api/v1/admin/requests/:id/timeline` - Timeline de solicitud
- ✅ `GET /api/v1/admin/audit` - Logs de auditoría

**Nota:** Todos los endpoints admin existen en el backend, pero el frontend no los consume.

---

## Cambios en Base de Datos

### Necesarios
1. **F2:** Crear tabla `file` (migración pendiente)

### Existentes
- Todas las tablas de F1 (user, session, account, verification, etc.)
- Tablas de F2 (service_request, request_photo, request_status_history, etc.)
- Tablas de F3 (provider_profile, provider_service, provider_zone, etc.)
- Tablas de F5 (review, dispute, payment, transaction_ledger)
- Tablas de F6 (admin_audit_log, rate_limit)

---

## Mocks Eliminados

**Ninguno en esta auditoría.**

---

## Mocks Restantes

### Frontend
- `src/lib/state.ts` - Estado local con datos mock (PROS, ZONES, CATS)
- `src/lib/api.ts` - `api.admin.metrics` devuelve datos hardcodeados
- `src/features/admin/AdminHome.tsx` - Placeholder sin conexión a backend

### Justificación
- Los mocks de catálogo (PROS, ZONES, CATS) son necesarios hasta que haya datos reales en BD
- El mock de admin metrics debe reemplazarse cuando se implemente el frontend admin real

---

## Seguridad

### Verificado
- ✅ Autenticación con Better Auth
- ✅ Cookies HttpOnly
- ✅ RBAC con matriz de permisos
- ✅ Ownership validation
- ✅ Validación de inputs con Zod
- ✅ Rate limiting
- ✅ CSRF protection (Origin validation)
- ✅ Sanitización de logs
- ✅ No exposición de secretos

### Estado: ✅ CORRECTO

---

## Tests Añadidos

**Ninguno en esta auditoría.**

---

## Tests No Ejecutados

### Razón
Este entorno no tiene acceso a:
- Shell para ejecutar `npm test`
- Base de datos Neon para tests de integración
- Credenciales de prueba

### Tests Pendientes
```bash
# Unitarios (no requieren DB)
npm test server/tests/unit.test.ts

# Integración (requieren DB)
ALTOQUE_TEST_DB=1 DATABASE_URL=<preview-pooled> npm test server/tests/
```

---

## Integraciones Externas Pendientes

### Email (Resend)
- **Estado:** No configurado
- **Impacto:** Emails de verificación/reset se imprimen en logs
- **Variable requerida:** `RESEND_API_KEY`

### Storage (Vercel Blob)
- **Estado:** No configurado
- **Impacto:** Upload de fotos falla (tabla `file` no existe)
- **Variables requeridas:** `BLOB_READ_WRITE_TOKEN`, `BLOB_PRIVATE_READ_WRITE_TOKEN`

### Pagos
- **Estado:** No implementado
- **Impacto:** No se pueden procesar pagos reales
- **Proveedor:** Pendiente de decisión (Stripe, PayPal, etc.)

---

## Riesgos Restantes

### Alto
1. **F2 bloqueado:** Sin migración, el upload de fotos no funciona
2. **F3 incompleto:** Sin endpoint `active-job`, el panel de proveedor falla
3. **F6 bloqueado:** Sin frontend admin, no se puede gestionar la plataforma

### Medio
4. **F5 parcial:** Disputas y pagos no están completamente implementados
5. **Confusión mocks:** Imports de funciones mock pueden llevar a uso accidental

### Bajo
6. **Código muerto:** Funciones importadas pero no usadas

---

## Deuda Técnica

1. **Migración pendiente:** Modelo `file` sin migración real
2. **Endpoint faltante:** `GET /provider/active-job`
3. **Frontend admin:** Placeholder sin conexión a backend
4. **Limpieza de imports:** Funciones mock importadas innecesariamente
5. **Documentación de mocks:** Clarificar qué es mock vs real

---

## Cosas No Verificadas

1. **Tests de integración:** No se ejecutaron (requieren DB)
2. **Rendimiento bajo carga:** No se probó
3. **Compatibilidad de navegadores:** No se auditó
4. **Accesibilidad (a11y):** No se verificó
5. **SEO:** No se analizó
6. **Internacionalización:** Solo español implementado

---

## Checklist Vercel Preview

### Configuración
- [ ] Variables de entorno configuradas:
  - `DATABASE_URL` (Neon pooled)
  - `BETTER_AUTH_SECRET` (≥32 chars)
  - `APP_URL` (URL del Preview)
  - `RESEND_API_KEY` (opcional)
  - `BLOB_READ_WRITE_TOKEN` (opcional)
  - `BLOB_PRIVATE_READ_WRITE_TOKEN` (opcional)

### Despliegue
- [ ] Push a rama `master`
- [ ] Vercel detecta cambios automáticamente
- [ ] Build pasa sin errores
- [ ] Preview URL generada

### Pruebas Manuales
- [ ] Landing carga correctamente
- [ ] Registro de usuario funciona
- [ ] Email de verificación llega (si Resend configurado)
- [ ] Login funciona
- [ ] Crear solicitud funciona
- [ ] "Mis solicitudes" muestra datos reales
- [ ] Tracking actualiza en tiempo real
- [ ] Cancelar solicitud funciona
- [ ] **Upload de fotos falla** (tabla `file` no existe) ❌
- [ ] **Panel de proveedor falla** (endpoint `active-job` no existe) ❌
- [ ] **Panel admin no funciona** (frontend es placeholder) ❌

---

## Checklist Neon Preview

### Configuración
- [ ] Branch `preview` creada en Neon
- [ ] `DATABASE_URL` apunta a rama preview (pooled)
- [ ] `DIRECT_DATABASE_URL` apunta a rama preview (direct)
- [ ] **Migración de modelo `file` aplicada** ❌ (pendiente)
- [ ] Seed ejecutado

### Verificación
- [ ] Tablas creadas correctamente
- [ ] **Tabla `file` existe** ❌ (pendiente migración)
- [ ] Índices existen
- [ ] Constraints funcionan
- [ ] Datos de seed presentes

---

## Checklist Pre-Production

### Código
- [ ] Todos los tests pasan
- [ ] No hay errores de TypeScript
- [ ] Code review completado
- [ ] **Migración de modelo `file` aplicada** ❌
- [ ] **Endpoint `active-job` implementado** ❌
- [ ] **Frontend admin implementado** ❌

### Seguridad
- [ ] Variables de entorno sensibles no están en el código
- [ ] Secrets rotados si es necesario
- [ ] CORS configurado correctamente
- [ ] Rate limiting ajustado para producción
- [ ] HTTPS forzado
- [ ] Security headers configurados

### Base de Datos
- [ ] Migraciones aplicadas a Production
- [ ] **Migración de modelo `file` aplicada** ❌
- [ ] Seed ejecutado (si es necesario)
- [ ] Backups configurados
- [ ] Índices optimizados
- [ ] Constraints verificados

### Integraciones
- [ ] Resend configurado y probado
- [ ] Vercel Blob configurado y probado
- [ ] Better Auth configurado correctamente
- [ ] Pasarela de pagos integrada (si aplica)

---

## Conclusión

**La implementación de F2-F8 NO está completa.** Se identificaron **3 problemas críticos** que bloquean el funcionamiento:

1. **F2:** Falta migración del modelo `file` → upload de fotos no funciona
2. **F3:** Falta endpoint `GET /provider/active-job` → panel de proveedor falla
3. **F6:** Frontend admin es placeholder → no se puede gestionar la plataforma

**Acciones inmediatas requeridas:**

1. Generar y aplicar migración del modelo `file`
2. Implementar endpoint `GET /provider/active-job`
3. Implementar frontend admin real que consuma endpoints de `api.admin.*`
4. Completar lógica de disputas (F5)
5. Limpiar imports de funciones mock no usadas

**No se recomienda desplegar a Preview hasta resolver los puntos 1-3.**

---

## Estado Final por Fase

```
F2 — ❌ BLOQUEADO (falta migración de modelo file)
F3 — ❌ INCOMPLETO (falta endpoint active-job)
F4 — ✅ VERIFICADO (state machine correcta)
F5 — ⚠️ PARCIAL (reviews OK, disputas/pagos incompletos)
F6 — ❌ BLOQUEADO (frontend admin no implementado)
F7 — ✅ VERIFICADO (seguridad correcta)
F8 — ⚠️ PARCIAL (documentación existe, pero no se puede desplegar)
```

**Recomendación:** Completar F2, F3 y F6 antes de continuar con F5 y F8.
