/**
 * ALTOQUE · Endpoints de uploads (F2)
 *
 * Upload de fotos para solicitudes.
 * - requireAuth + requireVerifiedEmail
 * - Validación de archivos (tamaño, MIME, magic bytes)
 * - Almacenamiento en Vercel Blob (privado para fotos de solicitudes)
 */
import { Hono } from "hono";
import { prisma } from "../database/prisma.js";
import { requireAuth, requireVerifiedEmail, type AuthEnv } from "../middleware/auth.js";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";
import { validateFile, fileStore } from "../lib/files.js";
import { consume, LIMITS } from "../lib/ratelimit.js";

export const uploadRoutes = new Hono<AuthEnv>();

// ── POST /api/v1/uploads/request-photo ──
// Subir foto para solicitud
uploadRoutes.post("/request-photo", requireAuth, requireVerifiedEmail, async (c) => {
  const { user } = c.get("auth");

  // Rate limiting
  await consume(prisma, LIMITS.upload, user.id);

  // Parsear multipart/form-data
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw AppError.validation("Archivo requerido");
  }

  // Validar tamaño
  if (file.size > 5 * 1024 * 1024) {
    throw new AppError("FILE_TOO_LARGE", "Archivo demasiado grande (máx 5MB)", 413);
  }

  // Leer contenido para validación de magic bytes
  const buffer = Buffer.from(await file.arrayBuffer());
  const head = buffer.slice(0, 8);

  // Validar tipo de archivo
  const validated = validateFile("image", file.type, file.size, head);

  // Generar key único
  const key = `request-photos/${user.id}/${ulid()}${validated.ext}`;

  // Subir a Vercel Blob (privado)
  const store = fileStore();
  await store.putPrivate(key, buffer, validated.mime);

  // Crear registro en BD
  const photo = await prisma.file.create({
    data: {
      id: ulid(),
      owner_id: user.id,
      visibility: "private",
      blob_key: key,
      mime: validated.mime,
      size_bytes: validated.size,
      purpose: "request_photo",
    },
  });

  return c.json(ok({ id: photo.id, blob_key: key }), 201);
});
