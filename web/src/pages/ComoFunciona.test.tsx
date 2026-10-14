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
  it('avisa que la curva usa datos de ejemplo', () => {
    render(<ComoFunciona />);
    expect(screen.getByText(/datos de ejemplo/i)).toBeInTheDocument();
  });
});
