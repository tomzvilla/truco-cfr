import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MOODS } from '../table/types';
import { MASCOT_PALETTE, MASCOT_SIZE, mascotMatrix, mascotRects } from './mascot';
import { Mascot } from './Mascot';

describe('mascota', () => {
  it.each(MOODS)('%s es una grilla cuadrada de 32x32 con solo colores de la paleta', (mood) => {
    const m = mascotMatrix(mood);
    expect(m).toHaveLength(MASCOT_SIZE);
    for (const row of m) {
      expect(row).toHaveLength(MASCOT_SIZE);
      for (const ch of row) expect(ch === '.' || ch in MASCOT_PALETTE).toBe(true);
    }
  });
  it('el tamaño es 32 y el componente respeta la escala entera', () => {
    expect(MASCOT_SIZE).toBe(32);
  });
  it('es un gaucho: chambergo, ceja y bigote, pañuelo celeste, poncho con guarda y mate con bombilla', () => {
    for (const mood of MOODS) {
      const joined = mascotMatrix(mood).join('');
      for (const ch of ['n', 'b', 'q', 'c', 'p', 'y', 'v', 'j', 'l']) {
        expect(joined.includes(ch), `${mood}: falta '${ch}'`).toBe(true);
      }
    }
    // el ala del sombrero es más ancha que la cara (una fila entera de ala)
    const m = mascotMatrix('neutral');
    expect(m[9]!.replace(/\./g, '').length).toBeGreaterThanOrEqual(24);
    // el bigote sobresale de la cara por los dos lados
    expect(m[18]![9]).toBe('q');
    expect(m[18]![22]).toBe('q');
  });
  it('las caras de los 5 estados se distinguen por la zona de ojos y boca, no solo por los adornos', () => {
    const face = (mood: (typeof MOODS)[number]) => mascotMatrix(mood).slice(12, 21).map((r) => r.slice(8, 25)).join('|');
    expect(new Set(MOODS.map(face)).size).toBe(5);
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
    expect(svg).toHaveAttribute('width', '128');
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
  });
});
