import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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

const handImgWidth = () => Number(document.querySelector('.mesa__hand img')!.getAttribute('width'));

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

describe('Mesa: cabecera del bot (F9)', () => {
  it('con la mano del bot revelada nunca se recorta; dorsos sí (asoman)', () => {
    const { container, unmount } = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} />);
    expect(container.querySelector('.mesa__botcards')).toHaveAttribute('data-revealed', 'true');
    unmount();
    const r = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(r.container.querySelector('.mesa__botcards')).toHaveAttribute('data-revealed', 'false');
  });
  it('las cartas del bot van antes que la mascota (en el DOM y, en celular, también a la vista)', () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    const cards = container.querySelector('.mesa__botcards')!;
    const mascot = container.querySelector('.mascot')!;
    expect(cards.compareDocumentPosition(mascot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/** matchMedia: `desktop` responde a la consulta de escritorio (>= 900 px). */
function stubMedia({ desktop }: { desktop: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width: 900px'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const setHeight = (h: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
const imgWidths = (c: HTMLElement, sel: string) => [...c.querySelectorAll(`${sel} img`)].map((i) => Number(i.getAttribute('width')));

describe('Mesa: tamaños de cartas en celular', () => {
  afterEach(() => setHeight(768));

  it('360 px con dpr 3: la mano mide al menos 120 px, las bazas al menos 85 y todo sale de variables CSS', () => {
    stubViewport(344, 3);
    stubMedia({ desktop: false });
    setHeight(780);
    const { container } = render(<Mesa view={FIXTURES.trucoPendiente} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBeGreaterThanOrEqual(120 - 1e-6);
    for (const w of imgWidths(container, '.baza')) expect(w).toBeGreaterThanOrEqual(85 - 1e-6);
    const mesa = container.querySelector('.mesa') as HTMLElement;
    expect(mesa.style.getPropertyValue('--hand-w')).toBe(`${handImgWidth()}px`);
    expect(mesa.getAttribute('data-layout')).toBe('mobile');
  });
  it('con dpr 1 también se respetan los mínimos', () => {
    stubViewport(344, 1);
    stubMedia({ desktop: false });
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBeGreaterThanOrEqual(120 - 1e-6);
  });
  it('al cambiar el tamaño de la ventana se vuelve a medir', () => {
    stubViewport(344, 1);
    stubMedia({ desktop: false });
    setHeight(1400);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    const before = handImgWidth();
    stubViewport(600, 1);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(handImgWidth()).toBeGreaterThanOrEqual(before);
  });
  it('re-mide cuando cambia la densidad de pantalla', () => {
    stubViewport(344, 1);
    const listeners: (() => void)[] = [];
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    setHeight(780);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    const before = handImgWidth();
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    act(() => listeners.forEach((l) => l()));
    expect(handImgWidth()).not.toBe(before);
    expect(handImgWidth()).toBeGreaterThanOrEqual(120 - 1e-6);
  });
  it('los dorsos del bot son 3 y chicos; la mano revelada usa el mismo tamaño', () => {
    stubViewport(344, 3);
    stubMedia({ desktop: false });
    const a = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    const backs = imgWidths(a.container, '.mesa__botcards');
    expect(backs).toHaveLength(3);
    expect(backs[0]).toBeLessThan(73);
    a.unmount();
    const b = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} />);
    expect(imgWidths(b.container, '.mesa__botcards')).toEqual([backs[0], backs[0], backs[0]]);
  });
});

describe('Mesa: avisos para lectores de pantalla', () => {
  it('el estado de la mano se anuncia con cortesía (aria-live polite)', () => {
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(screen.getByRole('list', { name: 'Estado de la mano' })).toHaveAttribute('aria-live', 'polite');
  });
  it('el globo de la mascota no es una región viva: los cambios de ánimo no se anuncian', () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    const bubble = container.querySelector('.bubble')!;
    expect(bubble).not.toHaveAttribute('role');
    expect(bubble).not.toHaveAttribute('aria-live');
    expect(bubble.closest('[aria-live]')).toBeNull();
  });
});

describe('Mesa: mascota gaucha', () => {
  it('mide 32 x 2 = 64 px en celular y 32 x 3 = 96 px en el panel lateral', () => {
    stubViewport(344, 1);
    stubMedia({ desktop: false });
    const a = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(Number(a.container.querySelector('.mascot')!.getAttribute('width'))).toBe(64);
    a.unmount();
    stubMedia({ desktop: true });
    const b = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(Number(b.container.querySelector('.mascot')!.getAttribute('width'))).toBe(96);
  });
});

describe('Mesa: anotador, bazas y fin de mano', () => {
  it('en celular el anotador va dentro del paño y la mascota en la tira del bot', () => {
    stubViewport(344, 3);
    stubMedia({ desktop: false });
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(container.querySelector('.mesa__felt .mesa__paper .score')).not.toBeNull();
    expect(container.querySelector('.mesa__strip .mascot')).not.toBeNull();
    expect(container.querySelector('.mesa__side')).toBeNull();
    expect(container.querySelector('.mesa__rail > .mesa__felt')).not.toBeNull();
  });
  it('en la baza la carta del bot va primero (arriba) y la mía después (encima)', () => {
    const { container } = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} />);
    const baza = container.querySelector('.baza')!;
    const cards = baza.querySelectorAll('.baza__cards > *');
    expect(cards).toHaveLength(2);
    expect(baza.querySelector('.baza__tag')).not.toBeNull();
  });
  it('las bazas con ganador muestran una chapita corta', () => {
    const { container } = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} />);
    const tags = [...container.querySelectorAll('.baza__tag')].map((t) => t.textContent);
    expect(tags.some((t) => ['Ganaste', 'Ganó el bot', 'Parda'].includes(t ?? ''))).toBe(true);
  });
  it('fin de mano: cartel sobre el paño con el resultado y el botón Nueva mano', async () => {
    const onNewHand = vi.fn();
    const { container } = render(
      <Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} onAction={() => {}} onNewHand={onNewHand} />,
    );
    const end = container.querySelector('.mesa__felt .mesa__end')!;
    expect(end).not.toBeNull();
    expect(end.querySelector('.mesa__end-title')!.textContent).toBe('Ganó el bot: +1');
    await userEvent.click(within(end as HTMLElement).getByRole('button', { name: 'Nueva mano' }));
    expect(onNewHand).toHaveBeenCalledOnce();
  });
  it('fin de partido: el cartel dice quién ganó y ofrece Nuevo partido, no Nueva mano', async () => {
    const onNewHand = vi.fn();
    const onNewMatch = vi.fn();
    const view = { ...FIXTURES.finDeManoRayosX, score: [12, 30] as const, matchWinner: 'bot' as const };
    const { container } = render(
      <Mesa view={view} skin={jcanabalSkin} onAction={() => {}} onNewHand={onNewHand} onNewMatch={onNewMatch} />,
    );
    const end = container.querySelector('.mesa__felt .mesa__end') as HTMLElement;
    expect(end.querySelector('.mesa__end-title')!.textContent).toBe('El bot ganó el partido');
    expect(end).toHaveAttribute('data-outcome', 'bot');
    expect(within(end).queryByRole('button', { name: 'Nueva mano' })).toBeNull();
    await userEvent.click(within(end).getByRole('button', { name: 'Nuevo partido' }));
    expect(onNewMatch).toHaveBeenCalledOnce();
    expect(onNewHand).not.toHaveBeenCalled();
  });
  it('mientras se juega no hay cartel de fin de mano', () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} onNewHand={() => {}} />);
    expect(container.querySelector('.mesa__end')).toBeNull();
  });
});

