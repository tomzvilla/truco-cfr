import type { Mood } from '../table/types';
import { matrixToRects } from './pixels.ts';
import type { PixelRect } from './pixels.ts';

/**
 * Fosfo, gaucho argentino: chambergo negro con hendidura y cinta roja, patillas, bigote grueso, pañuelo celeste
 * anudado, poncho rojo con guarda pampa escalonada y un mate con bombilla en la mano. Arte original, dibujado a mano
 * en una grilla de 32x32: primero el cuerpo, después su contorno automático, y encima el mate y la cara de cada estado.
 */
export const MASCOT_SIZE = 32;

export const MASCOT_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  n: '#3d3357', // chambergo
  N: '#2a2240', // chambergo en sombra
  m: '#6a5d8f', // brillo del chambergo
  b: '#e0453a', // cinta del sombrero
  B: '#a3271f', // cinta en sombra
  s: '#e9a971', // piel
  S: '#bf7a4b', // piel en sombra
  w: '#fff6e0', // blanco (ojos, dientes)
  q: '#3a2216', // bigote, cejas y patillas
  Q: '#6b4128', // brillo del bigote
  c: '#74c0ff', // pañuelo
  C: '#3f8fd6', // pañuelo en sombra (nudo)
  p: '#c23a2f', // poncho
  P: '#7d1e1a', // poncho en sombra y guarda
  y: '#f2b134', // guarda y flecos
  v: '#8a5a32', // calabaza del mate
  V: '#b57a45', // brillo de la calabaza
  l: '#cfd3dc', // bombilla y virola
  j: '#5ca03e', // yerba
  r: '#e0453a', // rojo (mejillas, lengua)
  z: '#7ed6ff', // lágrima / sudor
  Y: '#ffd23f', // destello
  g: '#8a86a0', // nube
  G: '#5f5b78', // nube en sombra
};

type Grid = string[][];

const blank = (): Grid => Array.from({ length: MASCOT_SIZE }, () => Array<string>(MASCOT_SIZE).fill('.'));

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y]![x] = ch;
}

function put(g: Grid, ch: string, ...pts: Array<[number, number]>): void {
  for (const [x, y] of pts) g[y]![x] = ch;
}

/** Contorno de 1 píxel alrededor de la silueta (solo sobre lo vacío). */
function outline(g: Grid): void {
  const filled = (x: number, y: number) => g[y]?.[x] !== undefined && g[y]![x] !== '.' && g[y]![x] !== '#';
  for (let y = 0; y < MASCOT_SIZE; y++) {
    for (let x = 0; x < MASCOT_SIZE; x++) {
      if (g[y]![x] !== '.') continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g[y]![x] = '#';
    }
  }
  for (const row of g) for (let x = 0; x < row.length; x++) if (row[x] === '#') row[x] = 'k';
}

