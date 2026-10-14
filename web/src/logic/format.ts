export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '–';
  if (p > 0 && p < 0.01) return '<1%';
  return `${Math.round(p * 100)}%`;
}

export function formatPct1(p: number): string {
  if (!Number.isFinite(p)) return '–';
  return `${(p * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatSigned(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '–';
  const rounded = Number(n.toFixed(digits)); // -0,001 se redondea a 0: nada de "-0,00"
  const s = Math.abs(rounded).toFixed(digits).replace('.', ',');
  if (rounded > 0) return `+${s}`;
  if (rounded < 0) return `-${s}`;
  return s;
}
