import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOCK_RESULTS } from '../data/mock';
import { Resultados } from './Resultados';

describe('Resultados', () => {
  it('muestra el aviso de datos de ejemplo, la tabla y los dos gráficos', () => {
    const { container } = render(<Resultados />);
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/datos de ejemplo/i);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(MOCK_RESULTS.tournament.length + 1);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  });
  it('el veredicto sale del intervalo y no del porcentaje', () => {
    render(<Resultados />);
    expect(screen.getAllByText(/Le gana/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin diferencia clara').length).toBeGreaterThan(0);
  });
});
