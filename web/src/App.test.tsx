import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App (esqueleto)', () => {
  it('muestra el título y la ruta actual', () => {
    window.location.hash = '#/resultados';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Truco CFR');
    expect(screen.getByTestId('route')).toHaveTextContent('resultados');
  });
  it('una ruta inválida cae en jugar', () => {
    window.location.hash = '#/no-existe';
    render(<App />);
    expect(screen.getByTestId('route')).toHaveTextContent('jugar');
  });
});
