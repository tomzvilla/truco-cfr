import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jcanabalSkin } from '../skins';
import { mockMatchMedia } from '../test/helpers';
import { PixelCard } from './PixelCard';

const card = { suit: 'espada', number: 1 } as const;
const other = { suit: 'oro', number: 7 } as const;

describe('PixelCard', () => {
  it('muestra la cara con alt en español y tamaño entero (escala 2)', () => {
    render(<PixelCard card={card} skin={jcanabalSkin} scale={2} variant="hand" />);
    const img = screen.getByAltText('1 de espadas');
    expect(img).toHaveAttribute('width', '146');
    expect(img).toHaveAttribute('height', '226');
    expect(img.getAttribute('src')).toMatch(/cards\/jcanabal\/espada-1\.png$/);
  });
  it('escala fraccionaria (dpr 3): 4/3 da píxeles CSS fraccionarios pero físicos enteros', () => {
    render(<PixelCard card={card} skin={jcanabalSkin} scale={4 / 3} variant="hand" />);
    const w = Number(screen.getByAltText('1 de espadas').getAttribute('width'));
    expect(w).toBeCloseTo(73 * (4 / 3), 5);
    expect(Math.round(w * 3 * 1e6) / 1e6).toBe(292);
  });
  it('card null dibuja el dorso', () => {
    render(<PixelCard card={null} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(screen.getByAltText('Carta boca abajo').getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
  it('si la imagen falla, muestra el nombre de la carta y sigue siendo jugable', async () => {
    const onPlay = vi.fn();
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" onPlay={onPlay} />);
    fireEvent.error(screen.getByAltText('1 de espadas'));
    expect(screen.getByText('1 de espadas')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Jugar 1 de espadas' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
  it('después de una carta rota, la carta siguiente vuelve a mostrar su imagen', () => {
    const { rerender } = render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" />);
    fireEvent.error(screen.getByAltText('1 de espadas'));
    expect(screen.queryByAltText('1 de espadas')).toBeNull();
    rerender(<PixelCard card={other} skin={jcanabalSkin} scale={1} variant="hand" />);
    expect(screen.getByAltText('7 de oros').getAttribute('src')).toMatch(/oro-7\.png$/);
  });
  it('deshabilitada no dispara onPlay', async () => {
    const onPlay = vi.fn();
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" onPlay={onPlay} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(onPlay).not.toHaveBeenCalled();
  });
  it('sin onPlay no es un botón', () => {
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('con animaciones reducidas no se balancea ni hace pop', () => {
    mockMatchMedia(true);
    const { container, rerender } = render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" />);
    expect(container.firstElementChild).toHaveAttribute('data-idle', 'false');
    rerender(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(container.firstElementChild).toHaveAttribute('data-enter', 'false');
  });
  it('con animaciones completas la carta de la mano se balancea', () => {
    const { container } = render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" />);
    expect(container.firstElementChild).toHaveAttribute('data-idle', 'true');
  });
});
