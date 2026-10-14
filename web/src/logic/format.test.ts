import { describe, it, expect } from 'vitest';
import { formatPct, formatPct1, formatSigned } from './format';

describe('formato en español', () => {
  it('formatPct', () => {
    expect(formatPct(0.58)).toBe('58%');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(1)).toBe('100%');
    expect(formatPct(0.004)).toBe('<1%');
    expect(formatPct(Number.NaN)).toBe('–');
  });
  it('formatPct1 usa coma decimal', () => {
    expect(formatPct1(0.563)).toBe('56,3%');
    expect(formatPct1(0.5)).toBe('50,0%');
  });
  it('formatSigned muestra el signo', () => {
    expect(formatSigned(1.5)).toBe('+1,50');
    expect(formatSigned(-0.4)).toBe('-0,40');
    expect(formatSigned(0)).toBe('0,00');
  });
  it('formatSigned no inventa "NaN" ni "-0,00"', () => {
    expect(formatSigned(Number.NaN)).toBe('–');
    expect(formatSigned(Number.POSITIVE_INFINITY)).toBe('–');
    expect(formatSigned(-0.001)).toBe('0,00');
    expect(formatSigned(0.004)).toBe('0,00');
    expect(formatSigned(-0.006)).toBe('-0,01');
  });
  it('formatPct1 con NaN devuelve el guión', () => {
    expect(formatPct1(Number.NaN)).toBe('–');
  });
});
