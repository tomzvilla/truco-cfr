import { formatPct } from './format';

/** Tantos posibles en el envido sin flor: una sola carta (0..7) o dos del mismo palo (20..33). */
export const TANTOS = [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33] as const;

export type CurveSeat = 'mano' | 'pie';

/** Probabilidad (0..1) de que el bot cante envido, real envido o falta envido como primer canto. */
export interface CurvePoint {
  tantos: number;
  mano: number;
  pie: number;
}

/** Hasta este tanto, cantar es un farol. */
export const BLUFF_MAX_TANTOS = 7;

export function probAt(data: readonly CurvePoint[], seat: CurveSeat, tantos: number): number | null {
  const p = data.find((d) => d.tantos === tantos);
  return p ? p[seat] : null;
}

export function bluffMass(data: readonly CurvePoint[], seat: CurveSeat): number {
  const low = data.filter((d) => d.tantos <= BLUFF_MAX_TANTOS);
  if (low.length === 0) return 0;
  return low.reduce((acc, d) => acc + d[seat], 0) / low.length;
}

export function curveSummary(data: readonly CurvePoint[], seat: CurveSeat, tantos: number): string | null {
  const p = probAt(data, seat, tantos);
  if (p === null) return null;
  const base = `Con ${tantos} de tanto, ${seat === 'mano' ? 'como mano' : 'como pie'}, el bot canta envido el ${formatPct(p)} de las veces.`;
  if (tantos <= BLUFF_MAX_TANTOS) return `${base} Con eso no tiene nada: es un farol.`;
  if (tantos >= 31) return `${base} Con tantos tan buenos a veces se guarda el canto para no delatarse.`;
  return base;
}

/** Posición horizontal de la barra: deja un hueco entre el 7 y el 20 (índice 7 y 8). */
export function barSlot(index: number): number {
  return index > 7 ? index + 1 : index;
}
