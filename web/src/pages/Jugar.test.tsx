import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigDialog } from '../components/ConfigDialog';
import { Nav } from '../components/Nav';
import { useNewMatch } from '../game/session';
import { resetSettings } from '../settings';
import { FIXTURES } from '../table/fixtures';
import { createFakeSource } from '../test/fakeSource';
import { Jugar } from './Jugar';

beforeEach(() => resetSettings());

const listo = () => createFakeSource({ status: 'listo', view: FIXTURES.inicioDeMano });

describe('Jugar', () => {
  it('cargando', () => {
    render(<Jugar source={createFakeSource({ status: 'cargando' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('cargando el bot');
  });

  it('error y reintentar', async () => {
    const src = createFakeSource({ status: 'error', message: 'HTTP 404' });
    render(<Jugar source={src} />);
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(src.calls).toEqual(['retry']);
  });

  it('listo: la mesa juega con el motor', async () => {
    const src = createFakeSource({ status: 'cargando' });
    render(<Jugar source={src} />);
    act(() => src.set({ status: 'listo', view: FIXTURES.inicioDeMano }));
    await userEvent.click(screen.getAllByRole('button', { name: /truco/i })[0]!);
    expect(src.calls).toContain('act:truco');
    expect(screen.queryByText(/Modo demostración/)).toBeNull();
  });

  it('fin de partido ofrece nuevo partido', async () => {
    const src = createFakeSource({
      status: 'listo',
      view: { ...FIXTURES.finDeManoRayosX, score: [30, 9], matchWinner: 'yo', result: { yo: 3, bot: 0, winner: 'yo' } },
    });
    render(<Jugar source={src} />);
    expect(screen.getByText('¡Ganaste el partido!')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo partido' })[0]!);
    expect(src.calls).toContain('newMatch');
  });

  it('fin de mano con el partido en juego ofrece nueva mano', async () => {
    const src = createFakeSource({ status: 'listo', view: FIXTURES.finDeManoRayosX });
    render(<Jugar source={src} />);
    expect(screen.getByText('Ganó el bot: +1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nueva mano' }));
    expect(src.calls).toContain('newHand');
  });

  it('muestra el título y la mesa', () => {
    render(<Jugar source={listo()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Jugar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
  });

  it('tocar una carta manda la jugada a la fuente', () => {
    const src = listo();
    render(<Jugar source={src} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(src.calls).toEqual(['act:jugar1']);
  });

  it('el modo rayos X (se prende en Configuración) ofrece un botón que abre y cierra el panel', () => {
    // Configuración vive en la barra de arriba (App), fuera de la mesa
    render(
      <>
        <ConfigDialog icon />
        <Jugar source={listo()} />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Rayos X' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    fireEvent.click(screen.getByRole('switch', { name: /Modo rayos X/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('region', { name: 'Rayos X del bot' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rayos X' }));
    expect(screen.getByRole('region', { name: 'Rayos X del bot' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar rayos X' }));
    expect(screen.queryByRole('region', { name: 'Rayos X del bot' })).toBeNull();
  });

  it('"Nuevo partido" (desde el menú de arriba) llega a la fuente y ninguna herramienta queda dentro de la mesa', () => {
    function Top() {
      const newMatch = useNewMatch();
      return <Nav route="jugar" onNewMatch={newMatch} />;
    }
    const src = listo();
    render(
      <>
        <Top />
        <Jugar source={src} />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Mesa' }).querySelector('.mesa__tools')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo partido' }));
    expect(src.calls).toContain('newMatch');
  });

  it('el título se oculta solo en pantallas angostas pero sigue para lectores de pantalla', () => {
    render(<Jugar source={listo()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Jugar' })).toHaveClass('title-sr-narrow');
  });
});
