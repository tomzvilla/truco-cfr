import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MOODS } from '../table/types';
import { MASCOT_PALETTE, MASCOT_SIZE, mascotMatrix, mascotRects } from './mascot';
import { Mascot } from './Mascot';

describe('mascota', () => {
  it.each(MOODS)('%s es una grilla cuadrada de 16x16 con solo colores de la paleta', (mood) => {
    const m = mascotMatrix(mood);
    expect(m).toHaveLength(MASCOT_SIZE);
    for (const row of m) {
      expect(row).toHaveLength(MASCOT_SIZE);
      for (const ch of row) expect(ch === '.' || ch in MASCOT_PALETTE).toBe(true);
    }
  });
  it('los 5 estados son visualmente distintos', () => {
    const joined = MOODS.map((m) => mascotMatrix(m).join('|'));
    expect(new Set(joined).size).toBe(5);
  });
  it('genera rects (no vacío) y todos dentro de la grilla', () => {
    for (const mood of MOODS) {
      const rects = mascotRects(mood);
      expect(rects.length).toBeGreaterThan(20);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(MASCOT_SIZE);
        expect(r.y).toBeLessThan(MASCOT_SIZE);
      }
    }
  });
  it('el componente es un SVG accesible con tamaño entero', () => {
    render(<Mascot mood="farol" scale={4} />);
    const svg = screen.getByRole('img', { name: /mascota.*farol/i });
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
  });
});
