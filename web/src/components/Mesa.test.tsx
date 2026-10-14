import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jcanabalSkin } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { Mesa } from './Mesa';

/** jsdom no hace layout: simulamos el ancho real del contenedor de la mano y la densidad de pantalla. */
function stubViewport(clientWidth: number, dpr: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr });
}

afterEach(() => {
  // el delete deja que vuelva a verse el clientWidth original de jsdom
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
});

const handImgWidth = () => Number(screen.getByAltText('1 de espadas').getAttribute('width'));

describe('Mesa', () => {
  it.each(FIXTURE_NAMES)('renderiza el fixture %s sin romperse', (name) => {
    render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /mascota del bot/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /^Vos: \d+ puntos$/ })).toBeInTheDocument();
  });
  it('tocar una carta de la mano juega esa carta', async () => {
    const onAction = vi.fn();
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(onAction).toHaveBeenCalledWith('jugar1');
  });
  it('si no es mi turno las cartas están deshabilitadas y se avisa que el bot piensa', () => {
    render(<Mesa view={{ ...FIXTURES.inicioDeMano, actions: [] }} skin={jcanabalSkin} onAction={() => {}} />);
    for (const b of screen.getAllByRole('button', { name: /^Jugar / })) expect(b).toBeDisabled();
    expect(screen.getByText('El bot está pensando…')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Acciones' })).toBeNull();
  });
  it('las cartas ya jugadas no se ofrecen y se muestran en la baza', () => {
    render(<Mesa view={FIXTURES.trucoPendiente} skin={jcanabalSkin} onAction={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Jugar 1 de espadas' })).toBeNull();
    expect(screen.getAllByAltText('1 de espadas').length).toBeGreaterThan(0);
  });
  it('sin onAction es solo lectura: no hay botonera', () => {
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(screen.queryByRole('group', { name: 'Acciones' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('fin de mano con rayos X: muestra las cartas del bot y las probabilidades', () => {
    render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getAllByAltText('6 de oros').length).toBeGreaterThan(1); // en la baza y en la mano revelada
    expect(screen.getByText('58%')).toBeInTheDocument();
  });
  it('tiembla cuando aparece vale cuatro (no al montar)', () => {
    const retruco: TableView = {
      ...FIXTURES.trucoPendiente,
      truco: { acceptedLevel: 2, pending: { call: 'retruco', by: 'bot' } },
    };
    const vale: TableView = {
      ...FIXTURES.trucoPendiente,
      truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } },
    };
    const { container, rerender } = render(<Mesa view={retruco} skin={jcanabalSkin} onAction={() => {}} />);
    const root = container.querySelector('.shake-root')!;
    expect(root).toHaveAttribute('data-shaking', 'false');
    rerender(<Mesa view={vale} skin={jcanabalSkin} onAction={() => {}} />);
    expect(root).toHaveAttribute('data-shaking', 'true');
  });
});

describe('Mesa: escala según el ancho real de la mano y la densidad (F2/F10)', () => {
  it('celular de 360 px (328 útiles) con dpr 3: la carta mide 4/3 del tamaño nativo', () => {
    stubViewport(328, 3);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBeCloseTo(73 * (4 / 3), 4);
  });
  it('el mismo ancho con dpr 1: escala 1', () => {
    stubViewport(328, 1);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBe(73);
  });
  it('al cambiar el tamaño de la ventana se vuelve a medir', () => {
    stubViewport(328, 1);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBe(73);
    stubViewport(600, 1);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(handImgWidth()).toBe(146);
  });
  it('la mano nunca ocupa más que el ancho medido', () => {
    for (const [w, dpr] of [[328, 3], [440, 2], [600, 1], [200, 1]] as const) {
      stubViewport(w, dpr);
      const { unmount } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
      const cardW = handImgWidth();
      expect(3 * cardW + 16).toBeLessThanOrEqual(Math.max(w, 3 * 73 + 16) + 1e-6);
      unmount();
    }
  });
});

describe('Mesa: cabecera del bot (F9)', () => {
  it('con la mano del bot revelada nunca se recorta; dorsos sí (asoman)', () => {
    const { container, unmount } = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} />);
    expect(container.querySelector('.mesa__botcards')).toHaveAttribute('data-revealed', 'true');
    unmount();
    const r = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(r.container.querySelector('.mesa__botcards')).toHaveAttribute('data-revealed', 'false');
  });
  it('las cartas del bot van antes que la mascota (en celular se apilan en ese orden)', () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    const header = container.querySelector('.mesa__bot')!;
    expect(header.children[0]).toHaveClass('mesa__botcards');
    expect(header.children[1]).toHaveClass('mesa__mascot');
  });
});
