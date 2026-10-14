import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NATIVE_H, NATIVE_W, formatProblems, planImport, pngSize } from './cards-lib.ts';
import { sourceNamer } from './cards-map.ts';

const ZIP = 'art-src/jcanabal-spanish-deck.zip';
const OUT = 'public/cards/jcanabal';

/** Error esperable (falta el zip, falta una carta...): se muestra el mensaje sin stack. */
class UserError extends Error {}

function run(): void {
  if (!existsSync(ZIP)) {
    throw new UserError(`No encuentro ${ZIP}. Bajá el zip gratis de https://jcanabal.itch.io/spanish-deck-pixel-art y dejalo en esa ruta.`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'jcanabal-'));
  try {
    try {
      execFileSync('unzip', ['-q', '-o', ZIP, '-d', dir]);
    } catch {
      throw new UserError('Falló `unzip`. ¿Está instalado? Probá: sudo apt install -y unzip');
    }
    // lstat (no stat): los enlaces simbólicos del zip no cuentan como archivos y nunca se siguen
    const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => lstatSync(join(dir, f)).isFile());

    if (process.argv.includes('--list')) {
      for (const f of [...files].sort()) {
        const size = f.toLowerCase().endsWith('.png') ? pngSize(readFileSync(join(dir, f))) : null;
        console.log(`${f}${size ? `   ${size.w}x${size.h}` : ''}`);
      }
      console.log(`\n${files.length} archivos en el zip`);
      return;
    }

    const plan = planImport(files, sourceNamer);
    const problems = formatProblems(plan);
    if (problems.length > 0) throw new UserError(problems.join('\n'));

    mkdirSync(OUT, { recursive: true });
    for (const { from, to } of plan.copies) {
      const size = pngSize(readFileSync(join(dir, from)));
      if (!size || size.w !== NATIVE_W || size.h !== NATIVE_H) {
        throw new UserError(`${from} mide ${size ? `${size.w}x${size.h}` : 'algo que no es un PNG'}; esperaba ${NATIVE_W}x${NATIVE_H} (¿bajaste la edición gratuita?).`);
      }
      copyFileSync(join(dir, from), join(OUT, to));
    }
    console.log(`OK: ${plan.copies.length} cartas copiadas a ${OUT}`);
  } finally {
    rmSync(dir, { recursive: true, force: true }); // también si algo explota
  }
}

try {
  run();
} catch (e) {
  if (e instanceof UserError) {
    console.error(`\nERROR: ${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
