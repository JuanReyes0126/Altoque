# Altoque — pulido visual y UI/UX

Fecha: 6 de octubre de 2026. Base: `ffb8b46713ebcf424558b1ae6cc35873f0475e0a`, rama `master`.

## Resultado y alcance

Ronda local de presentación, responsive y accesibilidad. Se enriquecieron landing y paneles cliente/profesional/admin conservando rutas, acciones y operaciones existentes. Se corrigió el P3 visual del switch Online/Offline. Los estados vacíos, loading y error se distinguen y ofrecen acciones reales.

No se añadieron métricas, testimonios, actividad, personas, precios ni ETAs ficticios al producto. Las categorías y profesionales mostrados proceden del API. Los avatares usan imagen real o iniciales; ratings sólo aparecen si existen reseñas. Precio/ETA ausentes se muestran por confirmar. El esquema de zona del trabajo activo queda explícitamente identificado como ilustración sin seguimiento GPS.

No se cambiaron contratos públicos, backend, autenticación, hooks de datos, dependencias, CI, configuración, schema ni migraciones. La comparación independiente de llamadas `api/authApi/profileApi` entre HEAD y diff en los 19 TSX no encontró cambios en llamadas o payloads. La sección AuthSheet de la landing permanece sin modificaciones; su componente Sheet compartido recibió mejoras de foco/teclado.

Sin staging, commit, push ni deploy. Sin escrituras en Neon, Vercel, Resend, Production, variables, DNS o dominios. La evaluación final posterior inspeccionó únicamente metadata de Preview y CI en modo read-only. No se inspeccionaron valores de `.env`; permanece ignorado y no tracked. No se eliminaron stashes ni backups.

## Cambios y problemas comprobados

| Área | Problema o necesidad | Solución y evidencia |
| --- | --- | --- |
| Landing | Presentación austera tras retirar datos demo. | Hero con ilustración SVG abstracta, accesos a categorías reales, recorrido del servicio, perfiles reales, CTA profesional, FAQ nativa y footer. Se conservan búsqueda, acceso y registro. Sin cifras inventadas. |
| Landing móvil · P3 | A 320 px, una columna implícita de grid excedía el ancho y el contenedor ocultaba contenido. La figura SVG además heredaba un relleno negro no deseado. | Grid de una columna y `min-w-0`; SVG con `fill="none"`. Comprobado hero dentro del viewport, también a 390 y 1440 px. |
| Cliente | Jerarquía, orientación y estados de varias vistas poco desarrollados. | Header/nav desktop y navegación inferior móvil con `aria-current`; home, categorías, perfil, direcciones, seguridad, solicitudes y wizard con títulos, cards, ayuda y feedback. Todas las acciones existentes conservadas. |
| Solicitudes | Seguimiento podía resultar poco explícito visualmente. | Badge del estado real y timeline exclusivamente de eventos persistidos. No se interpolan avances ni fechas. Se conservan confirmación, cancelación, valoración y disputa. |
| Formulario móvil · P3 | Una dirección guardada larga imponía el ancho mínimo del fieldset; formulario de 420 px en viewport de 390 px. | `min-inline-size: 0` en fieldsets. Ancho final de página 390 px, dirección seleccionable y solicitud creada realmente desde UI. |
| Disponibilidad · A27/P3 | Knob sin anclaje horizontal consistente y medidas desalineadas. | Track 80×44 px, knob 36×36 px, offsets 4 px y desplazamiento 36 px. Medido en navegador: margen 4 px en ambos extremos. Switch controlado, ocupado/deshabilitado y foco visible; PATCH y persistencia intactos. |
| Profesional | Avatar/nombre dependían de `profile.user`, que no está presente en el DTO real de getMe. | Fallback a identidad de sesión y después iniciales, sin retratos demo. Confirmado con API real local y regresión. |
| Profesional | Inbox, servicio activo, perfil/onboarding y navegación requerían jerarquía/estados más completos. | Cards y layout oscuro responsive; dirección autorizada, estados reales y formulario agrupado. La ausencia de solicitudes es normal, con disponibilidad operativa. ETA sólo se muestra tras la selección real existente. |
| Admin | Listas/tablas y modales necesitaban mayor legibilidad, navegación táctil y adaptación móvil. | Header/cards/tabs, métricas reales, tablas con caption/column headers y región de scroll horizontal enfocable. Todas las columnas y seis secciones permanecen. Metadata y controles anterior/siguiente existentes conservados. |
| Teclado · P3 | Modales sin confinamiento/restauración de foco; deshabilitar el control enfocado podía dejar Tab fuera del diálogo. | Sheet, modal ETA, resolver disputa y ambos formularios de disputa con etiquetas, foco inicial/restauración, Escape y Tab/Shift+Tab. Manejo explícito de foco externo/deshabilitado/sin controles. Durante envío se mantienen las guardias existentes. Regresiones y navegador real. |
| Accesibilidad | Contraste débil de algunos tokens, controles táctiles pequeños y estados poco anunciados. | Tokens soft/cor/ok con contraste calculado sobre fondos usados; objetivos táctiles, labels, ayuda, status/alert/busy, skip links y focus-visible. Contraste soft sobre paper: 4.84:1; cor sobre corsoft: 4.89:1; ok sobre oksoft: 5.30:1. No constituye certificación WCAG completa. |
| Microinteracciones | Animaciones existentes podían conservar retrasos aun con reduced motion. | Feedback hover/press, skeletons y animaciones conservados; reduced-motion también elimina animation-delay. No se agregaron librerías. |

