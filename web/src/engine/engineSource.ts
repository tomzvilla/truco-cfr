import type { GameSnapshot, GameSource } from '../game/source';
import type { ActionId } from '../table/types';
import type { EnginePort, FromEngine } from './protocol';

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/**
 * URL absoluta del modelo. El Worker vive en assets/, así que una ruta relativa se resolvería mal
 * ahí adentro: se resuelve acá, contra la página.
 */
export function modelUrl(base: string = import.meta.env.BASE_URL, page: string = document.baseURI): string {
  return new URL(`${base}models/strategy.tcfrw`, page).href;
}

/** La partida contra el motor en WASM. El Worker arranca con el primer suscriptor y se cierra con el último. */
export function createEngineSource(makePort: () => EnginePort, seed: () => number = randomSeed): GameSource {
  let snap: GameSnapshot = { status: 'cargando' };
  let port: EnginePort | null = null;
  const listeners = new Set<() => void>();

  const set = (s: GameSnapshot) => {
    snap = s;
    listeners.forEach((l) => l());
  };

  const start = () => {
    port?.terminate();
    const p = makePort();
    port = p;
    p.onmessage = (e: MessageEvent<FromEngine>) => {
      if (port !== p) return; // mensaje de un Worker viejo
      const msg = e.data;
      set(msg.type === 'view' ? { status: 'listo', view: msg.view } : { status: 'error', message: msg.message });
    };
    p.postMessage({ type: 'init', modelUrl: modelUrl(), seed: seed() });
  };

  const stop = () => {
    port?.terminate();
    port = null;
  };

  return {
    getSnapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      if (!port) {
        snap = { status: 'cargando' };
        start();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    dispatch(action: ActionId) {
      if (snap.status === 'listo' && snap.view.actions.includes(action)) port?.postMessage({ type: 'act', action });
    },
    newHand() {
      if (snap.status === 'listo') port?.postMessage({ type: 'newHand' });
    },
    newMatch() {
      if (snap.status === 'listo') port?.postMessage({ type: 'newMatch', seed: seed() });
    },
    retry() {
      set({ status: 'cargando' });
      start();
    },
  };
}
