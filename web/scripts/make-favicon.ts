// Genera public/favicon.svg: la cara de Fosfo (chambergo, ojos y bigote) recortada de la mascota neutral.
// Uso: node scripts/make-favicon.ts
import { writeFileSync } from 'node:fs';
import { mascotRects } from '../src/art/mascot.ts';

const X0 = 2;
const Y0 = 2;
const W = 20;
const H = 16; // filas 2..17: de la copa del sombrero al mentón
const rects = mascotRects('neutral')
  .filter((r) => r.y >= Y0 && r.y < Y0 + H)
  .map((r) => `<rect x="${r.x - X0}" y="${r.y - Y0}" width="${r.w}" height="1" fill="${r.fill}"/>`)
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects}</svg>\n`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log('favicon.svg', svg.length, 'bytes');
