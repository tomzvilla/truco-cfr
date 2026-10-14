export const MAX_POINTS = 30;
export const HALF = 15;
export const GROUP_SIZE = 5;
export const GROUPS_PER_HALF = 3;

export type GroupFill = 0 | 1 | 2 | 3 | 4 | 5;

export interface FosforitoBoard {
  points: number;
  malas: GroupFill[];
  buenas: GroupFill[];
}

/** Entero entre 0 y 30. NaN cuenta como 0. */
export function clampPoints(points: number): number {
  if (Number.isNaN(points)) return 0;
  return Math.max(0, Math.min(MAX_POINTS, Math.trunc(points)));
}

function groups(n: number): GroupFill[] {
  return Array.from({ length: GROUPS_PER_HALF }, (_, i) =>
    Math.max(0, Math.min(GROUP_SIZE, n - i * GROUP_SIZE)) as GroupFill,
  );
}

export function fosforitos(points: number): FosforitoBoard {
  const p = clampPoints(points);
  return { points: p, malas: groups(Math.min(p, HALF)), buenas: groups(Math.max(0, p - HALF)) };
}

/** Lado de la grilla (en píxeles de arte) de un grupo de 5 fósforos. */
export const GRID = 16;

export type StickKind = 'madera' | 'sombra' | 'cabeza' | 'brillo';

/** Colores de cada parte del fósforo: madera clara con su lado en sombra, cabeza roja con un punto de brillo. */
export const MATCH_COLORS: Record<StickKind, string> = {
  madera: '#d9a35b',
  sombra: '#9a6531',
  cabeza: '#d8362b',
  brillo: '#ff8a6b',
};

export interface StickRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: StickKind;
  /** 0..3 = lados del cuadrado, 4 = el que lo cruza en diagonal */
  stick: number;
}

const px = (stick: number, kind: StickKind, x: number, y: number): StickRect => ({ x, y, w: 1, h: 1, kind, stick });

/**
 * Un fósforo recto de 2 píxeles de grosor: 9 de madera y 3 de cabeza en la punta. `from` y `to` son las dos puntas
 * (la cabeza va en `to`); el lado claro mira arriba o a la izquierda.
 */
function straight(stick: number, horizontal: boolean, fixed: number, from: number, to: number, outer: -1 | 2): StickRect[] {
  const out: StickRect[] = [];
  const dir = to > from ? 1 : -1;
  const at = (kind: StickKind, along: number, across: number) =>
    horizontal ? px(stick, kind, along, across) : px(stick, kind, across, along);
  for (let i = 0, a = from; i < 12; i++, a += dir) {
    const isHead = i >= 9;
    out.push(at(isHead ? (i === 10 ? 'brillo' : 'cabeza') : 'madera', a, fixed));
    out.push(at(isHead ? 'cabeza' : 'sombra', a, fixed + 1));
    // la cabeza es más gruesa que el palito: asoma un píxel hacia afuera del cuadrado
    if (i >= 10) out.push(at('cabeza', a, fixed + outer));
  }
  return out;
}

/** La diagonal sube de abajo a la izquierda hacia arriba a la derecha, 2 píxeles de ancho; la cabeza va arriba. */
function diagonal(): StickRect[] {
  const out: StickRect[] = [];
  for (let k = 0; k <= 7; k++) {
    const isHead = k >= 5;
    out.push(px(4, isHead ? (k === 6 ? 'brillo' : 'cabeza') : 'madera', 4 + k, 11 - k));
    out.push(px(4, isHead ? 'cabeza' : 'sombra', 5 + k, 11 - k));
  }
  out.push(px(4, 'cabeza', 10, 5), px(4, 'cabeza', 11, 4));
  return out;
}

/**
 * Rects (grilla 16x16) de un grupo de hasta 5 fósforos como en el tanteador clásico de truco: 4 fósforos en molinete
 * cierran un cuadrado (cada cabeza toca el comienzo del siguiente, sin pisarse) y el 5º lo cruza en diagonal.
 */
export function groupRects(fill: GroupFill): StickRect[] {
  const sticks: StickRect[][] = [
    straight(0, true, 1, 1, 12, -1), // arriba, cabeza a la derecha
    straight(1, false, 13, 1, 12, 2), // derecha, cabeza abajo
    straight(2, true, 13, 14, 3, 2), // abajo, cabeza a la izquierda
    straight(3, false, 1, 14, 3, -1), // izquierda, cabeza arriba
    diagonal(),
  ];
  return sticks.slice(0, fill).flat();
}
