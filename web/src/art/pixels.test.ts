import { describe, it, expect } from 'vitest';
import { matrixToRects } from './pixels';

describe('matrixToRects', () => {
  const palette = { a: '#111', b: '#222' };
  it('une píxeles contiguos del mismo color en una fila', () => {
    expect(matrixToRects(['aab'], palette)).toEqual([
      { x: 0, y: 0, w: 2, fill: '#111' },
      { x: 2, y: 0, w: 1, fill: '#222' },
    ]);
  });
  it('ignora los transparentes', () => {
    expect(matrixToRects(['.a.'], palette)).toEqual([{ x: 1, y: 0, w: 1, fill: '#111' }]);
  });
  it('falla con un mensaje claro si falta un color', () => {
    expect(() => matrixToRects(['az'], palette)).toThrow(/"z".*fila 0.*col 1/);
  });
});
