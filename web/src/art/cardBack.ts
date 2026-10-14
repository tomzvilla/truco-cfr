import { matrixToRects } from './pixels.ts';

export const CARD_W = 73;
export const CARD_H = 113;

/**
 * Dorso: las tres franjas de la bandera (celeste, blanca, celeste) con el Sol de Mayo en el medio, dibujado pixel a
 * pixel: cara con rasgos, 16 rayos alternados (rectos y flamígeros) y contorno marrón como el sol de la bandera.
 */
export const CARD_BACK_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno de la carta
  c: '#f2e6c9', // marco crema
  C: '#74acdf', // celeste de la bandera
  L: '#93c1ea', // trama sobre el celeste
  D: '#5a92c8', // celeste en sombra (borde interior de las franjas)
  W: '#fbf7ee', // franja blanca
  V: '#e6eef6', // trama sobre el blanco
  a: '#f6b40e', // oro del sol
  A: '#ffd85c', // brillo del sol
  o: '#df8a10', // oro en sombra (rayos flamígeros, mejillas, nariz)
  d: '#85340a', // marrón del sol: contorno y rasgos
};

/** Centro del sol, en coordenadas de centro de píxel (el píxel 36 es la columna del medio). */
const CX = 36.5;
const CY = 56.5;
/** Radio de la cara (incluye su anillo marrón). */
const FACE_R = 10.6;
const STRAIGHT_LEN = 25;
const WAVY_LEN = 21;
const RAYS = 16;

type Part = 'none' | 'face' | 'straight' | 'wavy';

/** Qué parte del sol ocupa el píxel (x, y), sin contornos. */
function sunPart(x: number, y: number): Part {
  const dx = x + 0.5 - CX;
  const dy = y + 0.5 - CY;
  const r = Math.hypot(dx, dy);
  if (r <= FACE_R) return 'face';
  if (r > STRAIGHT_LEN + 0.5) return 'none';
  const theta = Math.atan2(dy, dx);
  for (let k = 0; k < RAYS; k++) {
    // el rayo 0 apunta derecho hacia arriba; pares rectos, impares flamígeros
    const axis = -Math.PI / 2 + (k * 2 * Math.PI) / RAYS;
    let delta = theta - axis;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    if (Math.abs(delta) > Math.PI / 3) continue;
    const along = r * Math.cos(delta);
    const perp = r * Math.sin(delta);
    const straight = k % 2 === 0;
    const len = straight ? STRAIGHT_LEN : WAVY_LEN;
    if (along < FACE_R - 1 || along > len) continue;
    const t = (along - FACE_R) / (len - FACE_R);
    if (straight) {
      const half = 2.3 - 1.7 * Math.max(0, t);
      if (Math.abs(perp) <= half) return 'straight';
    } else {
      const wave = 1.3 * Math.sin((along - FACE_R) * 0.75);
      const half = 1.9 - 1.0 * Math.max(0, t);
      if (Math.abs(perp - wave) <= half) return 'wavy';
    }
  }
  return 'none';
}

/** Rasgos de la cara, relativos al píxel central (36, 56): cejas, ojos, nariz, mejillas y boca. */
const FEATURES: Array<[number, number, string]> = [
  // cejas arqueadas
  [-6, -4, 'd'], [-5, -5, 'd'], [-4, -5, 'd'], [-3, -5, 'd'], [-2, -4, 'd'],
  [6, -4, 'd'], [5, -5, 'd'], [4, -5, 'd'], [3, -5, 'd'], [2, -4, 'd'],
  // ojos: párpado, iris y brillo
  [-5, -3, 'd'], [-4, -3, 'd'], [-3, -3, 'd'],
  [-5, -2, 'W'], [-4, -2, 'd'], [-3, -2, 'W'],
  [5, -3, 'd'], [4, -3, 'd'], [3, -3, 'd'],
  [5, -2, 'W'], [4, -2, 'd'], [3, -2, 'W'],
  // nariz larga con sombra y aletas
  [0, -3, 'o'], [0, -2, 'o'], [0, -1, 'o'], [1, 0, 'o'], [0, 1, 'd'], [-1, 1, 'd'], [1, 1, 'd'],
  // mejillas
  [-6, 1, 'o'], [-5, 1, 'o'], [6, 1, 'o'], [5, 1, 'o'],
  // boca serena: labio superior, comisuras y labio inferior
  [-2, 4, 'd'], [-1, 4, 'd'], [0, 4, 'd'], [1, 4, 'd'], [2, 4, 'd'],
  [-3, 3, 'd'], [3, 3, 'd'],
  [-1, 5, 'o'], [0, 5, 'o'], [1, 5, 'o'],
];

