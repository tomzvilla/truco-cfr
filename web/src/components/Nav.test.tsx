import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from './Nav';

describe('Nav hamburguesa', () => {
  const burger = () => screen.getByRole('button', { name: /menú/i });

  it('el botón tiene aria-expanded y aria-controls apuntando al panel, que arranca cerrado', () => {
    render(<Nav route="jugar" />);
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    const id = burger().getAttribute('aria-controls')!;
    const panel = document.getElementById(id)!;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('hidden');
  });

  it('se abre y se cierra con el botón, y el foco entra al primer enlace', async () => {
    render(<Nav route="jugar" />);
    await userEvent.click(burger());
    expect(burger()).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('navigation', { name: 'Menú' });
    expect(within(menu).getAllByRole('link')).toHaveLength(4);
    expect(within(menu).getByRole('link', { name: 'Jugar' })).toHaveFocus();
    await userEvent.click(burger());
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Menú' })).toBeNull();
  });

  it('Esc lo cierra y el foco vuelve al botón', async () => {
    render(<Nav route="jugar" />);
    await userEvent.click(burger());
    await userEvent.keyboard('{Escape}');
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(burger()).toHaveFocus();
  });

  it('un clic afuera lo cierra', async () => {
    render(
      <>
        <p>afuera</p>
        <Nav route="jugar" />
      </>,
    );
    await userEvent.click(burger());
    await userEvent.click(screen.getByText('afuera'));
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('marca la sección actual en el menú y elegir un enlace lo cierra', async () => {
    render(<Nav route="resultados" />);
    await userEvent.click(burger());
    const menu = screen.getByRole('navigation', { name: 'Menú' });
    expect(within(menu).getByRole('link', { name: 'Resultados' })).toHaveAttribute('aria-current', 'page');
    const link = within(menu).getByRole('link', { name: 'Manos destacadas' });
    expect(link).toHaveAttribute('href', '#/manos');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('ofrece Nueva mano solo si hay partida, y lo cierra al usarlo', async () => {
    const onNewHand = vi.fn();
    const { rerender } = render(<Nav route="jugar" />);
    await userEvent.click(burger());
    expect(screen.queryByRole('button', { name: 'Nueva mano' })).toBeNull();
    rerender(<Nav route="jugar" onNewHand={onNewHand} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nueva mano' }));
    expect(onNewHand).toHaveBeenCalledOnce();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
  });
});

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