## Archivos afectados

29 archivos: 21 tracked modificados y ocho nuevos, incluyendo este informe.

| Grupo | Archivos |
| --- | --- |
| Shell y componentes compartidos | `src/App.tsx`, `src/index.css`, `src/components/Toast.tsx`, `src/components/ui/kit.tsx`; nuevos `src/components/ui/feedback.tsx`, `src/components/ui/use-dialog-focus.ts`. |
| Landing | `src/features/landing/Landing.tsx`. |
| Cliente | `src/features/client/Home.tsx`, `Flow.tsx`, `Profile.tsx`, `Addresses.tsx`, `Security.tsx`, `RequestWizard.tsx`, `Requests.tsx`, `DisputeModal.tsx`. |
| Profesional | `src/features/provider/ProApp.tsx`, `ProviderPanelStates.tsx`, `ProviderProfileSetup.tsx`, `ProDisputeModal.tsx`. |
| Admin | `src/features/admin/AdminHome.tsx`, `AdminPagination.tsx`, `AdminDataState.tsx`. |
| Tests | Modificado `server/tests/admin-pagination.test.ts`; nuevos `landing-ui.test.ts`, `client-ui-polish.test.ts`, `provider-ui-polish.test.ts`, `admin-ui.test.ts`, `dispute-modal-ui.test.ts`, todos bajo `server/tests/`. |
| Informe | Nuevo `docs/pulido-uiux-2026-10-06.md`. |

## Tests y validación final

47 tests nuevos netos respecto de HEAD:

- Landing: siete regresiones de acciones reales, búsqueda/consulta obsoleta, retry/vacío honesto, FAQ, menú móvil y navegación con reduced motion.
- Cliente/compartidos: ocho regresiones de feedback, tarjetas sin datos inventados, ratings reales, fallback de imagen, timeline persistido, acciones/escape de texto y foco/restauración de Sheet, incluido foco deshabilitado/externo y ausencia de controles.
- Profesional: doce regresiones de switch controlado, identidades únicas, Online con inbox vacío, navegación, identidad real/fallback, ETA/teclado, onboarding y mapa explícitamente ilustrativo.
- Admin: siete regresiones de navegación/acciones, datos reales, tablas/metadata, estados y etiquetas del modal. El test de paginación previo ahora comprueba el atributo HTML disabled, no una coincidencia accidental con la clase Tailwind `disabled:`.
- Disputas: trece regresiones de foco, keyboard, busy, labels, errores, validación y conservación de handlers/payloads.