/** Sol chiquito (7x7) para las esquinas de las franjas celestes. */
const MINI_SUN = ['...a...', '.a.a.a.', '..aAa..', 'aaAAAaa', '..aAa..', '.a.a.a.', '...a...'];
const MINI_SUNS: Array<[number, number]> = [[9, 9], [57, 9], [9, 97], [57, 97]];

function background(x: number, y: number): string {
  const edge = Math.min(x, y, CARD_W - 1 - x, CARD_H - 1 - y);
  if (edge === 0) return 'k';
  if (edge <= 3) return 'c';
  if (edge === 4) return 'k';
  for (const [sx, sy] of MINI_SUNS) {
    const ch = MINI_SUN[y - sy]?.[x - sx];
    if (ch && ch !== '.') return ch;
  }
  // franjas: celeste arriba (5..39), blanca (40..72), celeste abajo (73..107)
  if (y >= 40 && y <= 72) return (x + y) % 6 === 0 || (x - y + 600) % 6 === 0 ? 'V' : 'W';
  if (y === 39 || y === 73) return 'D';
  return (x + y) % 6 === 0 || (x - y + 600) % 6 === 0 ? 'L' : 'C';
}

function buildMatrix(): string[] {
  const parts: Part[][] = [];
  for (let y = 0; y < CARD_H; y++) {
    const row: Part[] = [];
    for (let x = 0; x < CARD_W; x++) row.push(sunPart(x, y));
    parts.push(row);
  }
  const at = (x: number, y: number): Part => parts[y]?.[x] ?? 'none';
  const rows: string[][] = [];
  for (let y = 0; y < CARD_H; y++) {
    const row: string[] = [];
    for (let x = 0; x < CARD_W; x++) {
      const p = at(x, y);
      if (p === 'none') {
        row.push(background(x, y));
        continue;
      }
      const touchesOutside = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('none');
      if (touchesOutside) {
        row.push('d');
        continue;
      }
      if (p === 'face') {
        const r = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
        if (r > FACE_R - 1.1) row.push('d'); // anillo que separa la cara de los rayos
        else if (x - 36 + (y - 56) < -9) row.push('A'); // brillo arriba a la izquierda
        else row.push('a');
        continue;
      }
      if (p === 'straight') {
        // filo de luz sobre el eje de cada rayo recto
        const dx = x + 0.5 - CX;
        const dy = y + 0.5 - CY;
        const k = Math.round(((Math.atan2(dy, dx) + Math.PI / 2) * RAYS) / (2 * Math.PI));
        const axis = -Math.PI / 2 + (k * 2 * Math.PI) / RAYS;
        const perp = Math.hypot(dx, dy) * Math.sin(Math.atan2(dy, dx) - axis);
        row.push(Math.abs(perp) < 0.5 ? 'A' : 'a');
        continue;
      }
      row.push('o');
    }
    rows.push(row);
  }
  for (const [fx, fy, ch] of FEATURES) rows[56 + fy]![36 + fx] = ch;
  return rows.map((r) => r.join(''));
}

// Todo se calcula una sola vez por módulo: el SVG tiene miles de rects y la
// data URL cientos de KB, así que no se puede reconstruir en cada render.
let matrixCache: string[] | null = null;
let svgCache: string | null = null;
let urlCache: string | null = null;

export function cardBackMatrix(): string[] {
  if (!matrixCache) matrixCache = buildMatrix();
  return matrixCache;
}

export function cardBackSvg(): string {
  if (svgCache) return svgCache;
  const rects = matrixToRects(cardBackMatrix(), CARD_BACK_PALETTE)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  svgCache =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" ` +
    `width="${CARD_W}" height="${CARD_H}" shape-rendering="crispEdges">${rects}</svg>`;
  return svgCache;
}

export function cardBackDataUrl(): string {
  if (urlCache) return urlCache;
  urlCache = `data:image/svg+xml;utf8,${encodeURIComponent(cardBackSvg())}`;
  return urlCache;
}
