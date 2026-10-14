import type { Mood } from '../table/types';
import { matrixToRects } from './pixels.ts';
import type { PixelRect } from './pixels.ts';

/**
 * Fosfo, gaucho argentino: chambergo negro de ala ancha, bigote grueso, pañuelo celeste, poncho rojo con guarda
 * amarilla y un mate con bombilla en la mano. Arte original, dibujado a mano en una grilla de 24x24.
 */
export const MASCOT_SIZE = 24;

export const MASCOT_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  n: '#3d3357', // chambergo
  m: '#6a5d8f', // brillo del chambergo
  b: '#e0453a', // cinta del sombrero
  s: '#e9a971', // piel
  S: '#bf7a4b', // piel en sombra
  w: '#fff6e0', // blanco
  q: '#3a2216', // bigote y cejas
  c: '#74c0ff', // pañuelo
  C: '#3f8fd6', // pañuelo en sombra
  p: '#c23a2f', // poncho
  P: '#7d1e1a', // poncho en sombra
  y: '#f2b134', // guarda del poncho
  v: '#8a5a32', // calabaza del mate
  l: '#cfd3dc', // bombilla y virola
  j: '#5ca03e', // yerba
  r: '#e0453a', // rojo (mejillas, lengua)
  z: '#7ed6ff', // lágrima / sudor
  Y: '#ffd23f', // destello
  g: '#8a86a0', // nube
};

/** Fila de cara: 10 columnas (x = 7..16) entre los contornos de las mejillas. */
const cheek = (inner: string): string => `......k${inner}k......`;
/** Filas del bigote: el bigote sobresale 2 columnas a cada lado. */
const stache = (inner: string): string => `.....qq${inner}qq.....`;

interface Face {
  brows: string;
  eyesTop: string;
  eyesBottom: string;
  nose: string;
  mustache: string;
  mouth: string;
  chin: string;
}

const FACES: Record<Mood, Face> = {
  neutral: {
    brows: 'sqqssssqqs',
    eyesTop: 'skksssskks',
    eyesBottom: 'skksssskks',
    nose: 'ssssSSssss',
    mustache: 'qqqqqqqqqq',
    mouth: 'ssskkkksss',
    chin: 'ssssssssss',
  },
  // pícaro: ceja derecha ladeada, mira de costado y sonrisa de un solo lado
  farol: {
    brows: 'sqqsssqqqs',
    eyesTop: 'skksssskks',
    eyesBottom: 'swksssswks',
    nose: 'ssssSSssss',
    mustache: 'qqqqqqqqqq',
    mouth: 'sssskkkkks',
    chin: 'ssssssssss',
  },
  // descubierto: ojos enormes, boca abierta
  descubierto: {
    brows: 'swwwsswwws',
    eyesTop: 'swkwsswkws',
    eyesBottom: 'swwwsswwws',
    nose: 'ssssSSssss',
    mustache: 'qqqqqqqqqq',
    mouth: 'ssskkkksss',
    chin: 'ssskrrksss',
  },
  // gana: ojos cerrados contentos, cachetes rojos y sonrisa grande
  gana: {
    brows: 'sqqssssqqs',
    eyesTop: 'skksssskks',
    eyesBottom: 'kssksskssk',
    nose: 'rsssSSsssr',
    mustache: 'qqqqqqqqqq',
    mouth: 'sskkkkkkss',
    chin: 'ssskwwksss',
  },
  // pierde: cejas caídas, lágrimas y boca para abajo
  pierde: {
    brows: 'ssqqssqqss',
    eyesTop: 'skksssskks',
    eyesBottom: 'skksssskks',
    nose: 'szssSSsszs',
    mustache: 'qqqqqqqqqq',
    mouth: 'ssskkkksss',
    chin: 'sskssssk' + 'ss',
  },
};

interface Extra {
  x: number;
  y: number;
  ch: string;
}

const px = (ch: string, ...pts: [number, number][]): Extra[] => pts.map(([x, y]) => ({ x, y, ch }));

const EXTRAS: Record<Mood, Extra[]> = {
  neutral: [],
  // bigote derecho levantado
  farol: [
    ...px('.', [17, 15], [18, 15], [17, 16], [18, 16]),
    ...px('q', [17, 14], [18, 14], [18, 13]),
    ...px('q', [17, 15], [18, 15]),
  ],
  descubierto: px('z', [4, 11], [3, 12], [4, 12], [5, 12], [4, 13]),
  gana: [
    ...px('Y', [20, 2], [19, 3], [20, 3], [21, 3], [20, 4]),
    ...px('Y', [3, 4], [2, 5], [3, 5], [4, 5], [3, 6]),
  ],
  pierde: [
    ...px('g', [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0]),
    ...px('g', [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1]),
  ],
};

/** Mate en la mano derecha del gaucho (a la derecha de quien mira), con la bombilla subiendo junto a la cara. */
const MATE: Extra[] = [
  ...px('l', [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17]),
  ...px('l', [17, 18], [21, 18]),
  ...px('j', [18, 18], [20, 18]),
  ...px('k', [17, 19], [21, 19], [17, 20], [21, 20], [18, 21], [19, 21], [20, 21]),
  ...px('v', [18, 19], [19, 19], [20, 19], [18, 20], [19, 20], [20, 20]),
  ...px('s', [16, 19], [16, 20], [22, 19], [22, 20]),
];

export function mascotMatrix(mood: Mood): string[] {
  const f = FACES[mood];
  const rows: string[] = [
    '.'.repeat(24),
    '.'.repeat(24),
    '.......kkkkkkkkkk.......', // chambergo: copa
    '......knnnnnnnnnnk......',
    '......knmmnnnnnnnk......',
    '......knnnnnnnnnnk......',
    '......knnnnnnnnnnk......',
    '......kbbbbbbbbbbk......', // cinta
    '..kkkkkkkkkkkkkkkkkkkk..', // ala
    '.knnnnnnnnnnnnnnnnnnnnk.',
    '..kkkkkSSSSSSSSSSkkkkk..', // sombra del ala sobre la cara
    cheek(f.brows),
    cheek(f.eyesTop),
    cheek(f.eyesBottom),
    cheek(f.nose),
    stache(f.mustache),
    stache(f.mouth),
    cheek(f.chin),
    '....kpcccccccccccc' + 'pk....', // pañuelo al cuello
    '..kppppcccccccccc' + 'ppppk..',
    '..kpppppcccccccc' + 'pppppk..',
    '..kpppppppCCCCppppppp' + 'k..',
    '..kyPyPyPyPyPyPyPyPyPk..', // guarda del poncho
    '..kPkPkPkPkPkPkPkPkPkP..', // flecos
  ];
  const grid = rows.map((r) => r.split(''));
  for (const e of [...MATE, ...EXTRAS[mood]]) grid[e.y]![e.x] = e.ch;
  return grid.map((r) => r.join(''));
}

export function mascotRects(mood: Mood): PixelRect[] {
  return matrixToRects(mascotMatrix(mood), MASCOT_PALETTE);
}
