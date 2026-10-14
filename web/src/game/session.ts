import { useSyncExternalStore } from 'react';

/**
 * Puente entre la partida en pantalla y los botones que viven fuera de la mesa (menú, barra superior): quien muestra
 * la partida registra acá cómo empezar una mano nueva; el resto solo lo consulta.
 */
let handler: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function registerNewHand(fn: () => void): () => void {
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

/** La función para empezar una mano nueva, o `null` si no hay partida en pantalla. */
export function useNewHand(): (() => void) | null {
  return useSyncExternalStore(subscribe, () => handler, () => null);
}
