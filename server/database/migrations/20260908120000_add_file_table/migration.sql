-- ════════════════════════════════════════════════════════════════
-- ALTOQUE · Migración: Añadir tabla file
--
-- Contexto: El modelo `file` fue añadido a schema.prisma en F2
-- para soportar uploads de fotos de solicitudes. Esta migración
-- crea la tabla correspondiente en PostgreSQL.
--
-- Aplicación:
--   Ejecutar: npx prisma migrate deploy
--
-- NOTA: Esta migración NO debe aplicarse a Production sin revisión.
-- ════════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "file" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "blob_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "request_id" TEXT,
    "provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_owner_id_idx" ON "file"("owner_id");

-- CreateIndex
CREATE INDEX "file_request_id_idx" ON "file"("request_id");

-- CreateIndex
CREATE INDEX "file_provider_id_idx" ON "file"("provider_id");

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_owner_id_fkey" 
    FOREIGN KEY ("owner_id") REFERENCES "user"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
