// Genera public/favicon.svg: un Sol de Mayo de 16x16 dibujado para leerse a tamaño de pestaña (cara grande con su
// anillo marrón, 4 rayos rectos y 4 en diagonal), con los colores del dorso.
// Uso: node scripts/make-favicon.ts
import { writeFileSync } from 'node:fs';
import { CARD_BACK_PALETTE } from '../src/art/cardBack.ts';
import { matrixToRects } from '../src/art/pixels.ts';

const N = 16;
const C = 7.5;
const g = Array.from({ length: N }, () => Array<string>(N).fill('.'));
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const dx = x - C;
    const dy = y - C;
    const r = Math.hypot(dx, dy);
    if (r <= 4.7) g[y]![x] = r > 3.7 ? 'd' : x + y < 13 ? 'A' : 'a';
    else if ((Math.abs(dx) < 1 || Math.abs(dy) < 1) && r <= 7.6) g[y]![x] = 'a'; // rayos rectos de 2 px
    else if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.1 && r <= 7.2) g[y]![x] = 'o'; // rayos en diagonal
  }
}
// cara: ojos y sonrisa
for (const [x, y] of [[6, 6], [9, 6], [5, 9], [10, 9], [6, 10], [7, 10], [8, 10], [9, 10]] as const) g[y]![x] = 'd';

const rects = matrixToRects(g.map((row) => row.join('')), CARD_BACK_PALETTE)
  .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${N + 2} ${N + 2}" shape-rendering="crispEdges">${rects}</svg>\n`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log('favicon.svg', svg.length, 'bytes');
