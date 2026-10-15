import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOCK_RESULTS } from '../data/mock';
import type { ResultsData } from '../data/types';
import { Resultados } from './Resultados';

const empty: ResultsData = { ...MOCK_RESULTS, learning: [], exploitability: [] };

describe('Resultados con datos vacíos o de ejemplo', () => {
  it('sin series de entrenamiento no se rompe y avisa que todavía no hay datos', () => {
    const { container } = render(<Resultados data={empty} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getAllByText('Todavía no hay datos de entrenamiento.').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);
  });
  it('si solo falta una serie, la otra se dibuja igual', () => {
    const { container } = render(<Resultados data={{ ...MOCK_RESULTS, exploitability: [] }} />);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1);
    expect(screen.getAllByText('Todavía no hay datos de entrenamiento.')).toHaveLength(1);
  });
  it('sin partidos del torneo muestra un aviso en lugar de una tabla vacía', () => {
    render(<Resultados data={{ ...empty, tournament: [] }} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Todavía no hay resultados del torneo.')).toBeInTheDocument();
  });
  it('con datos de ejemplo cada porcentaje inventado dice "(ejemplo)" ahí mismo', () => {
    render(<Resultados data={MOCK_RESULTS} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    for (const r of rows) expect(r).toHaveTextContent('(ejemplo)');
  });
  it('con datos reales no se agrega "(ejemplo)"', () => {
    render(<Resultados data={{ ...MOCK_RESULTS, isMock: false }} />);
    expect(screen.queryByText('(ejemplo)')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
  it('los colores de las series salen de los tokens CSS, no de hexadecimales', () => {
    const { container } = render(<Resultados data={MOCK_RESULTS} />);
    const strokes = [...container.querySelectorAll('polyline')].map((p) => p.getAttribute('stroke'));
    expect(strokes.length).toBeGreaterThan(0);
    for (const s of strokes) expect(s).toMatch(/^var\(--/);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
