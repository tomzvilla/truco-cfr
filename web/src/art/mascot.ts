import type { Mood } from '../table/types';
import { matrixToRects } from './pixels';
import type { PixelRect } from './pixels';

export const MASCOT_SIZE = 16;

export const MASCOT_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  b: '#f2b134', // cuerpo
  d: '#c47a1c', // sombra
  h: '#ffe08a', // brillo
  w: '#fff6e0', // blanco
  r: '#e0453a', // rojo
  c: '#38d6c8', // antena
  s: '#7ed6ff', // sudor / lágrima
  y: '#ffd23f', // destello
  g: '#8a86a0', // gris
};

const frame = (inner: string): string => `.k${inner}k.`;

/** Filas 5..10: 12 columnas de cara por estado. */
const FACES: Record<Mood, string[]> = {
  neutral: [
    'bbbbbbbbbbbb',
    'bwwwbbbbwwwb',
    'bwkwbbbbwkwb',
    'bbbbbbbbbbbb',
    'bbbbkkkkbbbb',
    'bbbbbbbbbbbb',
  ],
  farol: [
    'bkkkbbbbbkkb',
    'bwwwbbbbwwwb',
    'bwkwbbbbkkkb',
    'bbbbbbbbbbbb',
    'bkbbbbbbbbkb',
    'bbkkkkkkkkbb',
  ],
  descubierto: [
    'bwwwbbbbwwwb',
    'bwkwbbbbwkwb',
    'bwwwbbbbwwwb',
    'bbbbkkkkbbbb',
    'bbbbkrrkbbbb',
    'bbbbkkkkbbbb',
  ],
  gana: [
    'bbbbbbbbbbbb',
    'bbkbbbbbbkbb',
    'bkbkbbbbkbkb',
    'brrbbbbbbrrb',
    'bbkkkkkkkkbb',
    'bbbkrrrrkbbb',
  ],
  pierde: [
    'bbbbbbbbbbbb',
    'bkkkbbbbkkkb',
    'bbsbbbbbbbsb',
    'bbsbbbbbbbsb',
    'bbbbkkkkbbbb',
    'bbbkbbbbkbbb',
  ],
};

interface Extra {
  x: number;
  y: number;
  ch: string;
}

const EXTRAS: Record<Mood, Extra[]> = {
  neutral: [],
  farol: [],
  descubierto: [
    { x: 15, y: 3, ch: 's' },
    { x: 15, y: 4, ch: 's' },
    { x: 15, y: 5, ch: 's' },
  ],
  gana: [
    { x: 7, y: 0, ch: 'y' }, { x: 8, y: 0, ch: 'y' },
    { x: 1, y: 0, ch: 'y' },
    { x: 0, y: 1, ch: 'y' }, { x: 1, y: 1, ch: 'y' }, { x: 2, y: 1, ch: 'y' },
    { x: 1, y: 2, ch: 'y' },
  ],
  pierde: [
    { x: 7, y: 0, ch: 'g' }, { x: 8, y: 0, ch: 'g' },
  ],
};

export function mascotMatrix(mood: Mood): string[] {
  const rows: string[] = [
    '.......cc.......',
    '.......kk.......',
    '.......kk.......',
    `..${'k'.repeat(12)}..`,
    frame('bhhhbbbbbbbb'),
    ...FACES[mood].map(frame),
    frame('d'.repeat(12)),
    `..${'k'.repeat(12)}..`,
    '...kbk....kbk...',
    '...kkk....kkk...',
    '.'.repeat(16),
  ];
  const grid = rows.map((r) => r.split(''));
  for (const e of EXTRAS[mood]) grid[e.y]![e.x] = e.ch;
  return grid.map((r) => r.join(''));
}

export function mascotRects(mood: Mood): PixelRect[] {
  return matrixToRects(mascotMatrix(mood), MASCOT_PALETTE);
}
