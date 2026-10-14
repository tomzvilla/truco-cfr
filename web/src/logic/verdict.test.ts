import { describe, it, expect } from 'vitest';
import { verdictOf, wilson } from './verdict';

describe('wilson', () => {
  it('50 de 100 da aproximadamente [0,404 ; 0,596]', () => {
    const { low, high } = wilson(50, 100);
    expect(low).toBeCloseTo(0.404, 2);
    expect(high).toBeCloseTo(0.596, 2);
  });
  it('n = 0 no explota: intervalo completo', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
  it('extremos quedan dentro de [0,1]', () => {
    const all = wilson(100, 100);
    expect(all.high).toBeLessThanOrEqual(1);
    expect(all.low).toBeLessThan(1);
    expect(wilson(0, 100).low).toBeGreaterThanOrEqual(0);
  });
});

describe('verdictOf', () => {
  it('gana solo si TODO el intervalo está por encima de 50%', () => {
    expect(verdictOf(0.51, 0.58)).toBe('gana');
    expect(verdictOf(0.49, 0.56)).toBe('sin-diferencia');
    expect(verdictOf(0.4, 0.49)).toBe('pierde');
    expect(verdictOf(0.5, 0.6)).toBe('sin-diferencia');
  });
});
