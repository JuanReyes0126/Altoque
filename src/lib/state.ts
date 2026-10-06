/* ════════════════════════════════════════════════════════════════
   ALTOQUE · Estado + datos (src/lib/state)
   F0: fuente de datos en memoria (mock) + simulación de flujos.
   F1+: la fuente única de verdad pasa a PostgreSQL vía /server;
   este módulo queda como hidratación/estado local de la UI.
   Los tipos viven en src/types (espejo del esquema de BD).
   ════════════════════════════════════════════════════════════════ */
import { useSyncExternalStore } from "react";
import type {
  Cat, Incoming, Job, JobStatus, Pro, ProJob, Review, Role, Session, State, View, When, Zone,
} from "../types";
export type * from "../types";

/* ─────────────────────────── datos ─────────────────────────── */
export const CARLOS_ID = "p1";
export const CLIENT_NAME = "María Peralta";

export const ZONES: Zone[] = [
  { id: "cerros", name: "Cerros de Gurabo", km: 0 },
  { id: "gurabo", name: "Gurabo", km: 1.8 },
  { id: "ensueno", name: "El Ensueño", km: 2.4 },
  { id: "jardines", name: "Los Jardines Metropolitanos", km: 3.1 },
  { id: "trinitaria", name: "La Trinitaria", km: 3.6 },
  { id: "olimpica", name: "Villa Olímpica", km: 4.2 },
  { id: "bella", name: "Bella Vista", km: 4.8 },
  { id: "libertad", name: "Ensanche Libertad", km: 5.4 },
  { id: "cienfuegos", name: "Cienfuegos", km: 6.5 },
];

export const GROUPS = ["Hogar", "Técnicos", "Automotriz", "Tecnología", "Eventos", "Construcción"];

export const CATS: Cat[] = [
  { id: "plomeria", name: "Plomería", icon: "wrench", group: "Hogar", base: 800 },
  { id: "electricidad", name: "Electricidad", icon: "plug", group: "Hogar", base: 900 },
  { id: "aire", name: "Aire acondicionado", icon: "snow", group: "Técnicos", base: 1500 },
  { id: "cerrajeria", name: "Cerrajería", icon: "key", group: "Hogar", base: 700 },
  { id: "limpieza", name: "Limpieza", icon: "broom", group: "Hogar", base: 1200 },
  { id: "mecanica", name: "Mecánica", icon: "car", group: "Automotriz", base: 1500 },
  { id: "ebanisteria", name: "Ebanistería", icon: "hammer", group: "Hogar", base: 2000 },
  { id: "pintura", name: "Pintura", icon: "roller", group: "Hogar", base: 2500 },
  { id: "remodelacion", name: "Remodelación", icon: "layers", group: "Construcción", base: 15000 },
  { id: "fotografia", name: "Fotografía", icon: "camera", group: "Eventos", base: 8000 },
  { id: "grua", name: "Grúas", icon: "car", group: "Automotriz", base: 2500 },
  { id: "neveras", name: "Neveras", icon: "snow", group: "Técnicos", base: 1400 },
  { id: "inversores", name: "Inversores", icon: "plug", group: "Técnicos", base: 1800 },
  { id: "camaras", name: "Cámaras de seguridad", icon: "camera", group: "Tecnología", base: 6500 },
  { id: "wifi", name: "Redes y Wi-Fi", icon: "radar", group: "Tecnología", base: 2200 },
  { id: "dj", name: "DJ", icon: "spark", group: "Eventos", base: 12000 },
  { id: "catering", name: "Catering", icon: "gift", group: "Eventos", base: 25000 },
  { id: "mudanzas", name: "Mudanzas", icon: "layers", group: "Hogar", base: 5000 },
  { id: "jardineria", name: "Jardinería", icon: "leaf", group: "Hogar", base: 1600 },
  { id: "fumigacion", name: "Fumigación", icon: "leaf", group: "Hogar", base: 1800 },
  { id: "arquitectura", name: "Arquitectura", icon: "doc", group: "Construcción", base: 30000 },
  { id: "detailing", name: "Detailing", icon: "spark", group: "Automotriz", base: 3500 },
];