/** Sombrero, cara base (sin ojos ni boca), pañuelo y poncho. */
function body(g: Grid): void {
  // chambergo: copa con hendidura arriba, brillo a la izquierda y sombra a la derecha
  rect(g, 11, 3, 20, 6, 'n');
  put(g, '.', [11, 3], [20, 3]);
  put(g, 'N', [15, 3], [16, 3], [20, 4], [20, 5], [20, 6], [19, 5], [19, 6]);
  put(g, 'm', [12, 4], [13, 4], [12, 5]);
  rect(g, 11, 7, 20, 7, 'b');
  rect(g, 11, 8, 20, 8, 'B');
  // ala ancha y plana: arriba con brillo, abajo en sombra
  rect(g, 4, 9, 27, 9, 'n');
  rect(g, 5, 10, 26, 10, 'N');
  rect(g, 6, 9, 10, 9, 'm');

  // cara
  rect(g, 10, 11, 21, 19, 's');
  rect(g, 10, 11, 21, 11, 'S'); // sombra del ala
  put(g, 'S', [21, 17], [21, 18], [21, 19], [20, 19]);
  put(g, '.', [10, 19]);
  rect(g, 12, 20, 19, 20, 's');
  put(g, 'S', [19, 20]);
  // orejas y patillas
  put(g, 's', [9, 14], [9, 15]);
  put(g, 'S', [22, 14], [22, 15]);
  rect(g, 10, 12, 10, 16, 'q');
  rect(g, 21, 12, 21, 16, 'q');
  // nariz
  put(g, 'S', [16, 15], [16, 16], [15, 17], [16, 17]);

  // poncho (los hombros salen del cuello) con dos pliegues y el costado derecho en sombra
  rect(g, 7, 21, 24, 21, 'p');
  rect(g, 6, 22, 25, 22, 'p');
  rect(g, 5, 23, 26, 23, 'p');
  rect(g, 4, 24, 27, 30, 'p');
  rect(g, 9, 23, 9, 26, 'P');
  rect(g, 22, 23, 22, 26, 'P');
  rect(g, 26, 24, 27, 26, 'P');
  // guarda pampa: borde amarillo y escalones en rojo oscuro
  rect(g, 4, 27, 27, 27, 'y');
  for (let x = 4; x <= 27; x++) {
    g[28]![x] = x % 4 === 0 || x % 4 === 1 ? 'P' : 'y';
    g[29]![x] = x % 4 === 1 || x % 4 === 2 ? 'P' : 'y';
  }
  rect(g, 4, 30, 27, 30, 'y');
  // flecos
  for (let x = 5; x <= 26; x += 2) g[31]![x] = 'y';

  // pañuelo celeste anudado al cuello, con la punta colgando sobre el poncho
  rect(g, 11, 21, 20, 21, 'c');
  rect(g, 13, 22, 18, 22, 'c');
  rect(g, 14, 23, 17, 23, 'c');
  put(g, 'c', [15, 24], [16, 24]);
  put(g, 'C', [15, 21], [16, 21], [15, 22], [16, 22], [16, 23], [16, 24]);
}

/** Mate en la mano derecha (a la derecha de quien mira), con su propio contorno porque va sobre el poncho. */
function mate(g: Grid): void {
  // bombilla corta e inclinada, asomando de la yerba
  put(g, 'l', [28, 21], [29, 20], [30, 19]);
  put(g, 'k', [31, 18]);
  // calabaza con virola, yerba y brillo
  put(g, 'k', [25, 22], [26, 22], [27, 22], [29, 22]);
  put(g, 'l', [28, 22]);
  put(g, 'k', [24, 23], [30, 23]);
  put(g, 'l', [25, 23], [28, 23], [29, 23]);
  put(g, 'j', [26, 23]);
  put(g, 'l', [27, 23]);
  for (const y of [24, 25]) {
    put(g, 'k', [24, y], [30, y]);
    put(g, 'v', [25, y], [27, y], [28, y], [29, y]);
    put(g, 'V', [26, y]);
  }
  put(g, 'k', [25, 26], [29, 26]);
  put(g, 'v', [26, 26], [27, 26], [28, 26]);
  put(g, 'k', [26, 27], [27, 27], [28, 27]);
  // la mano que lo sostiene
  put(g, 's', [23, 24], [23, 25], [24, 26]);
  put(g, 'S', [23, 26]);
}

