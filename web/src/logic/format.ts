export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '–';
  if (p > 0 && p < 0.01) return '<1%';
  return `${Math.round(p * 100)}%`;
}

export function formatPct1(p: number): string {
  return `${(p * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatSigned(n: number, digits = 2): string {
  const s = Math.abs(n).toFixed(digits).replace('.', ',');
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}
