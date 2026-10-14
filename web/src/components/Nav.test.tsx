import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from './Nav';

describe('Nav', () => {
  it('tiene las 4 secciones con su hash', () => {
    render(<Nav route="jugar" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Jugar', 'Cómo funciona', 'Resultados', 'Manos destacadas']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#/jugar', '#/como-funciona', '#/resultados', '#/manos']);
  });
  it('marca la sección actual', () => {
    render(<Nav route="resultados" />);
    expect(screen.getByRole('link', { name: 'Resultados' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Jugar' })).not.toHaveAttribute('aria-current');
  });
});
