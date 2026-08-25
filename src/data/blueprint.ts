// ─────────────────────────────────────────────────────────────
// AlToque RD · Blueprint V1 — contenido completo del documento
// ─────────────────────────────────────────────────────────────

export const NAV = [
  { id: "veredicto", num: "01", label: "Veredicto" },
  { id: "stack", num: "02", label: "Stack" },
  { id: "arquitectura", num: "03", label: "Arquitectura" },
  { id: "datos", num: "04", label: "Datos" },
  { id: "estados", num: "05", label: "Estados" },
  { id: "flujos", num: "06", label: "Flujos en vivo" },
  { id: "pantallas", num: "07", label: "Pantallas" },
  { id: "confianza", num: "08", label: "Confianza" },
  { id: "crecimiento", num: "09", label: "Crecimiento" },
  { id: "alcance", num: "10", label: "Alcance y riesgos" },
  { id: "plan", num: "11", label: "Plan" },
  { id: "aprobacion", num: "12", label: "Aprobación" },
];

export const MARQUEE = [
  "Plomería", "Electricidad", "Aire acondicionado", "Cerrajería", "Limpieza",
  "Mecánica", "Grúas", "Remodelación", "Fotografía", "Pintura", "Jardinería",
  "Neveras", "Inversores", "Cámaras", "Wi-Fi", "Catering", "DJ", "Mudanzas",
  "Ebanistería", "Fumigación", "Detailing", "Arquitectura",
];

export const COVER_STATS = [
  { k: "19", l: "entidades de datos" },
  { k: "11", l: "estados de solicitud" },
  { k: "6", l: "a beta cerrada" },
  { k: "100", l: "cupos fundador" },
];

export const PIPELINE = [
  { label: "Solicitud enviada", eta: null, tone: "azul" },
  { label: "Carlos aceptó", eta: "Llegada est. 20 min", tone: "jade" },
  { label: "En camino", eta: "Santiago · sector Los Jardines", tone: "amber" },
  { label: "Llegó al punto", eta: "Servicio verificado", tone: "jade" },
  { label: "Completado", eta: "★ 5.0 · “Resolvió al toque”", tone: "flama" },
];

// ── 01 · Veredicto ───────────────────────────────────────────
export const VERDICT = {
  title: "Viable. Y más simple de lo que parece.",
  paras: [
    "El núcleo de la V1 es una máquina de estados finita: una solicitud nace, se asigna, viaja, se completa y se califica. Sin GPS continuo, sin pagos, sin microservicios — es un monolito modular bien hecho que un equipo de 2–3 personas lleva a beta cerrada en 6 semanas.",
    "El riesgo real no es técnico: es de oferta. Nadie pide un plomero si no hay plomeros conectados. Por eso el programa de Proveedores Fundadores no es marketing — es infraestructura crítica del lanzamiento y está diseñado en este blueprint como un sistema de datos, no como una promoción hardcodeada.",
  ],
  metrics: [
    { v: 6, suf: " sem", label: "a beta cerrada en Santiago" },
    { v: 30, suf: "", label: "pros fundadores activos objetivo" },
    { v: 60, suf: "%", label: "aceptación de solicitudes (meta)" },
    { v: 3, suf: " min", label: "mediana de aceptación (meta)" },
  ],
};

export const PUSHBACKS = [
  {
    n: "PB-01",
    title: "Quote + Booking + ServiceRequest son la misma cosa en V1",
    body: "Tener tres tablas separadas duplica lógica de estados y reportes. Propuesta: una sola entidad ServiceRequest con mode: NOW | SCHEDULED. La cotización es un campo (quotedAmount) y la reserva es un estado (SCHEDULED con fecha). Menos tablas, misma capacidad futura.",
  },
  {
    n: "PB-02",
    title: "No hardcodear la lista de ETA",
    body: "Los “10, 15, 20… minutos” deben vivir en configuración por categoría/zona, no en código. Además: sugerir una ETA por defecto según el sector (centroide del sector vs. zona del pro) para reducir un toque de fricción. El pro confirma o ajusta.",
  },
  {
    n: "PB-03",
    title: "Administrador no es un tipo de usuario: es un rol",
    body: "Modelar ADMIN como rol dentro de un RBAC (roles + permisos) permite crear mañana “Moderador”, “City Ops Santiago” o “Soporte” sin migraciones dolorosas. El brief lo plantea como ente separado; el modelo lo corrige.",
  },
  {
    n: "PB-04",
    title: "“Cuentas sospechosas”: reglas, no algoritmos",
    body: "Detectar abuso con IA en V1 es sobreingeniería. Bastan reglas auditables: teléfono duplicado, 5+ registros desde la misma IP en 1 h, reviews 5★ recíprocas entre cuentas vinculadas, perfil sin foto + sin trabajos. El sistema marca; el humano decide.",
  },
  {
    n: "PB-05",
    title: "El referido debe completar UN servicio, no solo verificarse",
    body: "El brief exige registro + teléfono + perfil + aprobación. Bien, pero insuficiente: un pro verificado que nunca trabaja no vale nada. Propuesta: el referido cualifica cuando completa su primer servicio calificado. Anti-fraude real, costo cero.",
  },
  {
    n: "PB-06",
    title: "Distancia sin GPS: centroides de sector",
    body: "Cada sector lleva lat/lng de centroide. La “distancia aproximada 3.2 km” del brief se calcula con Haversine entre el sector del cliente y la zona declarada del pro. Percepción de proximidad idéntica a Uber, cero tracking en tiempo real.",
  },
  {
    n: "PB-07",
    title: "Prisma sí — Drizzle es la alternativa justificada",
    body: "Prisma: migraciones maduras, typesafety y velocidad de equipo. Drizzle: runtime más ligero y control SQL fino, mejor si el equipo es purista de performance. Decisión para este proyecto: Prisma. Cambiar de ORM en V2 es caro; elegir una vez.",
  },
  {
    n: "PB-08",
    title: "PWA desde el día 1, app nativa nunca antes de V3",
    body: "Instalable, con icono y pantalla completa, la PWA cubre el 90% de la experiencia móvil a costo casi cero. Las apps nativas solo se justifican si la retención a 90 días demuestra uso recurrente pesado — medir primero con PostHog.",
  },
];

