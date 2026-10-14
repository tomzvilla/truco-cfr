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
export const GRID = 15;

export interface StickRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** madera del palito o cabeza roja del fósforo */
  kind: 'madera' | 'cabeza';
  /** 0..3 = lados del cuadrado, 4 = el que lo cruza en diagonal */
  stick: number;
}

const wood = (stick: number, x: number, y: number, w: number, h: number): StickRect => ({ x, y, w, h, kind: 'madera', stick });
const head = (stick: number, x: number, y: number, w: number, h: number): StickRect => ({ x, y, w, h, kind: 'cabeza', stick });

/** La diagonal sube de abajo a la izquierda hacia arriba a la derecha, con 2 píxeles de grosor; la cabeza va arriba. */
function diagonal(): StickRect[] {
  const out: StickRect[] = [];
  for (let k = 0; k <= 8; k++) {
    const make = k >= 7 ? head : wood;
    out.push(make(4, 3 + k, 11 - k, 2, 1));
  }
  return out;
}

/**
 * Rects (grilla 15x15) de un grupo de hasta 5 fósforos como en el tanteador clásico de truco: 4 fósforos en molinete
 * forman un cuadrado (cada uno con la cabeza apoyada en el siguiente) y el 5º lo cruza en diagonal.
 */
export function groupRects(fill: GroupFill): StickRect[] {
  const sticks: StickRect[][] = [
    [wood(0, 2, 2, 8, 1), head(0, 10, 1, 2, 2)],
    [wood(1, 12, 2, 1, 8), head(1, 12, 10, 2, 2)],
    [wood(2, 5, 12, 8, 1), head(2, 3, 12, 2, 2)],
    [wood(3, 2, 5, 1, 8), head(3, 1, 3, 2, 2)],
    diagonal(),
  ];
  return sticks.slice(0, fill).flat();
}