/** Cejas, ojos, bigote y boca de cada estado. */
function face(g: Grid, mood: Mood): void {
  const eyes = () => {
    put(g, 'w', [12, 14], [18, 14]);
    put(g, 'k', [13, 14], [12, 15], [13, 15], [19, 14], [18, 15], [19, 15]);
  };
  const mustache = (tips: 'abajo' | 'arriba' | 'pícaro') => {
    rect(g, 9, 18, 22, 18, 'q');
    put(g, 'Q', [11, 18], [12, 18], [19, 18], [20, 18]);
    if (tips === 'abajo') {
      put(g, 'q', [8, 19], [9, 19], [10, 19], [21, 19], [22, 19], [23, 19], [8, 20], [23, 20]);
    } else if (tips === 'arriba') {
      put(g, 'q', [8, 18], [23, 18], [8, 17], [23, 17], [7, 16], [24, 16]);
    } else {
      put(g, 'q', [8, 19], [9, 19], [10, 19], [8, 20], [23, 18], [23, 17], [24, 16]);
    }
  };
  switch (mood) {
    case 'neutral':
      rect(g, 12, 13, 14, 13, 'q');
      rect(g, 17, 13, 19, 13, 'q');
      eyes();
      mustache('abajo');
      rect(g, 14, 19, 17, 19, 'k');
      break;
    case 'farol':
      // guiño, ceja derecha levantada y media sonrisa con la punta del bigote para arriba
      rect(g, 12, 13, 14, 13, 'q');
      rect(g, 17, 12, 19, 12, 'q');
      put(g, 'k', [11, 15], [12, 15], [13, 15]);
      put(g, 'w', [18, 14]);
      put(g, 'k', [19, 14], [18, 15], [19, 15]);
      mustache('pícaro');
      put(g, 'k', [14, 19], [15, 19], [16, 19], [17, 19], [18, 19]);
      put(g, 'k', [19, 19]);
      break;
    case 'descubierto':
      // ojos redondos y enormes, cejas arriba, boca abierta y una gota de sudor
      rect(g, 11, 12, 13, 12, 'q');
      rect(g, 18, 12, 20, 12, 'q');
      rect(g, 11, 13, 13, 15, 'w');
      rect(g, 18, 13, 20, 15, 'w');
      put(g, 'k', [12, 14], [19, 14]);
      mustache('abajo');
      put(g, 'k', [14, 19], [17, 19], [15, 20], [16, 20]);
      put(g, 'r', [15, 19], [16, 19]);
      put(g, 'z', [25, 12], [24, 13], [25, 13], [26, 13], [25, 14]);
      break;
    case 'gana':
      // ojos cerrados de contento, cachetes rojos, sonrisa con dientes y destellos
      put(g, 'k', [12, 14], [11, 15], [13, 15], [19, 14], [18, 15], [20, 15]);
      put(g, 'r', [11, 16], [12, 16], [19, 16], [20, 16]);
      mustache('arriba');
      put(g, 'k', [13, 19], [18, 19], [14, 20], [15, 20], [16, 20], [17, 20]);
      put(g, 'w', [14, 19], [15, 19], [16, 19], [17, 19]);
      put(g, 'Y', [3, 4], [2, 5], [3, 5], [4, 5], [3, 6], [28, 3], [27, 4], [28, 4], [29, 4], [28, 5], [26, 1]);
      break;
    case 'pierde':
      // cejas tristes, lágrima, boca para abajo y una nube gris arriba
      put(g, 'q', [12, 13], [13, 13], [14, 12], [17, 12], [18, 13], [19, 13]);
      eyes();
      put(g, 'z', [12, 16], [12, 17]);
      mustache('abajo');
      put(g, 'k', [15, 19], [16, 19], [14, 20], [17, 20]);
      // nubarrón esponjoso arriba a la izquierda, con tres gotas
      rect(g, 3, 1, 5, 1, 'g');
      rect(g, 2, 2, 7, 2, 'g');
      rect(g, 1, 3, 8, 3, 'g');
      rect(g, 1, 4, 8, 4, 'G');
      put(g, 'z', [2, 6], [5, 6], [8, 6], [3, 7]);
      break;
  }
}

export function mascotMatrix(mood: Mood): string[] {
  const g = blank();
  body(g);
  outline(g);
  mate(g);
  face(g, mood);
  return g.map((r) => r.join(''));
}

export function mascotRects(mood: Mood): PixelRect[] {
  return matrixToRects(mascotMatrix(mood), MASCOT_PALETTE);
}
