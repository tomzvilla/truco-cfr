import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { App } from '../App';
import { ConfigDialog } from '../components/ConfigDialog';
import { resetSettings } from '../settings';
import { Jugar } from './Jugar';

beforeEach(() => resetSettings());

describe('Jugar (demo)', () => {
  it('avisa que es una demostración y muestra la mesa', () => {
    render(<Jugar />);
    expect(screen.getByRole('heading', { level: 1, name: 'Jugar' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/demostración/i);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
  });
  it('tocar una carta la juega y el turno pasa al bot', () => {
    render(<Jugar />);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(screen.queryByRole('button', { name: 'Jugar 7 de oros' })).toBeNull();
    expect(screen.getByText('El bot está pensando…')).toBeInTheDocument();
  });
  it('el modo rayos X (se prende en Configuración) ofrece un botón que abre y cierra el panel', () => {
    // Configuración vive en la barra de arriba (App), fuera de la mesa
    render(
      <>
        <ConfigDialog icon />
        <Jugar />
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
  it('"Nueva mano" (desde el menú de arriba) restaura el inicio y ninguna herramienta queda dentro de la mesa', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Mesa' }).querySelector('.mesa__tools')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(screen.queryByRole('button', { name: 'Jugar 7 de oros' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva mano' }));
    expect(screen.getByRole('button', { name: 'Jugar 7 de oros' })).toBeInTheDocument();
  });
});

describe('Jugar (celular)', () => {
  it('el título se oculta solo en pantallas angostas pero sigue para lectores de pantalla', () => {
    render(<Jugar />);
    expect(screen.getByRole('heading', { level: 1, name: 'Jugar' })).toHaveClass('title-sr-narrow');
  });
  it('el aviso de demo es corto (una línea en 360 px)', () => {
    render(<Jugar />);
    expect((screen.getByRole('note').textContent ?? '').length).toBeLessThanOrEqual(40);
  });
});
