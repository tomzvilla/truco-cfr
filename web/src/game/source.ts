import { useSyncExternalStore } from 'react';
import type { ActionId, TableView } from '../table/types';

export type GameSnapshot =
  | { status: 'cargando' }
  | { status: 'error'; message: string }
  | { status: 'listo'; view: TableView };

/**
 * Contrato entre la UI y quien juega la partida (en la web: un Worker con el motor en WASM).
 * Todas las funciones tienen que ser estables (no depender de `this`).
 */
export interface GameSource {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  /** Una jugada del humano. Si no está en `view.actions`, se ignora. */
  dispatch(action: ActionId): void;
  /** Reparte la mano siguiente; solo tiene efecto con la mano terminada y el partido en juego. */
  newHand(): void;
  /** Partido nuevo desde 0 a 0, en cualquier momento. */
  newMatch(): void;
  /** Vuelve a cargar el motor después de un error. */
  retry(): void;
}

export function useGame(source: GameSource): GameSnapshot {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
