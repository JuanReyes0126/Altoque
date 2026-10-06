/**
 * ALTOQUE · Seed idempotente (F1.1)
 *
 * Ejecución local explícita: node --env-file=.env --import=tsx
 *   server/database/seeds/seed.ts --apply
 * Requiere: DATABASE_URL de altoque_dev en 127.0.0.1, o runner aislado.
 * El catálogo nunca se siembra sobre una base remota.
 *
 * Idempotente: todo se inserta con `upsert` sobre IDs estables.
 * El super admin solo se crea si SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD
 * están definidas; la contraseña se hashea con el MISMO mecanismo que
 * Better Auth (scrypt vía better-auth/crypto).
 */
import { PrismaClient } from "@prisma/client";
import { adminCredentials, bootstrapAdmin } from "./admin.js";
import { assertSeedIdentity, seedTarget } from "./safety.js";

let prisma: PrismaClient | undefined;

const CATEGORIES = [
  { id: "plomeria", name: "Plomería", icon: "wrench", group_name: "Hogar", sort: 1 },
  { id: "electricidad", name: "Electricidad", icon: "plug", group_name: "Hogar", sort: 2 },
  { id: "aire", name: "Aire acondicionado", icon: "snow", group_name: "Técnicos", sort: 3 },
  { id: "cerrajeria", name: "Cerrajería", icon: "key", group_name: "Hogar", sort: 4 },
  { id: "limpieza", name: "Limpieza", icon: "broom", group_name: "Hogar", sort: 5 },
  { id: "mecanica", name: "Mecánica", icon: "car", group_name: "Automotriz", sort: 6 },
  { id: "ebanisteria", name: "Ebanistería", icon: "hammer", group_name: "Hogar", sort: 7 },
  { id: "pintura", name: "Pintura", icon: "roller", group_name: "Hogar", sort: 8 },
  { id: "remodelacion", name: "Remodelación", icon: "layers", group_name: "Construcción", sort: 9 },
  { id: "fotografia", name: "Fotografía", icon: "camera", group_name: "Eventos", sort: 10 },
  { id: "grua", name: "Grúas", icon: "car", group_name: "Automotriz", sort: 11 },
  { id: "neveras", name: "Neveras", icon: "snow", group_name: "Técnicos", sort: 12 },
  { id: "inversores", name: "Inversores", icon: "plug", group_name: "Técnicos", sort: 13 },
  { id: "camaras", name: "Cámaras de seguridad", icon: "camera", group_name: "Tecnología", sort: 14 },
  { id: "wifi", name: "Redes y Wi-Fi", icon: "radar", group_name: "Tecnología", sort: 15 },
  { id: "dj", name: "DJ", icon: "spark", group_name: "Eventos", sort: 16 },
  { id: "catering", name: "Catering", icon: "gift", group_name: "Eventos", sort: 17 },
  { id: "mudanzas", name: "Mudanzas", icon: "layers", group_name: "Hogar", sort: 18 },
  { id: "jardineria", name: "Jardinería", icon: "leaf", group_name: "Hogar", sort: 19 },
  { id: "fumigacion", name: "Fumigación", icon: "leaf", group_name: "Hogar", sort: 20 },
  { id: "arquitectura", name: "Arquitectura", icon: "doc", group_name: "Construcción", sort: 21 },
  { id: "detailing", name: "Detailing", icon: "spark", group_name: "Automotriz", sort: 22 },
];

const ZONES = [
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

async function main() {
  const target = seedTarget(process.env, { apply: process.argv.slice(2).includes("--apply") });
  const credentials = adminCredentials(process.env, true);
  prisma = new PrismaClient({ datasourceUrl: target.url, log: [] });
  await assertSeedIdentity(prisma, target);

  console.log("→ Sembrando categorías…");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, icon: c.icon, group_name: c.group_name, sort: c.sort },
      create: c,
    });
  }

  console.log("→ Sembrando zonas…");
  for (const z of ZONES) {
    await prisma.zone.upsert({
      where: { id: z.id },
      update: { name: z.name, km_from_center: z.km },
      create: { id: z.id, name: z.name, km_from_center: z.km },
    });
  }

  console.log("→ Inicializando secuencia de códigos (ALT-2026-…)…");
  await prisma.request_code_seq.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, last_value: 0 },
  });

  if (credentials) {
    const result = await bootstrapAdmin(prisma, credentials);
    console.log(result === "created" ? "ADMIN_CREATED" : "ADMIN_ALREADY_PROVISIONED_PASSWORD_UNCHANGED");
  } else {
    console.log("→ SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD no definidas: se omite el super admin.");
  }

  console.log("✓ Seed completado.");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "";
    console.error(/^(?:ADMIN|SEED)_[A-Z_]+$/.test(message) ? message : "SEED_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await prisma?.$disconnect(); } catch { console.error("SEED_DISCONNECT_FAILED"); process.exitCode = 1; }
  });