Última ejecución sobre el código final, después del último ajuste de foco:

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` | 0 | Sin errores. |
| `npm run test:offline` | 0 | 508 aprobadas / 262 omitidas de 770; 37 suites aprobadas / 24 omitidas; 14.27 s. |
| `npm run test:integration` | 0 | 770/770; 61/61 suites; 21.22 s. PostgreSQL nuevo en 127.0.0.1, identidad comprobada; las 27 tablas de aplicación quedaron vacías. |
| `npm run build` | 0 | Vite 6.4.3, 76 módulos, 703 ms; sin warnings. Última ejecución con `ALTOQUE_SAFE_VALIDATION=1` para omitir archivos `.env`. |
| `git diff --check` | 0 | Sin errores, repetido después de añadir el informe. |

Los 262 skips offline son casos DB que sí se ejecutaron en integración. El runner sanea conexiones/secretos heredados y aplica las tres migraciones existentes únicamente a su nuevo PostgreSQL temporal. No usa Neon. Dependencias y lockfile no cambiaron; no se ejecutó npm audit fix ni se atribuye a esta ronda remediación de advisories previos.

Bundle final: CSS 68.35 KB (gzip 12.57); JS inicial 334.47 KB (gzip 100.99); admin 30.08 KB (gzip 7.41); profesional 48.82 KB (gzip 12.51). El split lazy se conserva. No se afirma mejora de Core Web Vitals, cold-start o latencia por estos tamaños; no fueron medidos.

## Smoke local de extremo a extremo

Harness externo al repo con Hono, Vite y PostgreSQL exclusivo loopback. Env saneado, sin leer `.env`, sin credenciales Neon/Resend/Vercel heredadas. Usuarios Better Auth reales con contraseña aleatoria privada y fixtures identificados como QA local; ninguna sesión o API mock en el runtime. El email verificado de esas fixtures es preparación local, no evidencia de envío SMTP. No se repitió correo/SSO remoto en esta ronda.

38 comprobaciones HTTP correctas: health, auth/me/logout, 401/403/404 esperados, direcciones/ownership, solicitudes, privacidad inbox/dirección, claim, transiciones, confirmación/valoración, disputas, RBAC y listas admin.

Comprobaciones adicionales por navegador contra ese mismo API/DB:

- Landing, categorías, FAQ, menú, acciones y auth. Tab/Shift+Tab, Escape, restauración del trigger y desbloqueo del scroll.
- Login/logout real como cliente, profesional y admin. Cliente crea dirección, confirma persistencia al refrescar y crea solicitud desde el wizard.
- Profesional alterna Offline/Online, conserva estado tras refresh y reclama la solicitud con ETA real seleccionada. Dirección exacta aparece tras asignación. Recorre on_the_way → arrived → in_progress → completed.
- Cliente confirma finalización, crea valoración y abre disputa. Admin lee y resuelve esa disputa; la resolución persiste.
- Cancelación de una solicitud de prueba pendiente; después inbox vacío normal con Online operativo y cero mensajes de error.
- Cuenta local sin perfil crea onboarding profesional, queda pending_verification tras refrescar y no puede activar disponibilidad prematuramente.
- Admin: seis secciones, metadata 1/1 y límites anterior/siguiente; tabla de 680 px dentro de región de 286 px sin desbordar una página de 320 px. La navegación multipágina se cubre por suites existentes; no se generó dataset grande para navegador.
- Viewports 320×800, 390×844 y 1440×900. Contraste calculado, medidas del switch y ausencia de overflow de página en las vistas inspeccionadas. Cero errores de consola al cierre y ninguna alerta sanitizada de runtime/5xx desde READY hasta shutdown.

Un primer click automatizado sobre finalización ocurrió cuando el botón aún estaba ocupado. Tras esperar el estado habilitado, la transición y confirmación real completaron. No se interpreta ese primer intento como fallo del servidor ni se introdujo un cambio especulativo.

Limpieza final: Vite, API, Prisma y PostgreSQL detenidos; cluster temporal y JSON de credenciales generadas eliminados. Harness y capturas sanitizadas conservados fuera del repo. No se borraron archivos preexistentes.

## Mini-auditoría independiente y límites

Revisión cruzada del diff: cero nuevos hallazgos bloqueantes. Conservación de acciones, permisos, payloads y navegación; ausencia de secretos reales, URLs PostgreSQL y ampliaciones de datos privados. El único P3 nuevo observado en el foco de Sheet se corrigió con regresión antes de la validación final. El escaneo no equivale a garantía absoluta de ausencia de cualquier secreto imaginable.

Index vacío, HEAD intacto y stashes conservados:

- `9ca0850fa010f49e14d485b1c2aa89f8a181feed`
- `c98a2e8b0ed75649e31f2b5204de0114ef9bc464`

No hubo una nueva publicación ni E2E remoto de estos cambios. Responsive se evaluó en browser con viewport emulado, no en dispositivos físicos. No se realizó auditoría completa con lector de pantalla/axe, pruebas de carga ni certificación de accesibilidad.

## Pendientes reales que esta ronda no oculta

- Favoritos persistentes, edición ampliada de perfil/portfolio/horarios, onboarding documental/KYC y pagos reales siguen incompletos. Se conserva navegación y controles, con copy honesto; no se inventó un backend.
- Historial profesional de servicios finalizados y rechazo persistente requieren completar el contrato/flujo backend existente. No se simula persistencia con memoria o storage local.
- GPS real, notificaciones completas/expiración y arquitectura de archivos/retención requieren sus rondas específicas y autorización correspondiente. El mapa indica que es esquemático.
- Quedan pruebas en dispositivos reales y revisión integral de lector de pantalla/contraste; esta ronda mejora accesibilidad técnica sin declarar WCAG cumplido.
- Advisories y riesgos técnicos anteriores no relacionados con UI permanecen documentados en los informes históricos; ninguna actualización de dependencias en esta ronda.
- `FUNCTION_INVOCATION_FAILED` histórico permanece **no reproducido / causa no determinada / bajo observación**. Su instrumentación no se modificó ni eliminó; no existe evidencia nueva que permita declarar una causa.

Siguiente paso: revisión del diff y autorización de publicación si se desea repetir este pulido en Preview real. Sin publicación automática desde esta ronda.

## Evaluación final del estado completo de Altoque

Esta evaluación califica el candidato local completo: HEAD `ffb8b46` más el diff UI/UX validado. No acredita funcionalidades planeadas ni elementos del concepto visual adjunto por el usuario. La nueva presentación todavía no está desplegada. Tres revisiones independientes de backend/seguridad, producto/UI y arquitectura/operaciones contrastaron código actual, pruebas, smoke y pendientes históricos; no encontraron un nuevo P0/P1 confirmado. Eso no sustituye un pentest ni demuestra ausencia absoluta de bugs.

### Evidencia actual y separación de entornos

- Validación local final del código: typecheck/build/diff check exit 0, 508 offline aprobadas + 262 omitidas por DB, 770/770 integración en PostgreSQL aislado y cleanup de 27 tablas. No hubo cambios de código durante esta evaluación: no se repitieron innecesariamente las suites; el diff check se repitió después de documentar.
- Smoke local del candidato UI: 38 comprobaciones HTTP y recorrido real por navegador cliente/profesional/admin, incluyendo finalización, review y disputa; viewports emulados 320/390/1440 px. No prueba dispositivos físicos ni WCAG integral.
- Preview publicado, metadata Vercel reconfirmada read-only: `dpl_HQeh6nnELPwBcw1VubYhTzDMPSYu`, commit exacto `ffb8b46713ebcf424558b1ae6cc35873f0475e0a`, READY, `target: null`; build 56.48 s. [Deployment Preview](https://altoque-j2wjlh3n8-juanprogamer597-5269s-projects.vercel.app/).
- CI de ese commit reconfirmado por GitHub GET: [run 37536846889](https://github.com/JuanReyes0126/Altoque/actions/runs/37536846889), completed/success. Su ejecución pasó 723/723 integración; las 47 regresiones UI nuevas sólo tienen evidencia local por ahora.
- La evidencia posterior a publicación está guardada fuera del repo en `/Users/juankingss/.config/altoque/preview-publication-validation-2026-10-06.md`. Confirma entrega de dos verificaciones y una recuperación, cadena real equivalente al click Gmail/primer SSO, alias conservado, Better Auth verificado/autologin, logout/login, reset, replay rechazado y revocación. También registra smoke remoto de negocio/RBAC y una ventana de runtime sin errores inesperados. No se reenvió correo ni se escribieron datos para esta evaluación.
- El documento histórico `docs/validacion-preview-e2e-2026-10-06.md` conserva deliberadamente el snapshot previo a publicación. Sus frases «fix no publicado» y «CI fallido» ya no describen el checkpoint actual: **SSO/guard admin/workflow quedaron cerrados en la publicación posterior**. No se vuelve a penalizar esos bugs como si siguieran abiertos.
- `npm audit` repetido ahora: exit 1, tres entradas HIGH y cero critical/moderate/low. Árbol instalado: Prisma/@prisma/config 6.19.3 → deepmerge-ts 7.1.5. Las tres entradas heredan un advisory de agotamiento de stack con grafos cíclicos; no son tres exploits independientes. La corrección upstream exige deepmerge-ts >=8.0.0. No se observó una ruta HTTP que le entregue grafos cíclicos; esto limita la exposición observada, no remedia el aviso. [Advisory primario](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx). Sin fix/force, downgrade, actualización ni override.

### Notas por categoría

Escala de 1 a 10. Las notas son juicio técnico basado en la evidencia disponible, no resultados de un benchmark. Un 10 exige completitud, pruebas y operación sostenida demostradas; no se otorgan puntos por interfaces preparadas o planes.

| Categoría | Nota /10 | Evidencia favorable actual | Principal razón para no ser 10 |
| --- | --- | --- | --- |
| Arquitectura | **7.5** | React/Vite, Hono y Prisma separados; auth y errores transversales; admin/pro con lazy loading. | Grandes vistas, DTOs duplicados/any y flujos operativos todavía incompletos. La UI no constituye un rediseño de arquitectura. |
| Backend/API | **8.4** | Ownership, JSON400, CAS/claim, transacciones de disputas, ranking global y paginación/snapshots con regresiones reales. | Archivos, notificaciones/expiración y recorrido profesional posterior al servicio no están completos; sin carga sostenida. |
| Base de datos | **8.2** | Tres migraciones explícitas, índices parciales/constraints y pruebas de concurrencia; Preview sincronizado previamente. | Dirección histórica mutable, integridad de archivos/account y recuperación/planes con volumen pendientes. |
| Seguridad | **7.8** | RBAC fresco, validación, CSRF/origin, cookies oficiales, no-store y logs redactados. Rate limit PostgreSQL atómico, compartido entre instancias. | Cadena HIGH, lectura privada/retención y hardening operativo pendientes; no pentest ni prueba integral de abuso. |
| Autenticación/autorización | **8.6** | Better Auth real, verificación obligatoria, Resend y SSO/reset probados, revocación y cuentas inactivas/RBAC. | Race residual suspensión/emisión de sesión y matriz multi-host/dispositivo/concurrencia no exhaustiva. |
| Frontend/UI | **8.2** | Identidad visual coherente, landing honesta, panels/cards/feedback, navegación y microinteracciones; capturas reales locales. | Vistas grandes/densas, perfiles con contenido incompleto y pulido todavía sin prueba desplegada. No se acredita el mockup adjunto. |
| UX | **7.5** | Recorrido principal real, mensajes de estado útiles, retry y privacidad de dirección; smoke completo local. | Rechazo sólo temporal, historial profesional incompleto, favoritos y edición ampliada sin recorrido persistente. |
| Responsive/móvil | **8.0** | 320/390/1440 px, overflow corregido, tablas con scroll interno, safe areas y switch táctil medido. | Falta dispositivo físico, teclado móvil, zoom, matriz Safari/Android y red lenta. |
| Accesibilidad | **7.2** | Labels/status/alert, skip links, foco/Tab/Escape/restauración, contraste calculado y reduced motion. | Sin axe/lector de pantalla integral ni verificación WCAG; modales probados no certifican toda la app. |
| Testing | **8.6** | 770 pruebas actuales, DB aislada/cleanup, regresiones de races/rollback, CI remoto y E2E correo real. | Smoke browser externo no automatizado en CI; cobertura cuantificada, dispositivos, carga y archivos sin validar. |
| Performance | **7.3** | Agregados SQL/reviews limitadas, ranking previo a paginar, lazy chunks y bundle medido. | Sin CWV, cold-start, EXPLAIN con volumen, latencias ni contención medidos. No se convierte funcionalidad correcta en promesa de velocidad. |
| Mantenibilidad | **7.5** | TypeScript estricto, componentes de feedback/foco, regresiones y documentación. | any/contratos duplicados, módulos legacy y pantallas de aproximadamente 650–700 líneas. |
| Observabilidad/operaciones | **6.2** | Logs con correlación/status/duración, auditoría, health y diagnóstico Preview seguro. | Alertas/SLO, trazas permanentes, restore/rollback ensayados y runbooks/gates no demostrados. |
| Completitud del producto | **6.2** | Solicitud, dirección, disponibilidad, claim, estados, valoración, disputa y admin funcionan. | KYC/archivos, historial/rechazo, notificaciones/expiración y modelo comercial/pagos incompletos. |
| Preparación para Production | **6.7** | Aislamiento/migraciones Preview, auth/email real y CI probados; buen candidato para piloto. | Faltan continuidad operativa, confianza documental, integridad y validación bajo carga/dispositivos; UI nueva aún local. |

Referencias de arquitectura/operación: `src/App.tsx:25`, `server/index.ts:36`, `.github/workflows/ci.yml:46-69`, `server/middleware/security.ts:60-69`, `server/lib/logger.ts:23-64`, `server/routes/health.ts:12-28`. Rendimiento: `server/providers/public-directory.ts:38`, `server/routes/providers-public.ts:117`. Riesgos concretos y sus archivos se detallan abajo.

### Notas de síntesis y criterio

1. **Nota global actual: 7.6/10.** Media simple de las 15 categorías: 113.9/15 = 7.593. Incluye áreas débiles de completitud y operaciones; no equivale a puntuar sólo el código.
2. **Production readiness: 6.7/10.** Se mantiene frente al checkpoint publicado: la mejora visual no cierra barreras de infraestructura, integridad o operación.
3. **UI/UX: 7.9/10.** Media de Frontend/UI 8.2 y UX 7.5 = 7.85, redondeada. Responsive y accesibilidad se exponen por separado para no esconder sus límites.
4. **Competitividad percibida: 7.2/10.** Presentación y núcleo convincentes para probar el producto, pero faltan oferta real suficiente, fiabilidad/tiempos de respuesta y retención demostrados. Es juicio sobre el producto actual; no un benchmark de competidores ni prueba de product-market fit.

La nota global nueva no es directamente comparable con el 7.8 de diez categorías del checkpoint anterior: ahora se separan UI, UX, móvil, accesibilidad, operaciones y completitud. Si se conserva el mapa original y se agrupan UI/UX, el promedio técnico comparable sigue aproximadamente **7.8/10** (7.845). No se interpreta la diferencia de fórmula como regresión del código ni se infla la preparación comercial con el diseño.

### Los cinco problemas que más impiden llegar a 9/10

1. **P2 — Confianza profesional y archivos incompletos.** `server/lib/files.ts:105-108` rechaza lectura privada con 503; `server/routes/uploads.ts:53-56` sube antes de persistir sin compensación si falla DB. Alta/aprobación no completan documentos/KYC (`providers.ts:54-130`, `admin.ts:201-219`). Esto afecta fotos, verificación y retención; no se declara una fuga de datos no demostrada.
2. **P2 — Continuidad profesional e integridad del servicio.** `ProApp.tsx:199-201` sólo oculta rechazos en memoria y el polling los repone. `providers.ts:381-400` excluye completed de active-job; falta historial navegable para el profesional. `schema.prisma:373-374` y `addresses.ts:71-91` permiten cambiar/eliminar la dirección referenciada sin snapshot. Riesgos reales, distintos de ownership, que sí funciona.
3. **P2 — Notificaciones y expiración sin operación completa.** Se insertan notificaciones en claim/estados/disputas, pero faltan lectura/entrega y tarea de expiración; `server/index.ts:103-122` no monta ese recorrido. Polling 5/10 segundos no garantiza que un usuario ausente reciba un aviso ni que una solicitud abandonada expire.
4. **P2 — Fiabilidad operativa aún sin demostrar.** Existen CI y logs, pero no evidencia de required checks/gate efectivo de promoción, alertas, restore/rollback ensayado ni carga/dispositivos reales. `vercel.json:3` construye, no prueba que el despliegue espere CI. Los HIGH y riesgos residuales de identidad/suspensión necesitan seguimiento compatible. No se afirma que no existan backups del proveedor: falta prueba de restauración.
5. **P2 — Modelo comercial y soporte todavía incompletos.** `src/lib/payments.ts:84-95` rechaza todas las operaciones reales de pago. Resolución de disputa cambia estados, no mueve dinero. No es obligatorio cobrar in-app para un piloto, pero deben existir políticas explícitas de presupuesto/cobro, cancelación, soporte y responsabilidad; no se acredita diseño de tablas como producto terminado.

### Los cinco cambios con mayor impacto a continuación

1. Diseñar y cerrar lectura privada autorizada, compensación/retención de uploads y recorrido documental con revisión real de profesionales. Mantener datos privados fuera del directorio público. Cualquier servicio/esquema necesario requiere su ronda autorizada.
2. Completar historial profesional y rechazo persistente; definir ubicación contractual estable y resolver integridad de account/archivos sin migraciones improvisadas. Añadir pruebas concurrentes y E2E del servicio terminado.
3. Implementar entrega/lectura de notificaciones y expiración mediante procesos acotados e idempotentes, con pruebas de duplicados/reintentos y estados terminales.
4. Convertir el candidato en una entrega comprobable: publicar/revalidar UI sólo tras autorización, automatizar smoke navegador en CI, comprobar gates, probar dispositivos/axe/lector/carga, configurar alertas y ensayar restore/rollback. Remediar el advisory por una ruta compatible, sin majors/downgrades automáticos.
5. Definir el alcance comercial del primer piloto y su operación humana: selección de oferta, cobro explícito, presupuestos, cancelaciones, disputas y soporte. Implementar pagos sólo después de decidir proveedor/política; no presentar funciones preparadas como operativas.

### Partes suficientemente maduras para dejar estables

- Better Auth básico, correo con error honesto, transporte SSO de verificación, reset/logout/login y guard administrativo/bootstrap idempotente. Mantener regresiones; no reescribir sin evidencia nueva.
- Ownership/RBAC de direcciones, solicitudes y disputas. Tratar snapshot de ubicación como pendiente separado, sin deshacer permisos que ya pasan.
- Claim/CAS, transiciones, historial transaccional, confirmación/valoración y resolución administrativa. Mantener constraints y pruebas de carreras/rollback.
- Ranking global SQL, agregados y paginación de directorio/admin/inbox con metadata/snapshots. Optimizar adicionalmente sólo con medición.
- Disponibilidad Online/Offline, respuesta vacía correcta y switch alineado; sistema visual/feedback/navegación de esta ronda. Completar validación externa/accesibilidad dirigida sin otra reescritura visual.

### Recomendación de lanzamiento

**No recomiendo lanzamiento público abierto hoy.** El recorrido principal funciona, pero usuarios externos pueden encontrarse con documentos privados sin lectura, avisos incompletos, historial/rechazo profesional parcial y una operación sin recuperación ensayada. Una interfaz más cuidada no elimina esos riesgos.

**Sí recomiendo preparar un piloto privado controlado**, después de autorizar/publicar y revalidar este candidato: usuarios invitados, profesionales revisados manualmente, soporte humano, alcance explícito y política de cobro clara. Un piloto permite medir respuesta real y cerrar pendientes sin prometer pagos, GPS, verificación documental o notificaciones que todavía no están implementados. No se ha abierto ni desplegado ese piloto desde esta evaluación.

El incidente histórico `FUNCTION_INVOCATION_FAILED` sigue bajo observación sin causa determinada; ni el verde actual ni riesgos estáticos de backpressure/timeout permiten declararlo resuelto o atribuirle causa. Instrumentación intacta. Evaluación finalizada sin cambios de código, staging, commit, push, deploy ni escritura remota.
