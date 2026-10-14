import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDevicePixelRatio, useMediaQuery } from './useViewport';

type Listener = () => void;

/** matchMedia falso: guarda los listeners por consulta y deja disparar "change" a mano. */
function fakeMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<Listener>>();
  const asked: string[] = [];
  window.matchMedia = ((query: string) => {
    asked.push(query);
    return {
      get matches() { return state[query] ?? false; },
      media: query,
      addEventListener: (_: string, l: Listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(l);
      },
      removeEventListener: (_: string, l: Listener) => listeners.get(query)?.delete(l),
    };
  }) as unknown as typeof window.matchMedia;
  return {
    asked,
    set(query: string, value: boolean) {
      state[query] = value;
      listeners.get(query)?.forEach((l) => l());
    },
    count: (query: string) => listeners.get(query)?.size ?? 0,
  };
}

afterEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
});

describe('useMediaQuery', () => {
  it('lee el valor actual y se actualiza cuando cambia', () => {
    const mm = fakeMatchMedia({ '(max-width: 519.98px)': true });
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 519.98px)'));
    expect(result.current).toBe(true);
    act(() => mm.set('(max-width: 519.98px)', false));
    expect(result.current).toBe(false);
    unmount();
    expect(mm.count('(max-width: 519.98px)')).toBe(0);
  });
});

describe('useDevicePixelRatio', () => {
  it('devuelve el dpr y lo re-lee cuando el navegador avisa que cambió (zoom o mover de monitor)', () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    const mm = fakeMatchMedia({});
    const { result } = renderHook(() => useDevicePixelRatio());
    expect(result.current).toBe(2);
    expect(mm.asked).toContain('(resolution: 2dppx)');

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    act(() => mm.set('(resolution: 2dppx)', false)); // el listener se dispara
    expect(result.current).toBe(3);
    // ahora escucha el nuevo valor y soltó el viejo
    expect(mm.asked).toContain('(resolution: 3dppx)');
    expect(mm.count('(resolution: 2dppx)')).toBe(0);
  });
  it('sin matchMedia no se rompe', () => {
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useDevicePixelRatio());
    expect(result.current).toBe(1);
  });
});
