import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NATIVE_H, NATIVE_W, formatProblems, planImport, pngSize } from './cards-lib.ts';
import { sourceNamer } from './cards-map.ts';

const ZIP = 'art-src/jcanabal-spanish-deck.zip';
const OUT = 'public/cards/jcanabal';

let tmp: string | undefined;

function fail(msg: string): never {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function main(): void {
  if (!existsSync(ZIP)) {
    fail(`No encuentro ${ZIP}. Bajá el zip gratis de https://jcanabal.itch.io/spanish-deck-pixel-art y dejalo en esa ruta.`);
  }
  tmp = mkdtempSync(join(tmpdir(), 'jcanabal-'));
  try {
    execFileSync('unzip', ['-q', '-o', ZIP, '-d', tmp]);
  } catch {
    fail('Falló `unzip`. ¿Está instalado? Probá: sudo apt install -y unzip');
  }
  const dir = tmp;
  const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile());

  if (process.argv.includes('--list')) {
    for (const f of [...files].sort()) {
      const size = f.toLowerCase().endsWith('.png') ? pngSize(readFileSync(join(dir, f))) : null;
      console.log(`${f}${size ? `   ${size.w}x${size.h}` : ''}`);
    }
    console.log(`\n${files.length} archivos en el zip`);
    rmSync(dir, { recursive: true, force: true });
    return;
  }

  const plan = planImport(files, sourceNamer);
  const problems = formatProblems(plan);
  if (problems.length > 0) fail(problems.join('\n'));

  mkdirSync(OUT, { recursive: true });
  for (const { from, to } of plan.copies) {
    const size = pngSize(readFileSync(join(dir, from)));
    if (!size || size.w !== NATIVE_W || size.h !== NATIVE_H) {
      fail(`${from} mide ${size ? `${size.w}x${size.h}` : 'algo que no es un PNG'}; esperaba ${NATIVE_W}x${NATIVE_H} (¿bajaste la edición gratuita?).`);
    }
    copyFileSync(join(dir, from), join(OUT, to));
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`OK: ${plan.copies.length} cartas copiadas a ${OUT}`);
}

main();