export const JOB_IMGS = [
  { f: 1, q: 0, label: "Fregadero" }, { f: 1, q: 1, label: "Breaker" }, { f: 1, q: 2, label: "Split A/C" }, { f: 1, q: 3, label: "Pared pintada" },
  { f: 2, q: 0, label: "Mueble de madera" }, { f: 2, q: 1, label: "Cocina limpia" }, { f: 2, q: 2, label: "Cámara instalada" }, { f: 2, q: 3, label: "Motor" },
];

const FACE_URLS: Record<number, string> = {
  1: "https://image.qwenlm.ai/generated-images/29b97cf8-5664-40c0-9112-c04ad8bbbe13/_result.png",
  2: "https://image.qwenlm.ai/generated-images/6390975e-9643-4a7a-a6af-d6dc749998eb/_result.png",
  3: "https://image.qwenlm.ai/generated-images/37025499-3050-4572-b4de-180f119cd604/_result.png",
  4: "https://image.qwenlm.ai/generated-images/b0709c53-f9d7-46b2-8c24-0c81e5867a7a/_result.png",
};
const JOB_URLS: Record<number, string> = {
  1: "https://image.qwenlm.ai/generated-images/5701b570-f0c1-43e0-aa78-af1f50423422/_result.png",
  2: "https://image.qwenlm.ai/generated-images/8f0c5b39-9bda-42cf-87e5-30d11222e1ea/_result.png",
};
export const faceUrl = (f: number) => FACE_URLS[f];
export const jobUrl = (i: number) => JOB_URLS[JOB_IMGS[i].f];
export const quadPos = (q: number) => `${(q % 2) * 100}% ${Math.floor(q / 2) * 100}%`;

const R = (name: string, rating: number, text: string, ago: string): Review => ({ name, rating, text, date: ago, ago });

