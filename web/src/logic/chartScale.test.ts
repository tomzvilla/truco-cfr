import { describe, it, expect } from 'vitest';
import { linear, log } from './chartScale';

describe('escalas', () => {
  it('linear mapea el dominio al rango (también invertido)', () => {
    expect(linear(0, 10, 0, 100)(5)).toBe(50);
    expect(linear(0, 1, 200, 0)(0.25)).toBe(150);
  });
  it('linear con dominio degenerado no da NaN', () => {
    expect(linear(3, 3, 7, 9)(3)).toBe(7);
  });
  it('log mapea decenas a distancias iguales', () => {
    const f = log(0.01, 1, 0, 100);
    expect(f(0.1)).toBeCloseTo(50, 5);
    expect(f(1)).toBeCloseTo(100, 5);
  });
  it('log satura por debajo del dominio (no -Infinity)', () => {
    expect(log(0.01, 1, 0, 100)(0)).toBeCloseTo(0, 5);
  });
});
