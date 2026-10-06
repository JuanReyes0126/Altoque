/**
 * ALTOQUE · Validación de archivos (v1.1 §16 + Addendum §6)
 *
 * No se confía en la extensión: se validan tamaño, MIME declarado Y
 * magic bytes. Superficie mínima: jpeg / png / pdf (nada de .docx).
 *
 * Almacenamiento (Addendum §8):
 *   - PÚBLICO:  avatares, fotos de portfolio        → Blob store público
 *   - PRIVADO:  cédula, selfie, certificaciones,
 *               evidencias de disputa, fotos de
 *               solicitud                           → Blob store privado
 *     El acceso privado NUNCA es una URL pública permanente: se sirve
 *     vía GET /api/v1/files/:id tras sesión + requirePermission/ownership.
 */
import { AppError } from "./errors.js";

export type AllowedKind = "image" | "document";

const ALLOWED = {
  image: {
    "image/jpeg": { ext: ".jpg", magic: [0xff, 0xd8, 0xff], max: 5 * 1024 * 1024 },
    "image/png": { ext: ".png", magic: [0x89, 0x50, 0x4e, 0x47], max: 5 * 1024 * 1024 },
  },
  document: {
    "image/jpeg": { ext: ".jpg", magic: [0xff, 0xd8, 0xff], max: 10 * 1024 * 1024 },
    "image/png": { ext: ".png", magic: [0x89, 0x50, 0x4e, 0x47], max: 10 * 1024 * 1024 },
    "application/pdf": { ext: ".pdf", magic: [0x25, 0x50, 0x44, 0x46], max: 10 * 1024 * 1024 }, // %PDF
  },
} as const;

export interface ValidatedFile {
  mime: string;
  size: number;
  ext: string;
}

export function validateFile(kind: AllowedKind, declaredMime: string, size: number, head: Buffer): ValidatedFile {
  const table = ALLOWED[kind] as Record<string, { ext: string; magic: readonly number[]; max: number }>;
  const spec = table[declaredMime.toLowerCase()];
  if (!spec) {
    throw new AppError("FILE_TYPE_NOT_ALLOWED", "Tipo de archivo no permitido (solo JPG, PNG o PDF)", 415);
  }
  if (size > spec.max) {
    throw new AppError("FILE_TOO_LARGE", "Archivo demasiado grande", 413);
  }
  const okMagic = spec.magic.every((b, i) => head[i] === b);
  if (!okMagic) {
    // MIME declarado no coincide con el contenido real → posible archivo
    // renombrado. Se rechaza sin procesar más.
    throw new AppError("FILE_TYPE_NOT_ALLOWED", "El contenido no coincide con el tipo declarado", 415);
  }
  return { mime: declaredMime.toLowerCase(), size, ext: spec.ext };
}

/**
 * Interfaz del almacenamiento. La implementación concreta contra
 * Vercel Blob (put privado/público + URL firmadas de lectura) se
 * conecta en F2/F3 cuando existan los tokens BLOB_*; la interfaz ya
 * fija el contrato para que nada cambie aguas arriba.
 */
export interface FileStore {
  putPrivate(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  putPublic(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
  getPrivateSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}

export function fileStore(): FileStore {
  const token = (name: "BLOB_READ_WRITE_TOKEN" | "BLOB_PRIVATE_READ_WRITE_TOKEN") => {
    const configured = process.env[name];
    if (!configured) throw new AppError("INTERNAL_ERROR", "Almacenamiento no disponible", 503);
    return configured;
  };

  // Importar dinámicamente para evitar errores en entornos sin @vercel/blob
  let blobModule: any;
  const getBlob = async () => {
    if (!blobModule) {
      blobModule = await import("@vercel/blob");
    }
    return blobModule;
  };

  return {
    async putPrivate(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
      const privateToken = token("BLOB_PRIVATE_READ_WRITE_TOKEN");
      const blob = await getBlob();
      await blob.put(key, bytes, {
        access: "private",
        token: privateToken,
        contentType,
      });
    },

    async putPublic(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }> {
      const publicToken = token("BLOB_READ_WRITE_TOKEN");
      const blob = await getBlob();
      const result = await blob.put(key, bytes, {
        access: "public",
        token: publicToken,
        contentType,
      });
      return { url: result.url };
    },

    async getPrivateSignedUrl(_key: string, _ttlSeconds: number): Promise<string> {
      // @vercel/blob 2.8.0 no ofrece getSignedUrl. Se requiere un proxy de
      // lectura con autorización antes de habilitar documentos privados.
      throw new AppError("INTERNAL_ERROR", "La lectura de archivos privados todavía no está disponible", 503);
    },
  };
}
