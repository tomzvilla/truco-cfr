import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSettings, parseSettings, updateSettings } from './settings';
import { mockMatchMedia } from './test/helpers';

const DEFAULTS = { crt: false, motion: 'auto', xray: false };

describe('parseSettings', () => {
  it('ante basura devuelve los valores por defecto', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{"crt":"si","motion":42}']) {
      expect(parseSettings(raw)).toEqual(DEFAULTS);
    }
  });
  it('lee valores válidos', () => {
    expect(parseSettings('{"crt":true,"motion":"reduced","xray":true}')).toEqual({ crt: true, motion: 'reduced', xray: true });
  });
});

describe('persistencia', () => {
  afterEach(() => vi.restoreAllMocks());

  it('guarda en localStorage y notifica', () => {
    updateSettings({ crt: true });
    expect(getSettings().crt).toBe(true);
    expect(JSON.parse(localStorage.getItem('truco-cfr.settings.v1')!)).toMatchObject({ crt: true });
  });
  it('si localStorage.setItem tira excepción, sigue funcionando en memoria', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => updateSettings({ motion: 'full' })).not.toThrow();
    expect(getSettings().motion).toBe('full');
  });
  it('si localStorage.getItem tira excepción al cargar, arranca con los valores por defecto', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.resetModules();
    const fresh = await import('./settings');
    expect(fresh.getSettings()).toEqual(DEFAULTS);
    expect(() => fresh.updateSettings({ crt: true })).not.toThrow();
    expect(fresh.getSettings().crt).toBe(true);
  });
});

describe('data-motion en <html>', () => {
  it('sigue a la preferencia de animaciones', () => {
    expect(document.documentElement.dataset.motion).toBe('auto');
    updateSettings({ motion: 'reduced' });
    expect(document.documentElement.dataset.motion).toBe('reduced');
    updateSettings({ motion: 'full' });
    expect(document.documentElement.dataset.motion).toBe('full');
  });
  it('data-reduced combina la elección del usuario con la preferencia del sistema', () => {
    const reduced = () => document.documentElement.dataset.reduced;
    expect(reduced()).toBe('false');
    updateSettings({ motion: 'reduced' });
    expect(reduced()).toBe('true');
    mockMatchMedia(true);
    updateSettings({ motion: 'auto' });
    expect(reduced()).toBe('true');
    updateSettings({ motion: 'full' });
    expect(reduced()).toBe('false');
  });
});
