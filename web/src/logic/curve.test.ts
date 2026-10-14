import { describe, it, expect } from 'vitest';
import { ENVIDO_CURVE_MOCK } from '../data/envidoCurve';
import { TANTOS, barSlot, bluffMass, curveSummary, probAt } from './curve';

describe('datos mock de la curva', () => {
  it('cubren exactamente los 22 tantos posibles', () => {
    expect(ENVIDO_CURVE_MOCK.map((p) => p.tantos)).toEqual([...TANTOS]);
    expect(TANTOS).toHaveLength(22);
  });
  it('todas las probabilidades están en [0,1]', () => {
    for (const p of ENVIDO_CURVE_MOCK) {
      for (const v of [p.mano, p.pie]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
  it('hay farol: con 7 de tanto o menos la probabilidad es mayor que cero', () => {
    for (const p of ENVIDO_CURVE_MOCK.filter((q) => q.tantos <= 7)) {
      expect(p.mano).toBeGreaterThan(0);
      expect(p.pie).toBeGreaterThan(0);
    }
  });
});

describe('probAt / bluffMass', () => {
  it('probAt busca por tantos y asiento', () => {
    expect(probAt(ENVIDO_CURVE_MOCK, 'mano', 27)).toBeCloseTo(0.88, 5);
    expect(probAt(ENVIDO_CURVE_MOCK, 'pie', 27)).toBeCloseTo(0.83, 5);
  });
  it('probAt devuelve null para tantos imposibles', () => {
    expect(probAt(ENVIDO_CURVE_MOCK, 'mano', 15)).toBeNull();
    expect(probAt([], 'pie', 3)).toBeNull();
  });
  it('bluffMass es el promedio con tantos <= 7', () => {
    expect(bluffMass(ENVIDO_CURVE_MOCK, 'mano')).toBeCloseTo(0.04375, 5);
    expect(bluffMass(ENVIDO_CURVE_MOCK, 'pie')).toBeCloseTo(0.03, 5);
    expect(bluffMass([], 'mano')).toBe(0);
  });
});

describe('curveSummary', () => {
  it('con tantos bajos nombra el farol', () => {
    const s = curveSummary(ENVIDO_CURVE_MOCK, 'mano', 6)!;
    expect(s).toContain('Con 6 de tanto');
    expect(s).toContain('7%');
    expect(s).toContain('farol');
  });
  it('con tantos normales da solo el dato', () => {
    const s = curveSummary(ENVIDO_CURVE_MOCK, 'mano', 27)!;
    expect(s).toContain('88%');
    expect(s).not.toContain('farol');
  });
  it('con 31 o más explica la contención', () => {
    expect(curveSummary(ENVIDO_CURVE_MOCK, 'pie', 32)).toContain('se guarda');
  });
  it('null si no hay dato', () => {
    expect(curveSummary(ENVIDO_CURVE_MOCK, 'mano', 15)).toBeNull();
  });
});

describe('barSlot', () => {
  it('deja un hueco entre el 7 y el 20', () => {
    expect(barSlot(0)).toBe(0);
    expect(barSlot(7)).toBe(7);
    expect(barSlot(8)).toBe(9);
    expect(barSlot(21)).toBe(22);
  });
});
