import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const go = (hash: string) => {
  window.location.hash = hash;
};

describe('App', () => {
  it.each([
    ['#/jugar', 'Jugar'],
    ['#/como-funciona', 'Cómo funciona'],
    ['#/resultados', 'Resultados'],
    ['#/manos', 'Manos destacadas'],
    ['#/playground', 'Banco de pruebas'],
    ['#/ruta-que-no-existe', 'Jugar'],
    ['', 'Jugar'],
  ])('en %s muestra el título "%s"', (hash, title) => {
    go(hash);
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
  });

  it('cambia de página cuando cambia el hash', () => {
    go('#/jugar');
    render(<App />);
    act(() => {
      go('#/resultados');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Resultados');
    expect(screen.getByRole('link', { name: 'Resultados' })).toHaveAttribute('aria-current', 'page');
  });

  it('la barra de arriba tiene menú, silencio y configuración con nombre accesible, en cualquier página', () => {
    for (const hash of ['#/jugar', '#/resultados']) {
      go(hash);
      const { unmount } = render(<App />);
      expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Silenciar' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Configuración' })).toHaveLength(1);
      unmount();
    }
  });

  it('"Nueva mano" aparece en el menú solo en Jugar', async () => {
    go('#/jugar');
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getAllByRole('button', { name: 'Nueva mano' }).length).toBeGreaterThan(0);
    unmount();
    go('#/resultados');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.queryByRole('button', { name: 'Nueva mano' })).toBeNull();
  });

  it('muestra el crédito del arte con link al autor', () => {
    go('#/jugar');
    render(<App />);
    const credit = screen.getByRole('link', { name: 'Card art by Jose Angel Canabal' });
    expect(credit).toHaveAttribute('href', 'https://jcanabal.itch.io/spanish-deck-pixel-art');
  });

  it('el título de la pestaña acompaña a la página', () => {
    go('#/manos');
    render(<App />);
    expect(document.title).toBe('Manos destacadas · Truco CFR');
  });

  it('el interruptor CRT agrega y quita el overlay', async () => {
    go('#/jugar');
    const { container } = render(<App />);
    expect(container.querySelector('.crt')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    await userEvent.click(screen.getByRole('switch', { name: /Filtro CRT/ }));
    expect(container.querySelector('.crt')).not.toBeNull();
  });

  it('refleja la preferencia de animaciones en <html data-motion>', async () => {
    go('#/jugar');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Reducidas' }));
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });
});
