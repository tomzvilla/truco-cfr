import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Scoreboard } from './Scoreboard';

const fills = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('[data-fill]')).map((n) => n.getAttribute('data-fill'));

describe('Scoreboard', () => {
  it('dibuja 12 grupos (2 jugadores x 2 mitades x 3) y expone el puntaje accesible', () => {
    const { container } = render(<Scoreboard score={[16, 3]} mano="yo" />);
    expect(container.querySelectorAll('[data-fill]')).toHaveLength(12);
    const yo = screen.getByRole('group', { name: 'Vos: 16 puntos' });
    expect(fills(yo)).toEqual(['5', '5', '5', '1', '0', '0']);
    const bot = screen.getByRole('group', { name: 'Bot: 3 puntos' });
    expect(fills(bot)).toEqual(['3', '0', '0', '0', '0', '0']);
  });
  it('marca quién es mano', () => {
    render(<Scoreboard score={[0, 0]} mano="bot" />);
    expect(within(screen.getByRole('group', { name: 'Bot: 0 puntos' })).getByText('(mano)')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Vos: 0 puntos' })).queryByText('(mano)')).toBeNull();
  });
  it('puntajes fuera de rango se acotan en pantalla', () => {
    render(<Scoreboard score={[99, -4]} mano="yo" />);
    expect(screen.getByRole('group', { name: 'Vos: 30 puntos' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bot: 0 puntos' })).toBeInTheDocument();
  });
  it('NaN y decimales tampoco rompen el marcador', () => {
    render(<Scoreboard score={[Number.NaN, 7.9]} mano="yo" />);
    expect(screen.getByRole('group', { name: 'Vos: 0 puntos' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bot: 7 puntos' })).toBeInTheDocument();
  });
  it('explota con +N cuando sube el puntaje, pero no al montar', () => {
    const { rerender } = render(<Scoreboard score={[1, 0]} mano="yo" />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
    rerender(<Scoreboard score={[3, 0]} mano="yo" />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
  it('no explota si el puntaje baja o no cambia', () => {
    const { rerender } = render(<Scoreboard score={[5, 5]} mano="yo" />);
    rerender(<Scoreboard score={[2, 5]} mano="yo" />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });
});
