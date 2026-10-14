import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings } from '../settings';
import { CrtOverlay } from './CrtOverlay';
import { SettingsToggles } from './SettingsToggles';

describe('SettingsToggles', () => {
  it('el checkbox CRT actualiza y persiste la preferencia', async () => {
    render(<SettingsToggles />);
    await userEvent.click(screen.getByLabelText('Filtro CRT'));
    expect(getSettings().crt).toBe(true);
    expect(localStorage.getItem('truco-cfr.settings.v1')).toContain('"crt":true');
  });
  it('el selector de animaciones ofrece las tres opciones', async () => {
    render(<SettingsToggles />);
    await userEvent.selectOptions(screen.getByLabelText('Animaciones'), 'reduced');
    expect(getSettings().motion).toBe('reduced');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});

describe('CrtOverlay', () => {
  it('solo se dibuja si está encendido y no captura clicks', () => {
    const { container, rerender } = render(<CrtOverlay on={false} />);
    expect(container.firstChild).toBeNull();
    rerender(<CrtOverlay on />);
    expect(container.firstChild).toHaveClass('crt');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
