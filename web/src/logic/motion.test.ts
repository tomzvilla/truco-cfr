import { describe, it, expect } from 'vitest';
import {
  burstCount, burstParticles, motionPolicy, mulberry32, resolveMotion, tiltFromPointer,
} from './motion';

describe('resolveMotion (reducción de animaciones)', () => {
  it('auto sigue a la preferencia del sistema', () => {
    expect(resolveMotion('auto', true)).toBe(true);
    expect(resolveMotion('auto', false)).toBe(false);
  });
  it('el usuario puede forzar reducido o completo', () => {
    expect(resolveMotion('reduced', false)).toBe(true);
    expect(resolveMotion('full', true)).toBe(false);
  });
});

describe('motionPolicy', () => {
  it('reducido apaga todo lo que se mueve solo', () => {
    expect(motionPolicy(true)).toEqual({
      idle: false, tilt: false, pop: false, burst: false, shake: false, swirlAnimated: false,
    });
  });
  it('completo enciende todo', () => {
    expect(Object.values(motionPolicy(false)).every(Boolean)).toBe(true);
  });
});

describe('tiltFromPointer', () => {
  const rect = { left: 100, top: 200, width: 73, height: 113 };
  it('en el centro no inclina', () => {
    const t = tiltFromPointer(rect, 100 + 36.5, 200 + 56.5, 12);
    expect(t.rx).toBeCloseTo(0, 5);
    expect(t.ry).toBeCloseTo(0, 5);
  });
  it('en la esquina superior derecha inclina al máximo', () => {
    const t = tiltFromPointer(rect, 173, 200, 12);
    expect(t.ry).toBeCloseTo(12, 5);
    expect(t.rx).toBeCloseTo(12, 5);
  });
  it('fuera del rectángulo se satura y un rect de ancho 0 no da NaN', () => {
    expect(tiltFromPointer(rect, 10_000, 200, 12).ry).toBeCloseTo(12, 5);
    expect(tiltFromPointer({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ rx: 0, ry: 0 });
  });
});

describe('partículas', () => {
  it('burstCount crece con los puntos y se acota', () => {
    expect(burstCount(0)).toBe(0);
    expect(burstCount(-2)).toBe(0);
    expect(burstCount(1)).toBe(10);
    expect(burstCount(2)).toBe(14);
    expect(burstCount(30)).toBe(24);
  });
  it('es determinista por semilla y distinta entre semillas', () => {
    expect(burstParticles(12, 7)).toEqual(burstParticles(12, 7));
    expect(burstParticles(12, 7)).not.toEqual(burstParticles(12, 8));
  });
  it('respeta la cantidad pedida y el radio máximo', () => {
    expect(burstParticles(0, 1)).toEqual([]);
    expect(burstParticles(24, 3)).toHaveLength(24);
    for (const p of burstParticles(24, 3)) {
      expect(Math.hypot(p.dx, p.dy)).toBeLessThanOrEqual(74);
      expect([4, 6, 8]).toContain(p.size);
      expect(p.color).toBeGreaterThanOrEqual(0);
      expect(p.color).toBeLessThan(4);
    }
  });
  it('mulberry32 devuelve valores en [0,1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