// ── 02 · Stack ───────────────────────────────────────────────
export const STACK = [
  { layer: "Frontend + API", tech: "Next.js (App Router) + TypeScript", why: "Un solo deploy, SSR/SEO para perfiles públicos de pros (canal de adquisición gratis en Google), Server Actions para mutaciones y typesafety de punta a punta." },
  { layer: "Estilos", tech: "Tailwind CSS + design system propio", why: "Velocidad de iteración y una identidad propia — nada de plantillas. Componentes accesibles construidos en casa, sin librerías UI pesadas." },
  { layer: "Base de datos", tech: "PostgreSQL (Neon)", why: "JSONB para atributos flexibles por categoría, PostGIS ya disponible cuando llegue GPS en V2, backups automáticos y branching para staging." },
  { layer: "ORM", tech: "Prisma", why: "Migraciones versionadas, schema como documentación viva y type-safety. Semillas (seeds) de categorías y zonas en el mismo repo." },
  { layer: "Auth", tech: "argon2id + sesiones en BD + cookies httpOnly", why: "Hashing moderno, sesiones revocables desde el admin, CSRF tokens, rate limiting con Upstash. Sin reinventar OAuth: login por teléfono + código OTP desde el día 1." },
  { layer: "Validación", tech: "Zod (esquemas compartidos)", why: "El mismo esquema valida el formulario del cliente y el endpoint del servidor. Nunca confiar solo en el frontend — exactamente lo que pide el brief." },
  { layer: "Imágenes", tech: "Cloudflare R2 + URLs prefirmadas", why: "El celular sube directo al storage con token de 5 minutos; nunca pasa por nuestro servidor. Validación de tipo/tamaño en cliente Y servidor." },
  { layer: "Observabilidad", tech: "Sentry + PostHog", why: "Errores con stacktrace real y métricas de producto desde el día 1: el dashboard interno del brief existe porque los eventos se capturan desde beta." },
  { layer: "Realtime (V2)", tech: "Ably / WebSockets en worker", why: "Slot reservado en la arquitectura: el dominio ya emite eventos de estado; V2 solo enchufa el canal. Nada que construir hoy." },
  { layer: "Deploy", tech: "Vercel + GitHub Actions", why: "Preview por PR para que el equipo apruebe flujos en el celular antes de merge. Producción con dominio .do cuando exista la marca." },
];

// ── 03 · Arquitectura ────────────────────────────────────────
export const TREE = `altoque/
├─ prisma/
│  ├─ schema.prisma          # 19 entidades, el corazón del sistema
│  ├─ migrations/
│  └─ seed.ts                # categorías, zonas de Santiago, planes
├─ public/                    # PWA: manifest, iconos, offline mínimo
└─ src/
   ├─ app/                    # Next App Router
   │  ├─ (portal)/            # Home, catálogo, /solicitar, /pro/[slug] (SEO)
   │  ├─ (cliente)/           # /mis-solicitudes, /tracking/[id], /favoritos
   │  ├─ (pro)/               # /pro/dashboard, /pro/solicitudes, /pro/referidos
   │  ├─ (admin)/             # /admin/… protegido por RBAC
   │  └─ api/                 # webhooks storage, health, cron de expirados
   ├─ features/               # la regla de oro: cada dominio, su carpeta
   │  ├─ auth/                # OTP teléfono, sesiones, roles
   │  ├─ catalog/             # categorías + zonas dinámicas (sin hardcode)
   │  ├─ requests/            # ServiceRequest + máquina de estados
   │  ├─ providers/           # perfiles, verificación, disponibilidad
   │  ├─ reviews/             # 1 review por servicio completado
   │  ├─ referrals/           # códigos, cualificación anti-fraude
   │  ├─ notifications/       # tabla + canales (email hoy, push V2)
   │  └─ admin/               # RBAC, aprobaciones, AdminAction log
   ├─ lib/                    # db, storage, mail, geo (Haversine), rate-limit
   └─ styles/                 # tokens del design system`;

export const ARCH_NOTES = [
  { t: "Monolito modular", d: "Un solo deploy, dominios separados en features/. Cada feature expone servicios y oculta sus tablas. Partir en microservicios en V2 es posible sin reescribir." },
  { t: "Eventos de dominio", d: "Cada cambio de estado emite un evento interno (request.accepted, request.completed…). Hoy alimenta notificaciones y métricas; mañana alimenta websockets sin tocar la lógica." },
  { t: "Slots V2/V3 reservados", d: "GeoService (hoy centroides, mañana GPS), PaymentService (interfaz definida, implementación vacía), PushChannel. La arquitectura crece sin cirugía." },
];

// ── 04 · Modelo de datos ─────────────────────────────────────
export type EntityField = { name: string; type: string; note?: string };
export type Entity = { name: string; group: string; desc: string; fields: EntityField[]; rels: string[] };

