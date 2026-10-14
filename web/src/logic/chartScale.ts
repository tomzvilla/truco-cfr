/** Escalas de los gráficos (dominio de datos → rango de píxeles). No confundir con `skins/scale.ts` (escala de cartas). */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** Escala logarítmica; los valores por debajo de `d0` se saturan en `d0` (evita -Infinity). */
export function log(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const f = linear(Math.log10(d0), Math.log10(d1), r0, r1);
  return (v) => f(Math.log10(Math.max(v, d0)));
}
