import { describe, it, expect } from 'vitest';
import { CARD_BACK_PALETTE, CARD_H, CARD_W, cardBackDataUrl, cardBackMatrix, cardBackSvg } from './cardBack';

describe('dorso de carta', () => {
  const m = cardBackMatrix();
  it('mide 73x113 como las caras', () => {
    expect(CARD_W).toBe(73);
    expect(CARD_H).toBe(113);
    expect(m).toHaveLength(113);
    expect(m.every((row) => row.length === 73)).toBe(true);
  });
  it('usa solo colores de la paleta', () => {
    for (const row of m) for (const ch of row) expect(ch in CARD_BACK_PALETTE).toBe(true);
  });
  it('es determinista', () => {
    expect(cardBackMatrix()).toEqual(m);
  });
  it('tiene contorno, medallón ámbar y ojos blancos', () => {
    expect(m[0]![0]).toBe('k');
    expect(m[56]![36]).toBe('a');
    expect(m[50]![28]).toBe('w');
  });
  it('el SVG y la data URL son válidos', () => {
    expect(cardBackSvg()).toContain('viewBox="0 0 73 113"');
    expect(cardBackDataUrl().startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });
  it('el SVG y la data URL son estables entre llamadas', () => {
    expect(cardBackSvg()).toBe(cardBackSvg());
    expect(cardBackDataUrl()).toBe(cardBackDataUrl());
  });
});
