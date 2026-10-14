import { matrixToRects } from './pixels.ts';

/**
 * Texturas de la mesa en pixel, para usar como fondo repetido (`--felt-image` y `--rail-image`): el paño verde con
 * trama de sarga y pelusa, y el riel de madera con tablas, vetas y un nudo. Ambas se repiten sin cortes visibles.
 */
export const FELT_TILE = 32;
export const RAIL_W = 48;
export const RAIL_H = 16;

export const TABLE_PALETTE: Record<string, string> = {
  f: '#14573d', // paño
  F: '#186347', // trama del paño
  h: '#1d7151', // pelusa clara
  e: '#0f4a33', // pelusa oscura
  w: '#8a5a32', // madera
  W: '#a46d3d', // veta clara
  x: '#73462a', // veta oscura
  X: '#c08a52', // canto de la tabla, con la luz
  j: '#4a2a17', // junta entre tablas
};

/** Ruido determinista en [0, 1): siempre el mismo dibujo, sin Math.random. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildFelt(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < FELT_TILE; y++) {
    let row = '';
    for (let x = 0; x < FELT_TILE; x++) {
      const n = hash(x, y, 1);
      // la sarga son diagonales cada 4 píxeles, cortadas al azar para que no parezca una regla
      if (n < 0.05) row += 'e';
      else if (n > 0.97) row += 'h';
      else if ((x + y) % 4 === 0 && hash(x, y, 2) < 0.7) row += 'F';
      else row += 'f';
    }
    rows.push(row);
  }
  return rows;
}

/** Nudo de la madera: anillos oscuros alrededor de un centro claro, en la primera tabla. */
const KNOT = { x: 33, y: 4, rx: 3.2, ry: 1.6 };

function buildRail(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < RAIL_H; y++) {
    let row = '';
    const plank = Math.floor(y / 8);
    const py = y % 8;
    for (let x = 0; x < RAIL_W; x++) {
      // las dos tablas tienen la junta corrida, como un piso de madera
      const seamX = plank === 0 ? 0 : RAIL_W / 2;
      if (py === 7 || x === seamX) {
        row += 'j';
        continue;
      }
      if (py === 0) {
        row += 'X';
        continue;
      }
      const kx = (x - KNOT.x) / KNOT.rx;
      const ky = (y - KNOT.y) / KNOT.ry;
      const k = Math.hypot(kx, ky);
      if (plank === 0 && k < 1.6) {
        row += k < 0.5 ? 'W' : k < 1.1 ? 'x' : 'w';
        continue;
      }
      // vetas: trazos horizontales largos (el ruido se toma por tramos de 7 píxeles corridos según la fila)
      const g = hash(Math.floor((x + py * 5) / 7), y, 3);
      if (g < 0.28) row += 'x';
      else if (g > 0.8) row += 'W';
      else row += 'w';
    }
    rows.push(row);
  }
  return rows;
}

function toSvg(matrix: string[], w: number, h: number): string {
  const rects = matrixToRects(matrix, TABLE_PALETTE)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`
  );
}

const toUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

let feltCache: string[] | null = null;
let railCache: string[] | null = null;
let feltUrl: string | null = null;
let railUrl: string | null = null;

export function feltMatrix(): string[] {
  if (!feltCache) feltCache = buildFelt();
  return feltCache;
}

export function railMatrix(): string[] {
  if (!railCache) railCache = buildRail();
  return railCache;
}

/** Para `--felt-image`: repetir con `background-size` múltiplo de 32 px e `image-rendering: pixelated`. */
export function feltDataUrl(): string {
  if (!feltUrl) feltUrl = toUrl(toSvg(feltMatrix(), FELT_TILE, FELT_TILE));
  return feltUrl;
}

/** Para `--rail-image`: tablas horizontales de 48x16, repetir con `background-size` múltiplo de esa medida. */
export function railDataUrl(): string {
  if (!railUrl) railUrl = toUrl(toSvg(railMatrix(), RAIL_W, RAIL_H));
  return railUrl;
}