export const PROS: Pro[] = [
  {
    id: "p1", name: "Carlos Rodríguez", cats: ["plomeria"], tagline: "Plomería · Instalaciones · Reparaciones",
    rating: 4.9, reviews: 127, jobs: 238, km: 2.3, eta: 15, available: true, price: 800, years: 9, respMin: 3,
    face: { f: 1, q: 0 }, tint: "#0c5f46", bio: "Plomero certificado con 9 años resolviendo fugas, destapes e instalaciones en Santiago. Llego rápido, trabajo limpio y siempre explico qué se hizo y por qué.",
    zones: ["jardines", "gurabo", "cerros", "ensueno"], portfolio: [0, 1, 5], founder: true,
    verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("María G.", 5, "Llegó en 12 minutos y resolvió la fuga del fregadero en media hora. Dejó todo limpio y me explicó el mantenimiento.", "hace 2 días"),
      R("José P.", 5, "Puntual, honesto con el precio y muy profesional. Ya es mi plomero de cabecera.", "hace 1 semana"),
      R("Ana T.", 4, "Muy buen trabajo con la instalación del lavabo. Solo tardó un poco más de lo estimado.", "hace 2 semanas"),
    ],
  },
  {
    id: "p2", name: "Luis Méndez", cats: ["electricidad", "inversores"], tagline: "Electricidad residencial · Inversores",
    rating: 4.8, reviews: 98, jobs: 187, km: 3.1, eta: 20, available: true, price: 900, years: 11, respMin: 4,
    face: { f: 1, q: 1 }, tint: "#b45309", bio: "Electricista con licencia. Cortocircuitos, paneles, inversores y plantas eléctricas. Trabajo garantizado por escrito.",
    zones: ["trinitaria", "olimpica", "jardines"], portfolio: [1, 6], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Pedro L.", 5, "Encontró el cortocircuito que otros dos no pudieron. Excelente.", "hace 3 días"),
      R("Rosa M.", 5, "Instaló el inversor completo en una tarde. Muy ordenado.", "hace 1 semana"),
      R("Juan C.", 4, "Buen servicio, precio justo.", "hace 3 semanas"),
    ],
  },
  {
    id: "p3", name: "Rafael Batista", cats: ["aire", "neveras"], tagline: "Aire acondicionado · Refrigeración",
    rating: 4.9, reviews: 143, jobs: 264, km: 4.2, eta: 25, available: true, price: 1500, years: 12, respMin: 5,
    face: { f: 1, q: 2 }, tint: "#1d4ed8", bio: "Especialista en splits, centrales y neveras. Mantenimiento, carga de gas e instalación con garantía de 6 meses.",
    zones: ["olimpica", "bella", "libertad"], portfolio: [2], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Carmen D.", 5, "Mi split enfriando como nuevo el mismo día. Muy profesional.", "hace 1 día"),
      R("Félix R.", 5, "Explica todo con paciencia y no infla precios.", "hace 5 días"),
      R("Lidia S.", 5, "Tercera vez que lo llamo. Siempre impecable.", "hace 2 semanas"),
    ],
  },
  {
    id: "p4", name: "Johnny Cabrera", cats: ["cerrajeria"], tagline: "Cerrajería 24 horas · Aperturas",
    rating: 4.7, reviews: 76, jobs: 132, km: 1.9, eta: 10, available: true, price: 700, years: 7, respMin: 2,
    face: { f: 1, q: 3 }, tint: "#6d28d9", bio: "Aperturas de puertas y vehículos, cambio de cilindros, cerraduras inteligentes. Disponible de noche y fines de semana.",
    zones: ["gurabo", "cerros", "ensueno"], portfolio: [3], verified: { id: true, phone: true, pro: false },
    reviewsList: [
      R("Teresa V.", 5, "Me abrió la puerta a las 11 de la noche en 15 minutos. Un salvavidas.", "hace 4 días"),
      R("Omar H.", 4, "Rápido y correcto. Precio un poco alto por la hora, pero vale.", "hace 1 semana"),
      R("Sara B.", 5, "Cambió el cilindro y dejó todo funcionando perfecto.", "hace 3 semanas"),
    ],
  },
  {
    id: "p5", name: "Martha Almonte", cats: ["limpieza"], tagline: "Limpieza profunda · Equipos propios",
    rating: 5.0, reviews: 64, jobs: 121, km: 2.8, eta: 30, available: true, price: 1200, years: 6, respMin: 6,
    face: { f: 2, q: 0 }, tint: "#be185d", bio: "Limpieza residencial y de oficinas con equipo propio de 3 personas. Productos incluidos y checklist de 40 puntos.",
    zones: ["jardines", "trinitaria", "ensueno"], portfolio: [5], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Gloria F.", 5, "Dejó mi apartamento impecable, hasta los rieles de las ventanas.", "hace 2 días"),
      R("Nelson A.", 5, "Puntuales y muy detallistas. Repetiré mensual.", "hace 1 semana"),
      R("Iris P.", 5, "La mejor limpieza que he contratado en Santiago.", "hace 2 semanas"),
    ],
  },
  {
    id: "p6", name: "Pedro Guzmán", cats: ["mecanica"], tagline: "Mecánica a domicilio · Diagnóstico",
    rating: 4.8, reviews: 112, jobs: 205, km: 3.5, eta: 20, available: false, price: 1500, years: 14, respMin: 8,
    face: { f: 2, q: 1 }, tint: "#92400e", bio: "Mecánica general a domicilio con escáner OBD. Frenos, correas, afinamiento y emergencias de carretera.",
    zones: ["bella", "libertad", "cienfuegos"], portfolio: [7], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Héctor M.", 5, "Diagnosticó el fallo en 10 minutos con el escáner. Honesto.", "hace 3 días"),
      R("Yolanda C.", 4, "Buen trabajo con los frenos, llegó a tiempo.", "hace 1 semana"),
      R("Ramón T.", 5, "Me salvó varado en la avenida. Gracias totales.", "hace 1 mes"),
    ],
  },
  {
    id: "p7", name: "Ana Polanco", cats: ["pintura"], tagline: "Pintura interior y exterior",
    rating: 4.9, reviews: 58, jobs: 94, km: 4.0, eta: 45, available: true, price: 2500, years: 8, respMin: 10,
    face: { f: 2, q: 2 }, tint: "#0f766e", bio: "Acabados finos, pintura decorativa y exteriores. Presupuesto por escrito y protección total de muebles.",
    zones: ["olimpica", "jardines", "bella"], portfolio: [3], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Clara J.", 5, "El acabado de la sala quedó de revista. Muy meticulosa.", "hace 5 días"),
      R("Bruno E.", 5, "Cumplió la fecha prometida al día. Raro y valioso.", "hace 2 semanas"),
      R("Dahiana R.", 4, "Excelente trabajo, buena comunicación.", "hace 1 mes"),
    ],
  },
  {
    id: "p8", name: "Miguel Rosario", cats: ["ebanisteria"], tagline: "Muebles a medida · Closets",
    rating: 4.8, reviews: 41, jobs: 87, km: 5.2, eta: 60, available: true, price: 2000, years: 15, respMin: 15,
    face: { f: 2, q: 3 }, tint: "#78350f", bio: "Carpintería fina: closets, cocinas, puertas y muebles a medida en madera criolla y MDF.",
    zones: ["cienfuegos", "libertad"], portfolio: [4], verified: { id: true, phone: true, pro: false },
    reviewsList: [
      R("Patricia N.", 5, "El closet quedó mejor que en el diseño. Artesano de verdad.", "hace 1 semana"),
      R("Víctor S.", 5, "Madera y herrajes de primera. Precio acorde.", "hace 3 semanas"),
      R("Elena G.", 4, "Hermoso trabajo, se pasó unos días de la fecha.", "hace 1 mes"),
    ],
  },
  {
    id: "p9", name: "Sandy Taveras", cats: ["remodelacion"], tagline: "Remodelaciones llave en mano",
    rating: 4.9, reviews: 37, jobs: 63, km: 4.6, eta: 60, available: true, price: 15000, years: 10, respMin: 20,
    face: { f: 3, q: 0 }, tint: "#374151", bio: "Contratista de remodelaciones: baños, cocinas y ampliaciones con cronograma y contrato claros.",
    zones: ["bella", "olimpica"], portfolio: [3, 4, 5], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Alba K.", 5, "Remodeló nuestro baño en 3 semanas exactas. Comunicación diaria.", "hace 1 semana"),
      R("Gerardo P.", 5, "Presupuesto respetado al peso. Muy profesional.", "hace 1 mes"),
      R("Milagros O.", 5, "La cocina quedó espectacular.", "hace 2 meses"),
    ],
  },
  {
    id: "p10", name: "Joel Espinal", cats: ["fotografia"], tagline: "Fotografía social y corporativa",
    rating: 4.9, reviews: 88, jobs: 141, km: 3.8, eta: 60, available: true, price: 8000, years: 9, respMin: 12,
    face: { f: 3, q: 1 }, tint: "#4338ca", bio: "Bodas, quince años, producto y eventos corporativos. Entrega en galería online en 72 horas.",
    zones: ["jardines", "bella", "trinitaria"], portfolio: [6, 2], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Karina D.", 5, "Las fotos de la boda nos hicieron llorar. Talento puro.", "hace 4 días"),
      R("Eventos LB", 5, "Cubrió nuestra feria completo, entrega rapidísima.", "hace 2 semanas"),
      R("Samuel W.", 5, "Sesiones de producto que venden solas.", "hace 1 mes"),
    ],
  },
  {
    id: "p11", name: "Wanda Jiménez", cats: ["limpieza", "fumigacion"], tagline: "Limpieza y fumigación",
    rating: 4.7, reviews: 52, jobs: 98, km: 2.2, eta: 30, available: true, price: 1100, years: 5, respMin: 7,
    face: { f: 3, q: 2 }, tint: "#a21caf", bio: "Limpieza post-construcción, fumigación certificada y mantenimiento recurrente para hogares y locales.",
    zones: ["ensueno", "gurabo", "cerros"], portfolio: [5], verified: { id: true, phone: true, pro: false },
    reviewsList: [
      R("Olga T.", 5, "Sacó todo el polvo de obra. Increíble.", "hace 3 días"),
      R("Iván R.", 4, "Fumigación efectiva, cero cucarachas en 2 meses.", "hace 2 semanas"),
      R("Brenda L.", 5, "Muy amable y eficiente.", "hace 1 mes"),
    ],
  },
  {
    id: "p12", name: "Kelvin Núñez", cats: ["electricidad", "inversores"], tagline: "Electricidad · Plantas eléctricas",
    rating: 4.6, reviews: 33, jobs: 71, km: 6.1, eta: 30, available: true, price: 850, years: 6, respMin: 9,
    face: { f: 3, q: 3 }, tint: "#b91c1c", bio: "Instalaciones eléctricas, plantas y transferencia automática. Cobertura en zonas norte de Santiago.",
    zones: ["cienfuegos", "libertad"], portfolio: [1], verified: { id: true, phone: false, pro: false },
    reviewsList: [
      R("Darío F.", 5, "Instaló la transferencia sin problemas.", "hace 1 semana"),
      R("Nora P.", 4, "Buen trabajo, puntual.", "hace 1 mes"),
      R("Teo G.", 4, "Correcto y económico.", "hace 2 meses"),
    ],
  },
  {
    id: "p13", name: "Francisco Alvarado", cats: ["grua"], tagline: "Grúas y auxilio vial",
    rating: 4.8, reviews: 29, jobs: 54, km: 5.0, eta: 25, available: true, price: 2500, years: 8, respMin: 4,
    face: { f: 4, q: 0 }, tint: "#0e7490", bio: "Grúa plataforma 24/7 para Santiago y carretera. Traslados de vehículos con seguro incluido.",
    zones: ["bella", "cienfuegos", "libertad"], portfolio: [7], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Marcos Y.", 5, "Llegó en 20 min a la circunvalación. Trato excelente.", "hace 2 días"),
      R("Fiordaliza C.", 5, "Cuidaron mi carro como propio.", "hace 1 semana"),
      R("Pedro A.", 4, "Eficientes, precio estándar.", "hace 3 semanas"),
    ],
  },
  {
    id: "p14", name: "Diana Marte", cats: ["camaras", "wifi"], tagline: "Cámaras · Redes · Domótica",
    rating: 4.9, reviews: 45, jobs: 79, km: 3.3, eta: 35, available: true, price: 6500, years: 7, respMin: 6,
    face: { f: 4, q: 1 }, tint: "#0369a1", bio: "Sistemas de cámaras con app, mallas Wi-Fi y casas inteligentes. Instalación limpia y capacitación incluida.",
    zones: ["jardines", "ensueno", "trinitaria"], portfolio: [6], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Ricardo M.", 5, "Cuatro cámaras configuradas en mi celular el mismo día.", "hace 5 días"),
      R("Vanessa H.", 5, "El Wi-Fi por fin llega al patio. Genial.", "hace 2 semanas"),
      R("Oscar B.", 5, "Muy profesional y didáctica.", "hace 1 mes"),
    ],
  },
  {
    id: "p15", name: "Héctor Peña", cats: ["aire", "neveras"], tagline: "Refrigeración comercial y hogar",
    rating: 4.7, reviews: 67, jobs: 118, km: 2.9, eta: 20, available: true, price: 1400, years: 10, respMin: 5,
    face: { f: 4, q: 2 }, tint: "#15803d", bio: "Mantenimiento de splits, neveras y vitrinas comerciales. Contrato mensual para negocios.",
    zones: ["gurabo", "jardines", "olimpica"], portfolio: [2], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Colmado El Sol", 5, "Nos mantiene todas las vitrinas. Servicio de 10.", "hace 3 días"),
      R("Julia N.", 4, "Reparó la nevera el mismo día.", "hace 1 semana"),
      R("Andrés V.", 5, "Puntual y limpio.", "hace 1 mes"),
    ],
  },
  {
    id: "p16", name: "Carmen Peralta", cats: ["catering"], tagline: "Catering para eventos",
    rating: 4.9, reviews: 23, jobs: 31, km: 4.4, eta: 60, available: true, price: 25000, years: 11, respMin: 25,
    face: { f: 4, q: 3 }, tint: "#9d174d", bio: "Catering criollo e internacional para bodas, corporativos y cumpleaños. Menú degustación incluido.",
    zones: ["bella", "olimpica", "jardines"], portfolio: [5], verified: { id: true, phone: true, pro: true },
    reviewsList: [
      R("Bodas MR", 5, "Los invitados todavía hablan del chivo liniero.", "hace 2 semanas"),
      R("Grupo LN", 5, "Almuerzo corporativo impecable, a tiempo.", "hace 1 mes"),
      R("Dulce A.", 5, "Sabor de casa con presentación de hotel.", "hace 2 meses"),
    ],
  },
];