export const ENTITY_GROUPS = [
  { id: "identidad", label: "Identidad y roles" },
  { id: "catalogo", label: "Catálogo y territorio" },
  { id: "operacion", label: "Operación" },
  { id: "confianza", label: "Confianza" },
  { id: "crecimiento", label: "Crecimiento" },
];

export const ENTITIES: Entity[] = [
  {
    name: "User", group: "identidad", desc: "Una sola cuenta, múltiples roles. El teléfono es la identidad nacional de facto: login OTP, sin contraseñas que filtrar.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "phone", type: "string UNIQUE", note: "formato E.164 · login OTP" },
      { name: "email", type: "string?" },
      { name: "fullName", type: "string" },
      { name: "role", type: "enum CLIENT | PROVIDER | STAFF", note: "RBAC: STAFF con permisos granulares" },
      { name: "status", type: "enum ACTIVE | SUSPENDED" },
      { name: "lastSectorId", type: "uuid FK → Sector" },
    ],
    rels: ["1 → 1 ProviderProfile", "1 → N ServiceRequest", "1 → N Review", "1 → N Favorite", "N → N Role (permisos STAFF)"],
  },
  {
    name: "ProviderProfile", group: "identidad", desc: "El perfil público del profesional: la página que vende confianza y que indexa Google.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "userId", type: "uuid FK UNIQUE" },
      { name: "slug", type: "string UNIQUE", note: "SEO: /pro/carlos-rodriguez" },
      { name: "bio", type: "text" },
      { name: "yearsExp", type: "int" },
      { name: "approval", type: "enum PENDING | APPROVED | REJECTED | SUSPENDED" },
      { name: "isAvailable", type: "bool", note: "el botón 🟢/🔴" },
      { name: "typicalEtaMin", type: "int?", note: "15–30 min habitual" },
      { name: "foundingNumber", type: "int? UNIQUE", note: "Fundador #001…#100" },
      { name: "schedule", type: "jsonb", note: "horarios por día" },
    ],
    rels: ["1 → 1 User", "N → N Category", "N → N Sector (zonas)", "1 → N Verification", "1 → N PortfolioImage", "1 → N Review"],
  },
  {
    name: "Verification", group: "identidad", desc: "Diseñada en niveles desde ya: cada tipo de verificación es una fila, no un booleano. Agregar “Licencia” o “Empresa” mañana = insertar, no migrar.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "providerId", type: "uuid FK" },
      { name: "type", type: "enum IDENTITY | PHONE | PROFESSIONAL | BUSINESS" },
      { name: "level", type: "int", note: "nivel 1..3 para el futuro" },
      { name: "status", type: "enum PENDING | VERIFIED | REJECTED" },
      { name: "verifiedAt", type: "datetime?" },
      { name: "evidenceRef", type: "string?", note: "referencia al storage, nunca el archivo" },
    ],
    rels: ["N → 1 ProviderProfile"],
  },
  {
    name: "Role / Permission", group: "identidad", desc: "RBAC mínimo pero real: roles con listas de permisos. Admin = rol, no especie aparte.",
    fields: [
      { name: "role", type: "enum OWNER | ADMIN | MODERATOR | CITY_OPS" },
      { name: "permissions", type: "string[]", note: "providers.approve, requests.view…" },
      { name: "scopeSectorId", type: "uuid?", note: "City Ops limitado a su ciudad" },
    ],
    rels: ["N → N User (STAFF)"],
  },
  {
    name: "CategoryGroup", group: "catalogo", desc: "Hogar, Técnicos, Automotriz, Tecnología, Eventos, Construcción… y lo que el admin invente después.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "name", type: "string", note: "Hogar · Técnicos · Eventos…" },
      { name: "icon", type: "string", note: "key de icono del design system" },
      { name: "order", type: "int" },
      { name: "active", type: "bool" },
    ],
    rels: ["1 → N Category"],
  },
  {
    name: "Category", group: "catalogo", desc: "100% dinámica: el admin crea, ordena, activa y desactiva sin tocar código. Cada una declara si soporta modalidad inmediata.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "groupId", type: "uuid FK" },
      { name: "slug", type: "string UNIQUE", note: "plomeria, electricidad…" },
      { name: "supportsNow", type: "bool", note: "⚡ Ahora vs 📅 solo programado" },
      { name: "etaOptionsMin", type: "int[]", note: "config por categoría, no hardcode" },
      { name: "commonIssues", type: "string[]", note: "chips sugeridos al describir" },
      { name: "active / order", type: "bool / int" },
    ],
    rels: ["N → 1 CategoryGroup", "N → N ProviderProfile", "1 → N ServiceRequest"],
  },
  {
    name: "Territory (Country→Province→Municipality→Sector)", group: "catalogo", desc: "Cuatro niveles como pide el brief. Cada Sector lleva centroide lat/lng: la base de la “distancia aproximada” sin GPS en vivo.",
    fields: [
      { name: "country", type: "RD (semilla inicial)" },
      { name: "province", type: "Santiago, Sto. Dgo., Puerto Plata…" },
      { name: "municipality", type: "string" },
      { name: "sector", type: "string + lat/lng centroide", note: "Los Jardines, Ens. Libertad, Cienfuegos…" },
      { name: "active", type: "bool", note: "activar ciudades sin desplegar código" },
    ],
    rels: ["1 → N ServiceRequest", "N → N ProviderProfile (ProviderSector)"],
  },
  {
    name: "ServiceRequest", group: "operacion", desc: "El corazón del MVP. Una sola entidad para ⚡Ahora y 📅Programado (mode). Sus timestamps alimentan todas las métricas del dashboard interno.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "code", type: "string", note: "AT-2026-0001 · legible para soporte" },
      { name: "clientId / providerId?", type: "uuid FK", note: "provider se asigna al aceptar" },
      { name: "categoryId", type: "uuid FK" },
      { name: "mode", type: "enum NOW | SCHEDULED" },
      { name: "status", type: "enum (máquina de estados)", note: "ver sección 05" },
      { name: "description", type: "text", note: "sanitizado en servidor" },
      { name: "sectorId", type: "uuid FK" },
      { name: "etaMinutes?", type: "int", note: "declarado por el pro al aceptar" },
      { name: "quotedAmount?", type: "decimal?", note: "para SCHEDULED (V1.5)" },
      { name: "acceptedAt / arrivedAt / startedAt / completedAt / cancelledAt", type: "datetime?", note: "KPIs directos" },
      { name: "cancelReason?", type: "string?" },
    ],
    rels: ["1 → N RequestImage", "1 → N RequestEvent", "1 → 0..1 Review", "N → 1 Category, Sector"],
  },
  {
    name: "RequestImage", group: "operacion", desc: "Fotos del problema. Subida directa al storage con URL prefirmada; la BD guarda solo la referencia.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "requestId", type: "uuid FK" },
      { name: "storageKey", type: "string", note: "R2 · nunca base64 en BD" },
      { name: "mime / sizeBytes", type: "validados servidor", note: "jpg/png/webp · máx 8 MB · máx 6 fotos" },
    ],
    rels: ["N → 1 ServiceRequest"],
  },
  {
    name: "RequestEvent", group: "operacion", desc: "Log inmutable de cada transición. De aquí salen “tiempo promedio de aceptación” y el historial completo. También es el bus de eventos para el realtime futuro.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "requestId", type: "uuid FK" },
      { name: "from → to", type: "enum → enum" },
      { name: "actorId / actorRole", type: "uuid + enum" },
      { name: "meta", type: "jsonb", note: "ETA elegida, motivo de rechazo…" },
      { name: "at", type: "datetime", note: "índice para analítica" },
    ],
    rels: ["N → 1 ServiceRequest"],
  },
  {
    name: "Review", group: "confianza", desc: "Regla de oro: 1 review por servicio completado (requestId UNIQUE). No hay servicio, no hay review — anti-reviews falsas de fábrica.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "requestId", type: "uuid FK UNIQUE", note: "vínculo obligatorio a servicio real" },
      { name: "clientId / providerId", type: "uuid FK" },
      { name: "rating", type: "int 1..5" },
      { name: "comment", type: "text?" },
      { name: "flagged", type: "bool", note: "moderación admin" },
      { name: "autoClosed", type: "bool", note: "cierre automático 7 días sin respuesta" },
    ],
    rels: ["1 → 1 ServiceRequest", "N → 1 ProviderProfile"],
  },
  {
    name: "Favorite", group: "confianza", desc: "El cliente guarda sus pros de confianza. Compuesto unique (client, provider).",
    fields: [
      { name: "clientId", type: "uuid FK" },
      { name: "providerId", type: "uuid FK" },
      { name: "createdAt", type: "datetime" },
    ],
    rels: ["N → 1 User, ProviderProfile"],
  },
  {
    name: "Report", group: "confianza", desc: "“Reportar problema” del cliente y del pro. Cola de moderación para el admin.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "requestId?", type: "uuid FK?" },
      { name: "reporterId", type: "uuid FK" },
      { name: "reason", type: "enum + text" },
      { name: "status", type: "enum OPEN | RESOLVED | DISMISSED" },
    ],
    rels: ["N → 1 ServiceRequest, User"],
  },
  {
    name: "ReferralCode / Referral", group: "crecimiento", desc: "Código único por pro. El referido SOLO cualifica al completar su primer servicio calificado — no por registrarse. Anti-fraude de diseño.",
    fields: [
      { name: "code", type: "string UNIQUE", note: "CARLOS-PRO · compartible" },
      { name: "referrerId / referredId", type: "uuid FK", note: "referredId UNIQUE" },
      { name: "status", type: "enum REGISTERED → VERIFIED → QUALIFIED", note: "QUALIFIED = 1er servicio completado" },
      { name: "checklist", type: "jsonb", note: "registro, teléfono, perfil, aprobación, 1er servicio" },
      { name: "rewardGrantedAt", type: "datetime?" },
    ],
    rels: ["N → 1 ProviderProfile (referrer y referred)"],
  },
  {
    name: "Promotion", group: "crecimiento", desc: "Las promos viven en datos, no en código: “Primeros 100 verificados → 3 meses Pro” es una fila con regla jsonb. Mañana: “Mes de la patria → 2x1”.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "name", type: "string", note: "Fundadores V1" },
      { name: "rule", type: "jsonb", note: "{trigger:'first_100_verified', grantMonths:3}" },
      { name: "active / startsAt / endsAt", type: "bool / datetime" },
    ],
    rels: ["1 → N ProviderSubscription (grants)"],
  },
  {
    name: "Plan / ProviderSubscription", group: "crecimiento", desc: "FREE / PRO (RD$799) / BUSINESS (RD$1,999) definidos desde ya, con cobro en V2. La suscripción del fundador existe como grant de promoción, no como pago.",
    fields: [
      { name: "planSlug", type: "enum FREE | PRO | BUSINESS" },
      { name: "priceMonthly", type: "decimal · RD$", note: "0 / 799 / 1999" },
      { name: "benefits", type: "jsonb" },
      { name: "sub.providerId", type: "uuid FK" },
      { name: "sub.source", type: "enum PROMOTION | PAID" },
      { name: "sub.expiresAt", type: "datetime", note: "cron de vencimiento diario" },
    ],
    rels: ["1 → N ProviderSubscription", "N → 1 ProviderProfile"],
  },
  {
    name: "Notification", group: "crecimiento", desc: "Tabla de notificaciones con canales abstractos: hoy email (Resend), mañana push y SMS. El dominio decide; el canal se enchufa.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "userId", type: "uuid FK" },
      { name: "type", type: "enum REQUEST_NEW | ACCEPTED | ARRIVED…" },
      { name: "channel", type: "enum IN_APP | EMAIL | PUSH | SMS" },
      { name: "payload", type: "jsonb" },
      { name: "readAt / sentAt", type: "datetime?" },
    ],
    rels: ["N → 1 User"],
  },
  {
    name: "AdminAction", group: "crecimiento", desc: "Cada acción administrativa queda firmada: quién aprobó, quién suspendió, cuándo. Auditoría desde el día 1, costo casi cero.",
    fields: [
      { name: "id", type: "uuid PK" },
      { name: "actorId", type: "uuid FK (STAFF)" },
      { name: "action", type: "enum PROVIDER_APPROVED | SUSPENDED | CATEGORY_CREATED…" },
      { name: "targetType / targetId", type: "polimórfico" },
      { name: "meta", type: "jsonb" },
      { name: "at", type: "datetime" },
    ],
    rels: ["N → 1 User (STAFF)"],
  },
  {
    name: "TrustSignal (materializado)", group: "confianza", desc: "Vista materializada por pro: rating promedio, conteo de reviews, trabajos completados, badges de verificación. El perfil público no hace JOINs pesados: lee esta vista.",
    fields: [
      { name: "providerId", type: "uuid PK" },
      { name: "avgRating", type: "numeric(2,1)" },
      { name: "reviewsCount / completedCount", type: "int" },
      { name: "badges", type: "jsonb", note: "[identity, phone, pro, founder]" },
      { name: "updatedAt", type: "refresh por evento" },
    ],
    rels: ["1 → 1 ProviderProfile"],
  },
];

