import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Ancho real en px (clientWidth) del elemento, re-medido con ResizeObserver y al cambiar la ventana.
 * `fallback` se usa mientras no hay medida (SSR, o jsdom donde clientWidth es 0).
 */
export function useElementWidth<T extends HTMLElement>(fallback = 360): [number, RefObject<T | null>] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);
  return [width, ref];
}
