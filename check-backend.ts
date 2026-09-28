// Script de verificación de TypeScript para backend
import { execSync } from 'child_process';

console.log('=== Verificando TypeScript en backend ===\n');

try {
  // Verificar server/
  console.log('1. Verificando server/...');
  execSync('npx tsc --noEmit --project server/tsconfig.json', { stdio: 'inherit' });
  console.log('✓ server/ OK\n');
} catch (error) {
  console.error('✗ Errores en server/');
  process.exit(1);
}

try {
  // Verificar api/
  console.log('2. Verificando api/...');
  execSync('npx tsc --noEmit --project api/tsconfig.json', { stdio: 'inherit' });
  console.log('✓ api/ OK\n');
} catch (error) {
  console.error('✗ Errores en api/');
  process.exit(1);
}

console.log('=== Todas las verificaciones pasaron ===');