// ── 05 · Máquina de estados ──────────────────────────────────
export type ReqState = {
  id: string; label: string; actor: "cliente" | "sistema" | "pro" | "ambos";
  desc: string; tone: "azul" | "jade" | "amber" | "flama" | "dim";
  branch?: boolean;
};
export const STATES: ReqState[] = [
  { id: "CREATED", label: "Creada", actor: "cliente", tone: "azul", desc: "El cliente completa categoría + descripción + fotos + sector + modalidad. Se valida en servidor con Zod y se emite el código AT-2026-XXXX." },
  { id: "MATCHING", label: "Buscando pro", actor: "sistema", tone: "azul", desc: "Broadcast a pros de la categoría en zonas compatibles, disponibles y aprobados. Ranking: disponibilidad → rating → distancia de sector → reputación." },
  { id: "ACCEPTED", label: "Aceptada", actor: "pro", tone: "jade", desc: "Un pro acepta dentro del lock transaccional (nadie más puede tomarla). Declara ETA (10–60 min o personalizada). El cliente ve “Carlos aceptó · 20 min”." },
  { id: "EN_ROUTE", label: "En camino", actor: "pro", tone: "amber", desc: "Estado automático tras aceptar (V1: sin GPS, el ETA declarado rige la expectativa). Countdown visible para el cliente." },
  { id: "ARRIVED", label: "Llegó", actor: "pro", tone: "amber", desc: "El pro marca llegada. Desde aquí el cliente NO puede cancelar libremente: debe reportar, para proteger el tiempo del profesional." },
  { id: "IN_PROGRESS", label: "En servicio", actor: "pro", tone: "amber", desc: "Trabajo iniciado. El cliente ve el estado en vivo. Todos los cambios quedan en RequestEvent con timestamp." },
  { id: "COMPLETED", label: "Completado", actor: "pro", tone: "jade", desc: "El pro finaliza. Se dispara la solicitud de review al cliente y se actualiza la vista TrustSignal del pro." },
  { id: "REVIEWED", label: "Calificado", actor: "cliente", tone: "flama", desc: "1–5 estrellas + comentario, vinculado al servicio real (1 review por requestId). Si pasan 7 días, cierre automático con recordatorios." },
];
export const BRANCH_STATES: ReqState[] = [
  { id: "DECLINED", label: "Rechazada", actor: "pro", tone: "dim", branch: true, desc: "El pro rechaza con motivo opcional. La solicitud vuelve a MATCHING con el siguiente candidato. Tras 3 rechazos, el sistema notifica al cliente con alternativas." },
  { id: "CANCELLED", label: "Cancelada", actor: "ambos", tone: "dim", branch: true, desc: "Cliente cancela gratis hasta ACCEPTED; después, solo vía Report. El pro cancela con motivo obligatorio. Queda en métricas de cancelación." },
  { id: "EXPIRED", label: "Expirada", actor: "sistema", tone: "dim", branch: true, desc: "Sin aceptación en 5 min (NOW): re-broadcast ampliando zonas. Sin respuesta en 15 min: se ofrece reprogramar al cliente. Cron + RequestEvent." },
];

