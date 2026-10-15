import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const situacion = screen.getByRole('radiogroup', { name: 'Situación' });
    await userEvent.click(within(situacion).getByRole('radio', { name: 'Truco pendiente' }));
    expect(screen.getByText('¡TRUCO!')).toBeInTheDocument();
  });
  it('las opciones de situación tienen nombre en español', () => {
    render(<Playground />);
    const situacion = screen.getByRole('radiogroup', { name: 'Situación' });
    expect(within(situacion).getByRole('radio', { name: 'Inicio de mano' })).toHaveAttribute('aria-checked', 'true');
  });
  it('el ánimo de la mascota se elige con el control pixel', async () => {
    render(<Playground />);
    const animo = screen.getByRole('radiogroup', { name: 'Ánimo de la mascota' });
    await userEvent.click(within(animo).getByRole('radio', { name: 'pierde' }));
    expect(within(animo).getByRole('radio', { name: 'pierde' })).toHaveAttribute('aria-checked', 'true');
  });
  it('rayos X es un interruptor pixel, sin controles nativos', async () => {
    const { container } = render(<Playground />);
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type=checkbox]')).toBeNull();
    const sw = screen.getByRole('switch', { name: /Rayos X/ });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
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
    expect(screen.getByText('¡VALE CUATRO!')).toBeInTheDocument();
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
