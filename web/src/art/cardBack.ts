import { matrixToRects } from './pixels.ts';

export const CARD_W = 73;
export const CARD_H = 113;

export const CARD_BACK_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  c: '#f2e6c9', // marco crema
  f: '#3b1e6e', // campo violeta
  l: '#5b34a8', // rombos
  a: '#f2b134', // medallón
  d: '#c47a1c', // borde del medallón (sombra)
  w: '#fff6e0', // ojos
  n: '#3d3357', // chambergo
  m: '#6a5d8f', // brillo del chambergo
  b: '#e0453a', // cinta del chambergo
  q: '#3a2216', // bigote
};

function pixelAt(x: number, y: number): string {
  const edge = Math.min(x, y, CARD_W - 1 - x, CARD_H - 1 - y);
  if (edge === 0) return 'k';
  if (edge <= 3) return 'c';
  if (edge === 4) return 'k';

  // ojos de la mascota (cajas de 5x5 con pupila de 2x2)
  const inEye = (x0: number) => x >= x0 && x < x0 + 5 && y >= 49 && y < 54;
  const inPupil = (x0: number) => x >= x0 + 1 && x < x0 + 3 && y >= 51 && y < 53;

  // chambergo de ala ancha sobre el medallón
  if (y >= 42 && y <= 44 && x >= 20 && x <= 52) return y === 43 && x > 20 && x < 52 ? 'n' : 'k';
  if (y >= 33 && y <= 41 && x >= 29 && x <= 43) {
    if (y === 33 || x === 29 || x === 43) return 'k';
    if (y >= 40) return 'b';
    return y >= 35 && y <= 36 && x >= 31 && x <= 33 ? 'm' : 'n';
  }
  // bigote grueso con las puntas caídas
  const inStache = (y === 60 || y === 61 ? x >= 28 && x <= 44 : (y === 62 || y === 63) && (x <= 30 || x >= 42) && x >= 27 && x <= 45);

  const dx = (x - 36) / 17;
  const dy = (y - 56) / 25;
  const e = dx * dx + dy * dy;
  if (e <= 1.0) {
    if (e > 0.82) return 'k'; // anillo
    if (inPupil(28) || inPupil(40)) return 'k';
    if (inEye(28) || inEye(40)) return 'w';
    if (inStache) return 'q';
    return e > 0.62 ? 'd' : 'a';
  }
  return (x + y) % 8 === 0 || (x - y + 1024) % 8 === 0 ? 'l' : 'f';
}

// Todo se calcula una sola vez por módulo: el SVG tiene miles de rects y la
// data URL cientos de KB, así que no se puede reconstruir en cada render.
let matrixCache: string[] | null = null;
let svgCache: string | null = null;
let urlCache: string | null = null;

export function cardBackMatrix(): string[] {
  if (matrixCache) return matrixCache;
  const rows: string[] = [];
  for (let y = 0; y < CARD_H; y++) {
    let row = '';
    for (let x = 0; x < CARD_W; x++) row += pixelAt(x, y);
    rows.push(row);
  }
  matrixCache = rows;
  return rows;
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