// ── 08 · Confianza ───────────────────────────────────────────
export const SECURITY = [
  { t: "Hashing de credenciales", d: "argon2id (OWASP). El login principal es OTP por teléfono: ni siquiera hay contraseña que guardar para la mayoría." },
  { t: "Sesiones y tokens", d: "Sesiones en BD con cookie httpOnly + SameSite=Lax. Revocables desde el admin por usuario o globalmente." },
  { t: "Rate limiting", d: "Upstash por IP + por cuenta: 5 OTP/hora, 20 requests/min. Bloqueo progresivo con backoff." },
  { t: "Validación de servidor", d: "Zod en cada endpoint. El frontend es cortesía; el servidor es la ley. Nunca se confía en el payload del cliente." },
  { t: "Sanitización / XSS", d: "React escapa por defecto + DOMPurify en campos rich-text. CSP estricta en headers." },
  { t: "CSRF", d: "Token por sesión en mutaciones no-GET. SameSite=Lax como segunda barrera." },
  { t: "SQL injection", d: "Prisma parametriza todo por diseño. Cero SQL concatenado; consultas raw solo con $1 explícito y revisado." },
  { t: "Roles y permisos", d: "RBAC verificado en servidor en cada ruta /admin y /pro. Middleware + check en handler: doble candado." },
  { t: "Uploads", d: "URLs prefirmadas de 5 min, allowlist de MIME por magic numbers, máx 8 MB y 6 fotos. El archivo jamás toca el servidor de la app." },
  { t: "Secrets y entorno", d: "Variables de entorno + secrets del deploy. Nada sensible en el bundle del cliente. Revisión de bundle en CI." },
  { t: "Headers de seguridad", d: "CSP, X-Frame-Options, HSTS, Referrer-Policy vía middleware. Score A en security headers desde beta." },
  { t: "Logs y auditoría", d: "AdminAction para lo administrativo, RequestEvent para lo operacional, Sentry para lo roto. Retención definida por ley 172-13 (datos personales RD)." },
];

