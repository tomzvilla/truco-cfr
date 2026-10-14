/**
 * Escala CSS (>= 1) para que `cardsAcross` cartas entren en `availableWidth`, siempre como k/dpr con k entero:
 * cada píxel del arte ocupa k píxeles físicos enteros (nítido). Con dpr 1 es un entero; con dpr 3 puede ser 4/3.
 * Se elige el k más grande que entra (hasta `maxScale`) y cumple k/dpr >= 1; si ninguno cumple, devuelve 1.
 * `availableWidth` es el ancho real del contenedor de la mano (clientWidth).
 */
export function pickScale(
  availableWidth: number,
  nativeWidth: number,
  cardsAcross: number,
  gap: number,
  maxScale = 3,
  dpr = 1,
): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  const d = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1;
  const eps = 1e-9;
  const perCard = (availableWidth - gap * (cardsAcross - 1)) / cardsAcross;
  const fits = Math.floor((perCard / nativeWidth) * d + eps);
  const k = Math.min(fits, Math.floor(maxScale * d + eps));
  const kMin = Math.ceil(d - eps); // con dpr fraccionario, el menor k entero cuya escala es >= 1
  return k >= kMin ? k / d : 1;
}

/**
 * Igual que `pickScale` pero por altura: la mesa mide `nativeUnits * escala + overhead` px de alto (las cartas escalan
 * y el resto es fijo). Devuelve el k/dpr más grande (k entero, hasta `maxScale`) que entra en `availableHeight`, o 1.
 */
export function pickScaleByHeight(
  availableHeight: number,
  overhead: number,
  nativeUnits: number,
  maxScale = 3,
  dpr = 1,
): number {
  if (!Number.isFinite(availableHeight) || availableHeight <= 0) return 1;
  const d = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1;
  const eps = 1e-9;
  const fits = Math.floor(((availableHeight - overhead) / nativeUnits) * d + eps);
  const k = Math.min(fits, Math.floor(maxScale * d + eps));
  const kMin = Math.ceil(d - eps);
  return k >= kMin ? k / d : 1;
}

export function handWidth(nativeWidth: number, scale: number, cardsAcross: number, gap: number): number {
  return cardsAcross * nativeWidth * scale + gap * (cardsAcross - 1);
}
