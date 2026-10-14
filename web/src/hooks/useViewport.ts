import { useEffect, useState, useSyncExternalStore } from 'react';

/** Pantallas angostas: debe coincidir con el breakpoint de 520 px de los CSS. */
export const NARROW_QUERY = '(max-width: 519.98px)';

/** `matchMedia` si existe (jsdom o navegadores muy viejos no lo tienen). */
function mq(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = mq(query);
      list?.addEventListener?.('change', onChange);
      return () => list?.removeEventListener?.('change', onChange);
    },
    () => mq(query)?.matches ?? false,
    () => false,
  );
}

/**
 * Densidad de pantalla actual. Cambia con el zoom del navegador o al mover la ventana a otro monitor, y no hay evento
 * directo: se escucha la consulta `(resolution: <dpr>dppx)` del valor actual y, cuando deja de cumplirse, se re-lee.
 */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    const list = mq(`(resolution: ${dpr}dppx)`);
    if (!list) return;
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [dpr]);
  return dpr;
}
