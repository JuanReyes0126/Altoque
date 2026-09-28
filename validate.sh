#!/bin/bash

echo "=== VALIDACIÓN DE ALTOQUE ==="
echo ""

echo "1. Verificando estado de migraciones..."
npx prisma migrate status
echo ""

echo "2. Ejecutando typecheck..."
npm run typecheck
echo ""

echo "3. Ejecutando build..."
npm run build
echo ""

echo "4. Verificando git diff..."
git diff --check
echo ""

echo "5. Ejecutando tests..."
npx vitest run server/tests/
echo ""

echo "=== VALIDACIÓN COMPLETADA ==="
