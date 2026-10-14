/** Intervalo de Wilson para una proporción k/n (z = 1,96 → 95%). */
export function wilson(k: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export type Verdict = 'gana' | 'sin-diferencia' | 'pierde';

export function verdictOf(ciLow: number, ciHigh: number): Verdict {
  if (ciLow > 0.5) return 'gana';
  if (ciHigh < 0.5) return 'pierde';
  return 'sin-diferencia';
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  gana: 'Le gana (el intervalo queda por encima de 50%)',
  'sin-diferencia': 'Sin diferencia clara',
  pierde: 'Pierde',
};
