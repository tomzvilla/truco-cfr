/**
 * Escala CSS (>= 1) tal que escala x dpr sea un entero: píxeles físicos enteros, sin desbordar.
 * Con dpr 1 el resultado es siempre entero; con dpr 3 puede ser 4/3, 5/3, etc.
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
  const perCard = (availableWidth - gap * (cardsAcross - 1)) / cardsAcross;
  const deviceSteps = Math.floor((perCard / nativeWidth) * d + 1e-9);
  return Math.max(1, Math.min(maxScale, deviceSteps / d));
}

export function handWidth(nativeWidth: number, scale: number, cardsAcross: number, gap: number): number {
  return cardsAcross * nativeWidth * scale + gap * (cardsAcross - 1);
}
