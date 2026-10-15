import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOCK_RESULTS } from '../data/mock';
import { REAL_RESULTS } from '../data/real';
import { Resultados } from './Resultados';

describe('Resultados', () => {
  it('muestra el aviso de datos de ejemplo, la tabla y los dos gráficos', () => {
    const { container } = render(<Resultados data={MOCK_RESULTS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/datos de ejemplo/i);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(MOCK_RESULTS.tournament.length + 1);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  });
  it('sin props usa los datos reales: sin aviso de ejemplo y con las aclaraciones de los gráficos', () => {
    render(<Resultados />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/ejemplo/i)).toBeNull();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(REAL_RESULTS.tournament.length + 1);
    expect(screen.getByText(/400 partidos de la política de esa iteración/)).toBeInTheDocument();
    expect(screen.getByText(/Cada punto del gráfico es la política de esa iteración/)).toBeInTheDocument();
    expect(screen.getByText(/La red final \(la que juega en la web.*pierde solo 0,010 puntos por mano/)).toBeInTheDocument();
    expect(screen.getByText(/Última iteración \(la política de ese momento.*La red final, la que juega en la web: 0,010/)).toBeInTheDocument();
  });
  it('el veredicto sale del intervalo y no del porcentaje', () => {
    render(<Resultados data={MOCK_RESULTS} />);
    expect(screen.getAllByText(/Le gana/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin diferencia clara').length).toBeGreaterThan(0);
  });
});
