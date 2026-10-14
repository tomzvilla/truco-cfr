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

describe('Nav compacta', () => {
  it('el enlace de la sección actual se ofrece a la vista (la barra se desplaza en celular)', () => {
    const calls: unknown[] = [];
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (opts?: unknown) { calls.push([this.textContent, opts]); };
    try {
      render(<Nav route="manos" />);
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
    expect(calls).toHaveLength(1);
    expect((calls[0] as [string, unknown])[0]).toBe('Manos destacadas');
  });
});
