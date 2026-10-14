import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings } from '../settings';
import { MuteButton } from './MuteButton';

describe('MuteButton', () => {
  it('alterna aria-pressed y el nombre accesible, y persiste en localStorage', async () => {
    render(<MuteButton />);
    const btn = screen.getByRole('button', { name: 'Silenciar' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    const off = screen.getByRole('button', { name: 'Activar sonido' });
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(getSettings().muted).toBe(true);
    expect(window.localStorage.getItem('truco-cfr.settings.v1')).toContain('"muted":true');
    await userEvent.click(off);
    expect(screen.getByRole('button', { name: 'Silenciar' })).toHaveAttribute('aria-pressed', 'false');
    expect(getSettings().muted).toBe(false);
  });
});