export const PROBLEMS: Record<string, string[]> = {
  plomeria: ["Fuga debajo del fregadero", "Tubería rota", "Inodoro tapado", "Instalar un lavabo", "Presión baja de agua", "Calentador dañado"],
  electricidad: ["Cortocircuito", "No hay luz en un área", "Instalar lámparas", "Breaker se dispara", "Instalar inversor"],
  aire: ["No enfría", "Instalación de split", "Mantenimiento", "Gotea agua", "Hace ruido"],
  cerrajeria: ["Puerta trabada", "Cambio de cilindro", "Llave perdida", "Abrir vehículo", "Cerradura inteligente"],
  limpieza: ["Limpieza profunda", "Post-construcción", "Limpieza de oficina", "Lavado de cisterna"],
  mecanica: ["Carro no enciende", "Revisión de frenos", "Cambio de aceite", "Correa rota", "Diagnóstico por escáner"],
  grua: ["Vehículo averiado", "Traslado de vehículo", "Accidente"],
  camaras: ["Instalación de cámaras", "Revisar sistema", "Configurar app"],
  wifi: ["Wi-Fi no llega lejos", "Configurar router", "Cableado de red"],
};

export const TICKER = [
  "María solicitó Plomería en Los Jardines · hace 2 min",
  "Rafael completó un A/C en Villa Olímpica · ★ 5.0 · hace 6 min",
  "Johnny abrió una puerta en Gurabo · llegó en 9 min",
  "Martha terminó limpieza profunda en El Ensueño · hace 12 min",
  "Diana instaló 4 cámaras en La Trinitaria · hace 18 min",
  "Francisco asistió una grúa en Bella Vista · hace 21 min",
];

