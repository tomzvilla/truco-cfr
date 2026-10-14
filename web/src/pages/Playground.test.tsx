import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Playground } from './Playground';

describe('Banco de pruebas (Playground)', () => {
  it('el título visible está en español (F18)', () => {
    render(<Playground />);
    expect(screen.getByRole('heading', { level: 1, name: 'Banco de pruebas' })).toBeInTheDocument();
  });
  it('muestra las 40 cartas de la baraja para verificar el arte', () => {
    const { container } = render(<Playground />);
    expect(container.querySelectorAll('.deck img')).toHaveLength(40);
  });
  it('muestra las 5 caras de la mascota', () => {
    render(<Playground />);
    expect(screen.getAllByRole('img', { name: /mascota del bot/i }).length).toBeGreaterThanOrEqual(5);
  });
  it('cambiar el fixture cambia la mesa', async () => {
    render(<Playground />);
    await userEvent.selectOptions(screen.getByLabelText('Situación'), 'trucoPendiente');
    expect(screen.getByText('El bot cantó truco. Respondé.')).toBeInTheDocument();
  });
  it('las opciones de situación tienen nombre en español', () => {
    render(<Playground />);
    expect(screen.getByRole('option', { name: 'Truco pendiente' })).toHaveValue('trucoPendiente');
  });
  it('sumar puntos dispara la explosión', () => {
    render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumarte 2 puntos' }));
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
  it('"Probar vale cuatro" hace temblar la mesa', () => {
    const { container } = render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar vale cuatro' }));
    expect(container.querySelector('.shake-root')).toHaveAttribute('data-shaking', 'true');
    expect(screen.getByText('El bot cantó vale cuatro. Respondé.')).toBeInTheDocument();
  });
  it('registra las acciones tocadas', () => {
    render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Truco' }));
    expect(screen.getByTestId('action-log')).toHaveTextContent('truco');
  });
  it('el crédito sale del skin', () => {
    render(<Playground />);
    expect(screen.getByText(/Card art by Jose Angel Canabal/)).toBeInTheDocument();
  });
});
