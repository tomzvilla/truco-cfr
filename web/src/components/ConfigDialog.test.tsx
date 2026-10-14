import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings, resetSettings } from '../settings';
import { ConfigDialog } from './ConfigDialog';
import { PixelSegmented } from './PixelSegmented';
import { PixelSwitch } from './PixelSwitch';

beforeEach(() => resetSettings());

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
  return screen.getByRole('dialog', { name: 'Configuración' });
};

function SwitchHarness() {
  const [on, setOn] = useState(false);
  return <PixelSwitch label="Filtro CRT" checked={on} onChange={setOn} />;
}

describe('PixelSwitch', () => {
  it('es un role="switch" con aria-checked que alterna con click, Espacio y Enter', async () => {
    render(<SwitchHarness />);
    const sw = screen.getByRole('switch', { name: /Filtro CRT/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{Enter}');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

const OPTIONS = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
  { value: 'c', label: 'Tres' },
];

function SegHarness({ log }: { log: string[] }) {
  const [v, setV] = useState('a');
  return (
    <PixelSegmented
      label="Cosas"
      value={v}
      options={OPTIONS}
      onChange={(x) => {
        log.push(x);
        setV(x);
      }}
    />
  );
}

describe('PixelSegmented', () => {
  it('es un radiogroup: una sola opción marcada y con tabindex 0', () => {
    render(<PixelSegmented label="Cosas" value="b" options={OPTIONS} onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Cosas' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });
  it('las flechas mueven la selección y el foco (y dan la vuelta); Inicio y Fin saltan a los extremos', async () => {
    const seen: string[] = [];
    render(<SegHarness log={seen} />);
    screen.getByRole('radio', { name: 'Uno' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(seen.at(-1)).toBe('b');
    expect(screen.getByRole('radio', { name: 'Dos' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(seen.at(-1)).toBe('c'); // da la vuelta
    await userEvent.keyboard('{Home}');
    expect(seen.at(-1)).toBe('a');
    await userEvent.keyboard('{End}');
    expect(seen.at(-1)).toBe('c');
  });
});

describe('ConfigDialog', () => {
  it('empieza cerrado y el botón "Configuración" lo abre', async () => {
    render(<ConfigDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const d = await open();
    expect(d).toHaveAttribute('aria-modal', 'true');
  });
  it('tiene Modo rayos X, Filtro CRT y Animaciones, sin controles nativos', async () => {
    render(<ConfigDialog />);
    const d = await open();
    expect(within(d).getByRole('switch', { name: /Modo rayos X/ })).toBeInTheDocument();
    expect(within(d).getByRole('switch', { name: /Filtro CRT/ })).toBeInTheDocument();
    const group = within(d).getByRole('radiogroup', { name: 'Animaciones' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Según el sistema', 'Completas', 'Reducidas']);
    expect(document.querySelector('select')).toBeNull();
    expect(document.querySelector('input[type=checkbox]')).toBeNull();
  });
  it('los controles cambian y persisten las preferencias', async () => {
    render(<ConfigDialog />);
    const d = await open();
    await userEvent.click(within(d).getByRole('switch', { name: /Modo rayos X/ }));
    await userEvent.click(within(d).getByRole('switch', { name: /Filtro CRT/ }));
    await userEvent.click(within(d).getByRole('radio', { name: 'Reducidas' }));
    expect(getSettings()).toMatchObject({ xray: true, crt: true, motion: 'reduced' });
    expect(localStorage.getItem('truco-cfr.settings.v1')).toContain('"xray":true');
    expect(within(d).getByRole('switch', { name: /Filtro CRT/ })).toHaveAttribute('aria-checked', 'true');
  });
  it('Esc lo cierra y el foco vuelve al botón', async () => {
    render(<ConfigDialog />);
    await open();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Configuración' })).toHaveFocus();
  });
  it('"Cerrar" y el fondo oscuro también lo cierran', async () => {
    render(<ConfigDialog />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await open();
    await userEvent.click(document.querySelector('.config__backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('al abrir el foco entra al panel y Tab no se escapa: da la vuelta', async () => {
    render(<ConfigDialog />);
    const d = await open();
    expect(d.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(d.contains(document.activeElement), `tab ${i}`).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await userEvent.tab({ shift: true });
      expect(d.contains(document.activeElement), `shift+tab ${i}`).toBe(true);
    }
  });
});
