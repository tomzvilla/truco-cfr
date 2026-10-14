import { describe, it, expect } from 'vitest';
import { clampPoints, fosforitos, groupRects } from './fosforitos';

describe('fosforitos (grupos de 5, 15 malas + 15 buenas)', () => {
  const cases: [number, number[], number[]][] = [
    [0, [0, 0, 0], [0, 0, 0]],
    [1, [1, 0, 0], [0, 0, 0]],
    [4, [4, 0, 0], [0, 0, 0]],
    [5, [5, 0, 0], [0, 0, 0]],
    [7, [5, 2, 0], [0, 0, 0]],
    [15, [5, 5, 5], [0, 0, 0]],
    [16, [5, 5, 5], [1, 0, 0]],
    [22, [5, 5, 5], [5, 2, 0]],
    [29, [5, 5, 5], [5, 5, 4]],
    [30, [5, 5, 5], [5, 5, 5]],
  ];
  it.each(cases)('%i puntos', (p, malas, buenas) => {
    const b = fosforitos(p);
    expect(b.malas).toEqual(malas);
    expect(b.buenas).toEqual(buenas);
    expect(b.points).toBe(p);
  });
  it('puntajes raros no rompen nada: se acotan a 0..30 y no dibujan de más', () => {
    const full = { malas: [5, 5, 5], buenas: [5, 5, 5] };
    const empty = { malas: [0, 0, 0], buenas: [0, 0, 0] };
    expect(fosforitos(31)).toEqual({ points: 30, ...full });
    expect(fosforitos(1000)).toEqual({ points: 30, ...full });
    expect(fosforitos(30.5)).toEqual({ points: 30, ...full });
    expect(fosforitos(Number.POSITIVE_INFINITY)).toEqual({ points: 30, ...full });
    expect(fosforitos(-3)).toEqual({ points: 0, ...empty });
    expect(fosforitos(Number.NEGATIVE_INFINITY)).toEqual({ points: 0, ...empty });
    expect(fosforitos(Number.NaN)).toEqual({ points: 0, ...empty });
    expect(fosforitos(7.9).points).toBe(7);
    expect(fosforitos(-0.5).points).toBe(0);
    expect(clampPoints(Number.POSITIVE_INFINITY)).toBe(30);
  });
  it('la cantidad de palitos dibujados coincide con el puntaje', () => {
    for (let p = 0; p <= 30; p++) {
      const b = fosforitos(p);
      const total = [...b.malas, ...b.buenas].reduce<number>((a, f) => a + f, 0);
      expect(total).toBe(p);
    }
  });
  it('siempre hay 3 grupos de malas y 3 de buenas', () => {
    for (const p of [-1, 0, 15, 16, 30, 31, Number.NaN]) {
      const b = fosforitos(p);
      expect(b.malas).toHaveLength(3);
      expect(b.buenas).toHaveLength(3);
    }
  });
});

describe('groupRects', () => {
  it('dibuja un palito por cada fosforito y la cruz solo con el quinto', () => {
    expect(groupRects(0)).toHaveLength(0);
    expect(groupRects(1)).toHaveLength(1);
    expect(groupRects(4)).toHaveLength(4);
    expect(groupRects(4).every((r) => r.kind === 'palo')).toBe(true);
    const five = groupRects(5);
    expect(five.some((r) => r.kind === 'cruz')).toBe(true);
    expect(five).toHaveLength(14);
  });
  it('todo cae dentro de la grilla de 12x12', () => {
    for (const r of groupRects(5)) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(12);
      expect(r.y + r.h).toBeLessThanOrEqual(12);
    }
  });
});
