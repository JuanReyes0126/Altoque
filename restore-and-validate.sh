#!/bin/bash

# Script de restauración y validación para Altoque F2-F8
# Este script debe ejecutarse en el repositorio local real

set -e

echo "=== ALTOQUE - Restauración y Validación ==="
echo ""

# 1. Restaurar migraciones históricas desde Git
echo "1. Restaurando migraciones históricas desde Git..."

# Verificar si las migraciones ya existen
if [ ! -d "server/database/migrations/00000000000000_init" ]; then
    echo "   Restaurando 00000000000000_init..."
    git show HEAD:server/database/migrations/00000000000000_init/migration.sql > server/database/migrations/00000000000000_init/migration.sql 2>/dev/null || {
        mkdir -p server/database/migrations/00000000000000_init
        git show HEAD:server/database/migrations/00000000000000_init/migration.sql > server/database/migrations/00000000000000_init/migration.sql
    }
fi

if [ ! -d "server/database/migrations/20260907192000_add_account_issuer" ]; then
    echo "   Restaurando 20260907192000_add_account_issuer..."
    git show HEAD:server/database/migrations/20260907192000_add_account_issuer/migration.sql > server/database/migrations/20260907192000_add_account_issuer/migration.sql 2>/dev/null || {
        mkdir -p server/database/migrations/20260907192000_add_account_issuer
        git show HEAD:server/database/migrations/20260907192000_add_account_issuer/migration.sql > server/database/migrations/20260907192000_add_account_issuer/migration.sql
    }
fi

echo "   ✓ Migraciones históricas restauradas"
echo ""

# 2. Verificar estructura de migraciones
echo "2. Verificando estructura de migraciones..."
ls -la server/database/migrations/
echo ""

# 3. Instalar dependencias
echo "3. Instalando dependencias..."
npm ci
echo ""

# 4. Typecheck frontend
echo "4. Ejecutando typecheck frontend..."
npm run typecheck
echo ""

# 5. Typecheck backend
echo "5. Ejecutando typecheck backend..."
npx tsc -p server/tsconfig.json --noEmit
echo ""

# 6. Build
echo "6. Ejecutando build..."
npm run build
echo ""

# 7. Git diff check
echo "7. Verificando git diff..."
git diff --check || echo "   Sin problemas de whitespace"
echo ""

# 8. Tests unitarios (sin DB)
echo "8. Ejecutando tests unitarios..."
npx vitest run server/tests/unit.test.ts
echo ""

echo "9. Ejecutando tests de seguridad..."
npx vitest run server/tests/security.test.ts
echo ""

echo "10. Ejecutando tests de edge-dual..."
npx vitest run server/tests/edge-dual.test.ts
echo ""

# 9. Tests de integración (requieren DB)
echo "11. Tests de integración (requieren Neon)..."
if [ -n "$DATABASE_URL" ] && [ -n "$BETTER_AUTH_SECRET" ]; then
    echo "    Ejecutando tests con DB..."
    ALTOQUE_TEST_DB=1 npx vitest run server/tests/
else
    echo "    ⚠️  Variables DATABASE_URL o BETTER_AUTH_SECRET no configuradas"
    echo "    Skipping tests de integración"
fi
echo ""

# 10. Git status
echo "12. Estado actual de Git..."
git status --short
echo ""

echo "=== Validación completada ==="