export const REVIEW_RULES = [
  { t: "Vínculo obligatorio", d: "requestId UNIQUE: sin servicio completado no existe review. Imposible comprar 5 estrellas." },
  { t: "Doble ciego 48 h", d: "Pro y cliente califican sin ver la nota del otro primero. Evita la venganza de estrellas." },
  { t: "Cierre automático", d: "A los 7 días sin calificar, el servicio cierra con recordatorios enviados. El promedio no se distorsiona con silencio." },
  { t: "Moderación con banderas", d: "Reglas marcan anomalías (1★ sin comentario tras cancelación del pro, rachas perfectas). El admin revisa y actúa." },
  { t: "Métricas vivas", d: "TrustSignal: promedio, conteo y badges materializados. El perfil carga en milisegundos aunque el pro tenga 10,000 servicios." },
];

// ── 09 · Crecimiento ─────────────────────────────────────────
export const FOUNDER_TIERS = [
  { req: "01", title: "Ser de los primeros 100", detail: "Proveedor verificado durante la beta de Santiago", reward: "3 meses de Plan PRO gratis", tone: "flama", badge: "FUNDADOR" },
  { req: "03", title: "3 colegas verificados", detail: "Referidos que completan checklist + 1er servicio", reward: "+1 mes PRO", tone: "amber", badge: null },
  { req: "05", title: "5 colegas verificados", detail: "Red creciendo con pros reales y activos", reward: "+2 meses PRO", tone: "amber", badge: null },
  { req: "10", title: "10 colegas verificados", detail: "Nivel embajador de la plataforma en su gremio", reward: "+3 meses PRO + badge Embajador", tone: "jade", badge: "EMBAJADOR" },
];

export const REFERRAL_CHECKLIST = [
  "Registro completado con datos reales",
  "Teléfono verificado por OTP",
  "Perfil completo: foto, bio, categorías y zonas",
  "Aprobación administrativa (documento + revisión)",
  "Primer servicio completado y calificado",
];

export const PLANS = [
  { name: "FREE", price: "RD$0", tag: "V1", perks: ["Perfil público básico", "Hasta 15 solicitudes/mes", "Reviews y verificaciones", "Programa de referidos"] },
  { name: "PRO", price: "RD$799", tag: "V2 · cobro", perks: ["Solicitudes ilimitadas", "Mejor posicionamiento en matching", "Badge PRO en perfil", "Estadísticas de aceptación y zonas", "Prioridad en soporte"] },
  { name: "BUSINESS", price: "RD$1,999", tag: "V2 · cobro", perks: ["Múltiples empleados/técnicos", "Todas las zonas de la ciudad", "Dashboard de equipo", "Estadísticas avanzadas", "Gestor de cuenta"] },
];

// ── 10 · Alcance y riesgos ───────────────────────────────────
export const SCOPE_MVP = [
  "Registro/login OTP por teléfono (cliente y pro)",
  "Catálogo dinámico: 22 categorías sembradas, admin las gestiona",
  "Territorio: RD → Santiago → sectores con centroides",
  "Solicitud ⚡Ahora: categoría → problema → fotos → sector → matching",
  "Matching por categoría + disponibilidad + zona + rating + distancia de sector",
  "Pro acepta/rechaza y declara ETA (lista configurable)",
  "Tracking de estados en vivo para el cliente (polling 5 s, websocket-ready)",
  "Botón Disponible/No disponible del pro",
  "Perfil público del pro con verificaciones, portfolio y reviews (página SEO)",
  "Reviews 1-por-servicio + favoritos + reportes",
  "Dashboard pro: solicitudes, historial, estadísticas básicas, referidos",
  "Programa Fundador (100 cupos) + referidos cualificados",
  "Admin: aprobar/suspender pros, categorías, solicitudes, reviews, reportes, métricas y cobertura",
  "PWA instalable mobile-first + notificaciones por email",
];

