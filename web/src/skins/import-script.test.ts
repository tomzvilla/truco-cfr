import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Ejecuta el script de verdad con Node (que solo "borra" tipos y exige extensiones .ts en los imports),
// algo que vitest no detecta porque resuelve los imports por su cuenta.
describe('scripts/import-cards.ts se ejecuta con Node', () => {
  const script = resolve(__dirname, '../../scripts/import-cards.ts');
  const run = (...args: string[]) => {
    const cwd = mkdtempSync(join(tmpdir(), 'cards-smoke-')); // sin art-src/ adentro
    try {
      return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };

  it('--list sin el zip avisa amable (no un error de módulos)', () => {
    const r = run('--list');
    expect(r.stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|Cannot find module/);
    expect(r.stderr).toContain('No encuentro art-src/jcanabal-spanish-deck.zip');
    expect(r.status).toBe(1);
  });
  it('la importación sin el zip tampoco explota al cargar', () => {
    const r = run();
    expect(r.stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|Cannot find module/);
    expect(r.stderr).toContain('No encuentro art-src/jcanabal-spanish-deck.zip');
    expect(r.status).toBe(1);
  });
});
