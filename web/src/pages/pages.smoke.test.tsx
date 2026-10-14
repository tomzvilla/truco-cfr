import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { Mesa } from '../components/Mesa';
import { jcanabalSkin } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import { ROUTES } from '../router';

afterEach(() => vi.restoreAllMocks());

function silentConsole() {
  return {
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  };
}

describe('smoke: cada página renderiza sin errores ni advertencias de React', () => {
  it.each(ROUTES)('ruta %s', (route) => {
    const spies = silentConsole();
    window.location.hash = `#/${route}`;
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });
});

describe('smoke: la mesa con cada fixture', () => {
  it.each(FIXTURE_NAMES)('%s (jugable y en solo lectura)', (name) => {
    const spies = silentConsole();
    const { unmount } = render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    unmount();
    render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });
});
