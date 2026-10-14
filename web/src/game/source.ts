import { useSyncExternalStore } from 'react';
import type { ActionId, TableView } from '../table/types';

/**
 * Contrato entre la UI y quien juega la partida.
 * Acá lo implementa un demo; el plan del motor lo implementará con un Web Worker + engine-wasm.
 * `subscribe` y `getView` deben ser funciones estables (no depender de `this`).
 */
export interface GameSource {
  getView(): TableView;
  subscribe(listener: () => void): () => void;
  dispatch(action: ActionId): void;
}

export function useGameView(source: GameSource): TableView {
  return useSyncExternalStore(source.subscribe, source.getView, source.getView);
}