export const SCOPE_V2 = [
  "Modalidad 📅Programar/Cotizar con fotos y montos",
  "Push notifications + SMS",
  "Perfiles destacados y compra de leads",
  "Cobros: planes PRO/BUSINESS (pasarela local: Azul / CardNet)",
  "Chat cliente ↔ pro",
  "WebSockets en tiempo real (sustituye polling)",
];

export const SCOPE_V3 = [
  "GPS en vivo + tracking tipo Uber (Mapbox, rutas, ETA automático)",
  "Wallet y pago dentro de la plataforma",
  "Expansión: Santo Domingo, Puerto Plata, Punta Cana, La Vega",
  "Apps nativas si la retención lo justifica",
  "Precios dinámicos por demanda — solo con datos reales",
];

export const TECH_RISKS = [
  { r: "Doble aceptación de una misma solicitud", p: "Medio", m: "Transacción con row-lock (SELECT … FOR UPDATE) al aceptar. Prueba de concurrencia en CI antes de beta." },
  { r: "Fotos falsas o pesadas en solicitudes", p: "Medio", m: "Validación por magic numbers, compresión client-side y límite duro. Cola de revisión para el admin." },
  { r: "Polling de estados satura la API", p: "Bajo", m: "Intervalo de 5 s con jitter + caché de 2 s. La arquitectura de eventos permite cambiar a websocket sin reescribir." },
  { r: "Seed de zonas desactualizado", p: "Bajo", m: "Sectores de Santiago versionados en seed.ts con owner claro; el admin activa/desactiva sin deploy." },
];

export const BIZ_RISKS = [
  { r: "Huevo y gallina: sin pros no hay clientes", p: "Alto", m: "Reclutar 30 fundadores ANTES de abrir al público. Beta cerrada solo en sectores con cobertura garantizada (Los Jardines, Ens. Libertad, Centro)." },
  { r: "Desintermediación: se van por WhatsApp", p: "Alto", m: "Hacer que quedarse valga la pena: historial, reviews verificadas que ningún WhatsApp da, agenda, recordatorios. El plan PRO cobra por visibilidad, no por transacción." },
  { r: "Disposición a pagar RD$799 sin ver valor", p: "Medio", m: "Fundadores no pagan en V1: usan PRO gratis y lo pierden si no renuevan. Medir uso real antes de encender el cobro." },
  { r: "Competencia: grupos de Facebook y referrals boca a boca", p: "Medio", m: "No competimos con el grupo de Facebook: competimos con la incertidumbre. Verificación + ETA + tracking + reviews son el foso." },
];

// ── 11 · Plan ────────────────────────────────────────────────
export const PHASES = [
  {
    id: "F0", weeks: "Semanas 1–2", title: "Fundaciones", tone: "azul",
    items: ["Schema Prisma completo + migraciones", "Auth OTP teléfono + sesiones + RBAC", "Seed: 22 categorías, zonas de Santiago, planes", "Design system Tailwind (este blueprint es la guía)", "Storage R2 con prefirmado funcionando"],
  },
  {
    id: "F1", weeks: "Semanas 3–4", title: "Núcleo del cliente", tone: "jade",
    items: ["Wizard de solicitud (6 pasos) modo ⚡Ahora", "Motor de matching + ranking", "Tracking de estados (polling + RequestEvent)", "Perfil público del pro (página SEO)", "Reviews + favoritos"],
  },
  {
    id: "F2", weeks: "Semanas 5–6", title: "Núcleo del profesional", tone: "amber",
    items: ["Onboarding pro + verificaciones", "Botón Disponible, aceptar/rechazar + ETA", "Dashboard pro con estadísticas básicas", "Programa Fundador + referidos cualificados", "Notificaciones email (Resend)"],
  },
  {
    id: "F3", weeks: "Semanas 7–8", title: "Admin + beta cerrada", tone: "flama",
    items: ["Dashboard admin: aprobación, categorías, reportes", "Métricas y tablero de cobertura por categoría/zona", "Hardening: rate limits, CSP, pruebas de concurrencia", "Beta cerrada: 30 fundadores, 3 sectores de Santiago", "Medir: aceptación, tiempos, rating, retención"],
  },
];

export const COVERAGE = [
  { cat: "Plomería", reg: 18, ver: 15, disp: 7, critical: false },
  { cat: "Electricidad", reg: 16, ver: 13, disp: 6, critical: false },
  { cat: "Limpieza", reg: 22, ver: 17, disp: 9, critical: false },
  { cat: "Aire acondicionado", reg: 12, ver: 10, disp: 5, critical: false },
  { cat: "Mecánica", reg: 14, ver: 11, disp: 4, critical: true },
  { cat: "Cerrajería", reg: 9, ver: 7, disp: 3, critical: true },
  { cat: "Pintura", reg: 11, ver: 9, disp: 5, critical: false },
  { cat: "Neveras / Línea blanca", reg: 7, ver: 5, disp: 2, critical: true },
  { cat: "Cámaras / Redes", reg: 8, ver: 6, disp: 4, critical: false },
  { cat: "Grúas", reg: 4, ver: 3, disp: 1, critical: true },
];

export const KPIS = [
  { k: "Usuarios registrados", v: "meta 500 · mes 1" },
  { k: "Pros registrados / verificados", v: "60 / 40" },
  { k: "Pros disponibles en hora pico", v: "≥ 25" },
  { k: "Solicitudes → completadas", v: "conversión ≥ 45%" },
  { k: "Tiempo promedio de aceptación", v: "< 3 min" },
  { k: "Calificación promedio", v: "≥ 4.6 ★" },
  { k: "Referidos cualificados", v: "15 en beta" },
  { k: "Cobertura crítica", v: "0 categorías en rojo" },
];

