import { CARD_NUMBERS, SUITS } from '../src/table/types.ts';
import type { CardNumber, Suit } from '../src/table/types.ts';
import { CARD_H, CARD_W } from '../src/art/cardBack.ts';

export const NATIVE_W = CARD_W;
export const NATIVE_H = CARD_H;

export type SourceNamer = (suit: Suit, number: CardNumber) => string;

export interface ImportPlan {
  copies: { from: string; to: string }[];
  missing: string[];
  ambiguous: string[];
}

export const destName = (suit: Suit, number: CardNumber): string => `${suit}-${number}.png`;

export const normalize = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '');

/** Busca, para cada una de las 40 cartas, el archivo del zip que le corresponde (por sufijo de ruta, sin distinguir mayúsculas). */
export function planImport(files: string[], namer: SourceNamer): ImportPlan {
  const norm = files.map((raw) => ({ raw, key: normalize(raw).toLowerCase() }));
  const plan: ImportPlan = { copies: [], missing: [], ambiguous: [] };
  for (const suit of SUITS) {
    for (const number of CARD_NUMBERS) {
      const expected = namer(suit, number);
      const wanted = normalize(expected).toLowerCase();
      const hits = norm.filter((f) => f.key === wanted || f.key.endsWith('/' + wanted));
      const to = destName(suit, number);
      if (hits.length === 0) plan.missing.push(`${to} (esperaba "${expected}")`);
      else if (hits.length > 1) plan.ambiguous.push(`${to}: ${hits.map((h) => h.raw).join(', ')}`);
      else plan.copies.push({ from: hits[0]!.raw, to });
    }
  }
  return plan;
}

export function formatProblems(plan: ImportPlan): string[] {
  const lines: string[] = [];
  if (plan.missing.length > 0) {
    lines.push(`Faltan ${plan.missing.length} de las 40 cartas:`);
    for (const m of plan.missing) lines.push(`  - ${m}`);
    lines.push('Corré `npm run cards:list`, mirá cómo se llaman los archivos y corregí scripts/cards-map.ts.');
  }
  if (plan.ambiguous.length > 0) {
    lines.push(`Hay ${plan.ambiguous.length} cartas con más de un archivo posible:`);
    for (const a of plan.ambiguous) lines.push(`  - ${a}`);
    lines.push('Hacé el patrón de scripts/cards-map.ts más específico (incluí la carpeta).');
  }
  return lines;
}

export function pngSize(buf: Uint8Array): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}
