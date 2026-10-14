import { describe, it, expect } from 'vitest';
import { FELT_TILE, RAIL_H, RAIL_W, TABLE_PALETTE, feltDataUrl, feltMatrix, railDataUrl, railMatrix } from './table';

describe('texturas de la mesa', () => {
  it('el paño es un mosaico de 32x32 con trama y pelusa, solo con colores de la paleta', () => {
    const m = feltMatrix();
    expect(m).toHaveLength(FELT_TILE);
    for (const row of m) {
      expect(row).toHaveLength(FELT_TILE);
      for (const ch of row) expect(ch in TABLE_PALETTE).toBe(true);
    }
    const all = m.join('');
    for (const ch of ['f', 'F', 'h', 'e']) expect(all.includes(ch), ch).toBe(true);
    // mayormente paño liso: la textura no tapa el color de la mesa
    expect([...all].filter((c) => c === 'f').length / all.length).toBeGreaterThan(0.6);
  });
  it('el riel son dos tablas de madera con juntas, vetas y canto iluminado', () => {
    const m = railMatrix();
    expect(m).toHaveLength(RAIL_H);
    for (const row of m) {
      expect(row).toHaveLength(RAIL_W);
      for (const ch of row) expect(ch in TABLE_PALETTE).toBe(true);
    }
    expect(m[7]).toBe('j'.repeat(RAIL_W));
    expect(m[15]).toBe('j'.repeat(RAIL_W));
    expect(m[0]![5]).toBe('X');
    expect(m[3]![0]).toBe('j');
    expect(m[11]![RAIL_W / 2]).toBe('j');
    const all = m.join('');
    for (const ch of ['w', 'W', 'x']) expect(all.includes(ch), ch).toBe(true);
  });
  it('es determinista y las data URL son SVG estables', () => {
    expect(feltMatrix()).toEqual(feltMatrix());
    expect(feltDataUrl()).toBe(feltDataUrl());
    expect(railDataUrl()).toBe(railDataUrl());
    expect(feltDataUrl().startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(railDataUrl())).toContain(`viewBox="0 0 ${RAIL_W} ${RAIL_H}"`);
  });
});