// ── 07 · Wireframes textuales ────────────────────────────────
export const WIREFRAMES = [
  {
    name: "HOME · cliente",
    note: "Abre directo a la acción: “¿Qué necesitas hoy?”",
    art: `┌─────────────────────────────┐
│ ⌂ AlToque        🔔  👤     │
│ ─────────────────────────── │
│ ¿Qué necesitas HOY?         │
│ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │🔧    │ │⚡    │ │❄️    │  │
│ │Plom. │ │Elect.│ │A/C   │  │
│ └──────┘ └──────┘ └──────┘  │
│ ─ ⚡ Lo necesito ahora ──── │
│ ─ 📅 Cotizar / programar ── │
│ ─────────────────────────── │
│ Cerca de ti · Los Jardines  │
│ ★ 4.9 Carlos R. · 3.2 km    │
│ ★ 4.8 Marta P.  · 4.1 km    │
└─────────────────────────────┘`,
  },
  {
    name: "WIZARD · solicitud",
    note: "6 pasos, 1 decisión por pantalla",
    art: `┌─────────────────────────────┐
│ ←  Paso 3 de 6        ●●○   │
│ ─────────────────────────── │
│ ¿Qué pasa exactamente?      │
│ ┌─────────────────────────┐ │
│ │ Fuga debajo del         │ │
│ │ fregadero…              │ │
│ └─────────────────────────┘ │
│ [tubería] [fuga] [urgente]  │
│ ┌────┐┌────┐┌────┐          │
│ │📷 1││📷 2││ ＋ │           │
│ └────┘└────┘└────┘          │
│                             │
│  [ ⚡ Lo necesito AHORA ]    │
│  [ 📅 Quiero programarlo ]  │
└─────────────────────────────┘`,
  },
  {
    name: "TRACKING · cliente",
    note: "El estado es el protagonista",
    art: `┌─────────────────────────────┐
│ ←  Solicitud AT-2026-0042   │
│ ─────────────────────────── │
│        ┌───┐                │
│        │CR │  Carlos Rodríguez
│        └───┘  ★ 4.9 · Plomería
│  🟢 EN CAMINO               │
│  Llegada estimada: 18 min   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░  72%       │
│ ─────────────────────────── │
│ ✓ Creada      2:41 PM       │
│ ✓ Aceptada    2:43 PM       │
│ ● En camino   2:44 PM       │
│ ○ Llegó                     │
│ ○ Completado                │
│ ─────────────────────────── │
│  [ 📞 Llamar ]  [ ⚠ Reportar]│
└─────────────────────────────┘`,
  },
  {
    name: "PERFIL · profesional",
    note: "Página pública + SEO: /pro/carlos-rodriguez",
    art: `┌─────────────────────────────┐
│ ←            ♡ Favorito     │
│ ─────────────────────────── │
│   ┌────┐  Carlos Rodríguez  │
│   │ CR │  ★ 4.9 (127)       │
│   └────┘  238 trabajos      │
│ ✓ Identidad  ✓ Teléfono     │
│ ✓ Profesional  ⛨ Fundador   │
│ 🟢 Disponible · 15–30 min   │
│ ─────────────────────────── │
│ Servicios: Plomería,        │
│ instalaciones, reparaciones │
│ Zona: Santiago Centro,      │
│ Los Jardines, Ens. Libertad │
│ ┌────┐┌────┐┌────┐ Portfolio│
│ │ 🖼 ││ 🖼 ││ 🖼 │          │
│ └────┘└────┘└────┘          │
│ ─────────────────────────── │
│      [ Solicitar servicio ]  │
└─────────────────────────────┘`,
  },
  {
    name: "DASHBOARD · pro",
    note: "El botón verde manda",
    art: `┌─────────────────────────────┐
│ Dashboard · Carlos          │
│ ┌─────────────────────────┐ │
│ │  [ 🟢 DISPONIBLE ]      │ │
│ └─────────────────────────┘ │
│ Hoy: 3 servicios · RD$—     │
│ Semana: 14 · ★ 4.9          │
│ ─────────────────────────── │
│ ⚡ NUEVA · Plomería         │
│ “Fuga bajo fregadero”       │
│ Los Jardines · ~3.2 km      │
│   [ Rechazar ] [ ACEPTAR ]  │
│ ─────────────────────────── │
│ ETA: (15)(20)(30)(45)(60)   │
│ ─────────────────────────── │
│ Referidos: 2/3 → +1 mes PRO │
└─────────────────────────────┘`,
  },
  {
    name: "ADMIN · cobertura",
    note: "Dónde reclutar, en una tabla",
    art: `┌─────────────────────────────┐
│ Admin · Cobertura Santiago  │
│ ─────────────────────────── │
│ CAT         REG  VER  DISP  │
│ Plomería     18   15   7 ▮▮ │
│ Electricidad 16   13   6 ▮▮ │
│ Limpieza     22   17   9 ▮▮▮│
│ Mecánica     14   11   4 ⚠  │
│ Cerrajería    9    7   3 ⚠  │
│ Grúas         4    3   1 ⛔  │
│ ─────────────────────────── │
│ Aprobaciones pendientes: 6  │
│ Reportes abiertos: 2        │
│ Conversión: 47% · ★ 4.8     │
└─────────────────────────────┘`,
  },
];
