import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings } from '../settings';
import { ConfigDialog } from './ConfigDialog';

describe('Configuración: sonido', () => {
  it('Música y Efectos son interruptores y el volumen una elección Bajo / Medio / Alto, todo persistido', async () => {
    render(<ConfigDialog />);
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    const dialog = screen.getByRole('dialog', { name: 'Configuración' });

    const music = within(dialog).getByRole('switch', { name: /Música/ });
    const sfx = within(dialog).getByRole('switch', { name: /Efectos/ });
    expect(music).toHaveAttribute('aria-checked', 'true');
    expect(sfx).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(music);
    await userEvent.click(sfx);
    expect(getSettings().music).toBe(false);
    expect(getSettings().sfx).toBe(false);

    const vol = within(dialog).getByRole('radiogroup', { name: 'Volumen' });
    expect(within(vol).getByRole('radio', { name: 'Medio' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(vol).getByRole('radio', { name: 'Alto' }));
    expect(getSettings().volume).toBe('high');
    await userEvent.click(within(vol).getByRole('radio', { name: 'Bajo' }));
    expect(getSettings().volume).toBe('low');
    expect(window.localStorage.getItem('truco-cfr.settings.v1')).toContain('"volume":"low"');
  });

  it('con icon el botón es solo un engranaje con nombre accesible', () => {
    render(<ConfigDialog icon />);
    const btn = screen.getByRole('button', { name: 'Configuración' });
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