export const INCOMING_POOL: Omit<Incoming, "id" | "expiresIn">[] = [
  { client: "Roberto Salcedo", clientRating: 4.6, catId: "plomeria", zoneId: "jardines", km: 2.1, problem: "Fuga debajo del fregadero, gotea constante desde anoche.", photos: [0], price: 800 },
  { client: "Altagracia Bisonó", clientRating: 4.9, catId: "plomeria", zoneId: "ensueno", km: 2.6, problem: "Inodoro tapado en el baño principal, urge.", photos: [], price: 750 },
  { client: "Ferretería El Progreso", clientRating: 4.7, catId: "plomeria", zoneId: "gurabo", km: 1.7, problem: "Instalación de dos lavamanos en local comercial.", photos: [5], price: 2200 },
  { client: "Yolanda Cepeda", clientRating: 4.8, catId: "plomeria", zoneId: "trinitaria", km: 3.4, problem: "Presión de agua muy baja en el segundo nivel.", photos: [], price: 900 },
  { client: "Nelson Rodríguez", clientRating: 4.5, catId: "plomeria", zoneId: "cerros", km: 0.9, problem: "Tubería de la lavadora botando agua.", photos: [7], price: 850 },
];

/* ─────────────────────────── store ─────────────────────────── */
/*
 * F1.8: la sesión es 100% del servidor (cookie HttpOnly de Better Auth).
 * - NADA de autenticación en localStorage/sessionStorage.
 * - `session` se llena con GET /api/v1/auth/get-session + /api/v1/me.
 * - `role` es SOLO el modo de vista actual (cliente ↔ proveedor): no
 *   concede privilegios — la autoridad es el backend (RBAC + ownership).
 */
