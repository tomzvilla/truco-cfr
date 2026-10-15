import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComoFunciona } from './ComoFunciona';

describe('ComoFunciona', () => {
  it('muestra el título, las 6 secciones y la curva interactiva', () => {
    render(<ComoFunciona />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cómo funciona' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText(/no es un LLM/i)).toBeInTheDocument();
  });
  it('la curva es la real y no avisa de datos de ejemplo', () => {
    render(<ComoFunciona />);
    expect(screen.getByText(/20 000 manos del bot contra sí mismo/)).toBeInTheDocument();
    expect(screen.queryByText(/ejemplo/i)).toBeNull();
  });
});
