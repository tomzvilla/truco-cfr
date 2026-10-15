// Falla si dist/ pesa 5 MB o más (presupuesto del spec).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 5 * 1024 * 1024;
const root = new URL('../dist/', import.meta.url).pathname;

function size(dir: string): number {
  return readdirSync(dir).reduce((sum, name) => {
    const p = join(dir, name);
    const s = statSync(p);
    return sum + (s.isDirectory() ? size(p) : s.size);
  }, 0);
}

const total = size(root);
console.log(`dist/: ${(total / 1024 / 1024).toFixed(2)} MB (límite 5 MB)`);
if (total >= LIMIT) process.exit(1);