let state: State = {
  role: "customer", zoneId: "cerros", favorites: [], jobs: [], inbox: [],
  proActive: null, proAvailable: false, toastMsg: null, toastId: 0,
  proStats: { today: 0, earnings: 0, week: [], acceptRate: 0 },
  session: null,
};

const listeners = new Set<() => void>();
export const getState = () => state;
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useApp(): State { return useSyncExternalStore(subscribe, getState); }

export const toast = (msg: string) => set({ toastMsg: msg, toastId: state.toastId + 1 });
/** Modo de vista (cliente ↔ proveedor). NO toca la sesión ni concede privilegios. */
export const setRole = (role: Role) => set({ role });
export const setZone = (zoneId: string) => set({ zoneId });
export const toggleFav = (id: string) =>
  set({ favorites: state.favorites.includes(id) ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] });
export const setProAvailable = (v: boolean) => {
  set({ proAvailable: v });
  if (v) setTimeout(() => { if (state.proAvailable) toast("Estás visible para nuevas solicitudes"); }, 300);
};

/* ── sesión real (F1.8): solo el servidor la otorga; aquí se representa ── */
export function setSession(session: Session | null) {
  if (session?.id !== state.session?.id) {
    set({ session, role: "customer", favorites: [], jobs: [], inbox: [], proActive: null, proAvailable: false });
  } else set({ session, role: session ? state.role : "customer" });
}
export function clearSession() {
  set({ session: null, role: "customer", favorites: [], jobs: [], inbox: [], proActive: null, proAvailable: false });
}

let pendingIntent: View | null = null;
export const setIntent = (v: View | null) => { pendingIntent = v; };
export const takeIntent = (): View | null => { const i = pendingIntent; pendingIntent = null; return i; };

export const fmt = (n: number) => "RD$" + n.toLocaleString("es-DO");
export const catById = (id: string) => CATS.find((c) => c.id === id)!;
export const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;
export const proById = (id: string) => PROS.find((p) => p.id === id)!;
export const prosByCat = (catId: string) => PROS.filter((p) => p.cats.includes(catId));

/* ── F2: Eliminadas todas las funciones de simulación ── */
/* El flujo real ahora usa endpoints del backend vía api.ts */

export function searchAll(q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return { cats: [] as Cat[], pros: [] as Pro[] };
  return {
    cats: CATS.filter((c) => c.name.toLowerCase().includes(t) || c.group.toLowerCase().includes(t)).slice(0, 5),
    pros: PROS.filter((p) => p.name.toLowerCase().includes(t) || p.tagline.toLowerCase().includes(t) || p.cats.some((c) => catById(c).name.toLowerCase().includes(t))).slice(0, 5),
  };
}
