export interface PixelRect {
  x: number;
  y: number;
  /** Ancho en píxeles de la grilla; el alto siempre es 1. */
  w: number;
  fill: string;
}

/** Convierte una matriz de letras en rects, uniendo corridas horizontales del mismo color. '.' = transparente. */
export function matrixToRects(matrix: string[], palette: Record<string, string>): PixelRect[] {
  const rects: PixelRect[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = palette[ch];
      if (!fill) throw new Error(`Carácter sin color en la paleta: "${ch}" (fila ${y}, col ${x})`);
      rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return rects;
}
