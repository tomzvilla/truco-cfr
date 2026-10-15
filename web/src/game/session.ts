import { useSyncExternalStore } from 'react';

/**
 * Puente entre la partida en pantalla y los botones que viven fuera de la mesa (menú, barra superior): quien muestra
 * la partida registra acá cómo empezar un partido nuevo; el resto solo lo consulta.
 */
let handler: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function registerNewMatch(fn: () => void): () => void {
  handler = fn;
  emit();
  return () => {
    if (handler === fn) {
      handler = null;
      emit();
    }
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** La función para empezar un partido nuevo, o `null` si no hay partida en pantalla. */
export function useNewMatch(): (() => void) | null {
  return useSyncExternalStore(subscribe, () => handler, () => null);
}
