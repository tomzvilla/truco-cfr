import { describe, expect, it } from 'vitest';
import { pickScaleUpTo } from '../skins/scale';
import {
  MIN_HAND_DESKTOP_PX, MIN_HAND_MOBILE_PX, MIN_PLAYED_DESKTOP_PX, MIN_PLAYED_MOBILE_PX, handOverlap, tableSizes,
} from './sizing';

const native = { w: 73, h: 113 };

describe('pickScaleUpTo', () => {
  it('elige el mayor k/dpr que no pasa del límite', () => {
    expect(pickScaleUpTo(1.9, 1, 3)).toBeCloseTo(5 / 3);
    expect(pickScaleUpTo(2.9, 2, 1)).toBe(2);
  });
  it('si ningún múltiplo entero llega al mínimo, manda el tamaño', () => {
    expect(pickScaleUpTo(1.64, 1.644, 3)).toBeCloseTo(1.644);
    expect(pickScaleUpTo(1.7, 1.69, 1)).toBeCloseTo(1.7);
    expect(pickScaleUpTo(0.5, 1.2, 1)).toBeCloseTo(1.2);
  });
  it('datos inválidos no rompen', () => {
    expect(pickScaleUpTo(Number.NaN, 1, 1)).toBe(1);
    expect(pickScaleUpTo(2, 1, Number.NaN)).toBe(2);
  });
});

describe('tableSizes en celular', () => {
  const cases: [string, number, number, number][] = [
    ['360x780 dpr 3', 344, 710, 3],
    ['412x860 dpr 2.625', 396, 790, 2.625],
    ['390x844 dpr 3', 374, 774, 3],
    ['360x640 dpr 2', 344, 570, 2],
  ];
  it.each(cases)('%s: la mano mide al menos 120 px y las bazas 85 px', (_n, width, height, dpr) => {
    const s = tableSizes({ desktop: false, width, height, dpr, native });
    expect(s.hand * native.w).toBeGreaterThanOrEqual(MIN_HAND_MOBILE_PX - 1e-6);
    expect(s.played * native.w).toBeGreaterThanOrEqual(MIN_PLAYED_MOBILE_PX - 1e-6);
    expect(s.played).toBeLessThanOrEqual(s.hand);
  });
  it('las 3 cartas de la mano entran en el ancho con el solape calculado', () => {
    const s = tableSizes({ desktop: false, width: 344, height: 710, dpr: 3, native });
    const w = s.hand * native.w;
    expect(3 * w - 2 * handOverlap(344, w, 6)).toBeLessThanOrEqual(344 + 1e-6);
  });
  it('con más alto la mano crece (hasta el límite del ancho)', () => {
    const a = tableSizes({ desktop: false, width: 396, height: 700, dpr: 1, native });
    const b = tableSizes({ desktop: false, width: 396, height: 1200, dpr: 1, native });
    expect(b.hand).toBeGreaterThanOrEqual(a.hand);
  });
});

describe('tableSizes en escritorio', () => {
  const cases: [string, number, number][] = [
    ['1280x720', 900, 640],
    ['1366x768', 1000, 690],
    ['1920x1080', 1500, 1000],
  ];
  it.each(cases)('%s: mano >= 146 px, bazas >= 110 px, dorsos >= 73 px', (_n, width, height) => {
    const s = tableSizes({ desktop: true, width, height, dpr: 1, native });
    expect(s.hand * native.w).toBeGreaterThanOrEqual(MIN_HAND_DESKTOP_PX - 1e-6);
    expect(s.played * native.w).toBeGreaterThanOrEqual(MIN_PLAYED_DESKTOP_PX - 1e-6);
    expect(s.bot * native.w).toBeGreaterThanOrEqual(73 - 1e-6);
  });
  it('en una ventana grande la mano llega a 3x', () => {
    expect(tableSizes({ desktop: true, width: 1500, height: 1400, dpr: 1, native }).hand).toBe(3);
  });
});

describe('handOverlap', () => {
  it('es el solape justo para entrar, con un mínimo de abanico', () => {
    expect(handOverlap(344, 122, 6)).toBe(11);
    expect(handOverlap(600, 100, 8)).toBe(8);
  });
});
