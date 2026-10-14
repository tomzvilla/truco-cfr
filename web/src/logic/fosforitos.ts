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

export interface StickRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'palo' | 'cruz';
}

/** Rects (grilla 12x12) de un grupo de hasta 5 fosforitos: 4 palos formando un cuadrado y la cruz diagonal. */
export function groupRects(fill: GroupFill): StickRect[] {
  const sticks: StickRect[][] = [
    [{ x: 1, y: 1, w: 10, h: 1, kind: 'palo' }],
    [{ x: 10, y: 1, w: 1, h: 10, kind: 'palo' }],
    [{ x: 1, y: 10, w: 10, h: 1, kind: 'palo' }],
    [{ x: 1, y: 1, w: 1, h: 10, kind: 'palo' }],
    Array.from({ length: 10 }, (_, k): StickRect => ({ x: 1 + k, y: 10 - k, w: 1, h: 1, kind: 'cruz' })),
  ];
  return sticks.slice(0, fill).flat();
}
