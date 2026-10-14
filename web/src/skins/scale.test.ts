import { describe, it, expect } from 'vitest';
import { handWidth, pickScale } from './scale';

describe('pickScale (3 cartas de 73 px, gap 8)', () => {
  it('a 360 px de pantalla (328 útiles) usa 1x y entra', () => {
    const s = pickScale(328, 73, 3, 8);
    expect(s).toBe(1);
    expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(328);
  });
  it('a 520 px usa 2x y entra', () => {
    const s = pickScale(488, 73, 3, 8);
    expect(s).toBe(2);
    expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(488);
  });
  it('nunca baja de 1x aunque el ancho sea ridículo', () => {
    expect(pickScale(100, 73, 3, 8)).toBe(1);
    expect(pickScale(0, 73, 3, 8)).toBe(1);
    expect(pickScale(Number.NaN, 73, 3, 8)).toBe(1);
  });
  it('respeta el máximo y con dpr 1 devuelve siempre enteros', () => {
    expect(pickScale(5000, 73, 3, 8)).toBe(3);
    expect(pickScale(5000, 73, 3, 8, 2)).toBe(2);
    for (const w of [320, 360, 414, 480, 600, 768, 1024]) {
      expect(Number.isInteger(pickScale(w - 32, 73, 3, 8))).toBe(true);
    }
  });
});

describe('pickScale con densidad de pantalla', () => {
  it('celular de 360 px (328 útiles): dpr 3 da 4/3 y dpr 1 da 1', () => {
    expect(pickScale(328, 73, 3, 8, 3, 3)).toBeCloseTo(4 / 3);
    expect(pickScale(328, 73, 3, 8, 3, 1)).toBe(1);
  });
  it('escala x dpr siempre entero y la mano no desborda', () => {
    for (const dpr of [1, 2, 3]) {
      for (let w = 200; w <= 1400; w += 37) {
        const s = pickScale(w, 73, 3, 8, 3, dpr);
        expect(Number.isInteger(Math.round(s * dpr * 1e6) / 1e6)).toBe(true);
        expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(Math.max(w, handWidth(73, 1, 3, 8)) + 1e-6);
      }
    }
  });
  it('dpr fraccionario de Android (1.5, 2.625, 2.75): k/dpr con k entero, entra y nunca baja de 1', () => {
    // 328 útiles: 1.5 -> k=2 (4/3), 2.625 -> k=3 (3/2.625)
    expect(pickScale(328, 73, 3, 8, 3, 1.5)).toBeCloseTo(2 / 1.5, 6);
    expect(pickScale(328, 73, 3, 8, 3, 2.625)).toBeCloseTo(3 / 2.625, 6);
    for (const dpr of [1.5, 2.625, 2.75]) {
      for (let w = 150; w <= 1400; w += 29) {
        const s = pickScale(w, 73, 3, 8, 3, dpr);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(3);
        if (s > 1) {
          const k = s * dpr;
          expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6); // píxeles físicos enteros
          expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(w + 1e-6);
        }
      }
    }
  });
  it('con dpr fraccionario respeta el máximo en píxeles físicos enteros', () => {
    const s = pickScale(5000, 73, 3, 8, 3, 2.625);
    expect(s).toBeLessThanOrEqual(3);
    expect(Math.abs(s * 2.625 - Math.round(s * 2.625))).toBeLessThan(1e-6);
  });
  it('si ningún k entero con k/dpr >= 1 entra, vuelve a 1', () => {
    expect(pickScale(250, 73, 3, 8, 3, 2.625)).toBe(1);
  });
  it('dpr inválido se trata como 1', () => {
    expect(pickScale(328, 73, 3, 8, 3, Number.NaN)).toBe(1);
    expect(pickScale(328, 73, 3, 8, 3, 0.5)).toBe(1);
  });
});