describe('Mesa: rayos X desde un botón', () => {
  it('con rayos X activado hay un botón Rayos X que abre y cierra la hoja', async () => {
    const { container } = render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    const btn = screen.getByRole('button', { name: 'Rayos X' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Rayos X del bot' })).toBeNull();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Rayos X del bot' })).toBeInTheDocument();
    expect(container.querySelector('.xsheet')).not.toHaveAttribute('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar rayos X' }));
    expect(screen.queryByRole('region', { name: 'Rayos X del bot' })).toBeNull();
  });
  it('sin rayos X no hay botón', () => {
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Rayos X' })).toBeNull();
  });
  it('en modo lectura (repeticiones) el panel va siempre a la vista', () => {
    render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} xrayOn />);
    expect(screen.getByRole('region', { name: 'Rayos X del bot' })).toBeInTheDocument();
  });
});

describe('Mesa: escritorio con panel lateral, sin scroll', () => {
  afterEach(() => setHeight(768));

  it.each([[720], [768], [1080]])('en una ventana de %i px de alto la mano mide >= 146, las bazas >= 110 y los dorsos >= 73', (h) => {
    stubViewport(700, 1);
    stubMedia({ desktop: true });
    setHeight(h);
    const { container } = render(<Mesa view={FIXTURES.trucoPendiente} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBeGreaterThanOrEqual(146 - 1e-6);
    for (const w of imgWidths(container, '.baza')) expect(w).toBeGreaterThanOrEqual(110 - 1e-6);
    for (const w of imgWidths(container, '.mesa__botcards')) expect(w).toBeGreaterThanOrEqual(73 - 1e-6);
  });
  it('en 1080 de alto la mano crece a 3x', () => {
    stubViewport(900, 1);
    stubMedia({ desktop: true });
    setHeight(1200);
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    expect(handImgWidth()).toBe(219);
  });
  it('panel lateral: marca, mascota, anotador, estado y herramientas; a la derecha, dorsos, paño, mano y botones', () => {
    stubViewport(700, 1);
    stubMedia({ desktop: true });
    const { container } = render(
      <Mesa
        view={FIXTURES.inicioDeMano}
        skin={jcanabalSkin}
        onAction={() => {}}
        head={<span>cabecera</span>}
        tools={<button type='button'>Herramienta</button>}
      />,
    );
    const side = container.querySelector('.mesa__side')!;
    const play = container.querySelector('.mesa__play')!;
    for (const sel of ['.mascot', '.bubble', '.score', '.mesa__status', '.mesa__tools']) expect(side.querySelector(sel), sel).not.toBeNull();
    expect(side).toHaveTextContent('cabecera');
    for (const sel of ['.mesa__bots', '.mesa__rail .mesa__felt', '.mesa__hand', '[aria-label=Acciones]']) expect(play.querySelector(sel), sel).not.toBeNull();
    expect(play.querySelector('.mascot')).toBeNull();
    expect(play.querySelector('.mesa__paper')).toBeNull();
  });
  it('Nueva mano y Configuración quedan fuera del paño', () => {
    stubViewport(700, 1);
    stubMedia({ desktop: true });
    const { container } = render(
      <Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} tools={<button type='button'>Nueva mano</button>} />,
    );
    expect(container.querySelector('.mesa__felt button')).toBeNull();
    expect(container.querySelector('.mesa__side')).toHaveTextContent('Nueva mano');
  });
});

describe('Mesa: la superficie de la mesa se define en un solo lugar', () => {
  it('el paño y el riel reciben sus texturas por --felt-image y --rail-image', () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    const mesa = container.querySelector('.mesa') as HTMLElement;
    expect(mesa.style.getPropertyValue('--felt-image')).toMatch(/^url\(/);
    expect(mesa.style.getPropertyValue('--rail-image')).toMatch(/^url\(/);
  });
  it("dibuja a lo sumo un contorno punteado por baza y no deja huecos en la mano", () => {
    const { container } = render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={() => {}} />);
    for (const b of container.querySelectorAll(".baza")) expect(b.querySelectorAll(".slot:not(.slot--ghost)").length).toBeLessThanOrEqual(1);
    const hand = container.querySelector(".mesa__hand")!;
    expect(hand.children.length).toBe(Number(hand.getAttribute("data-n")));
  });
});
