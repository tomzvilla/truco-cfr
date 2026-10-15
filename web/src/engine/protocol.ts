import type { ActionId, TableView } from '../table/types';

/** De la página al Worker del motor. */
export type ToEngine =
  | { type: 'init'; modelUrl: string; seed: number }
  | { type: 'act'; action: ActionId }
  | { type: 'newHand' }
  | { type: 'newMatch'; seed: number };

/** Del Worker a la página. */
export type FromEngine = { type: 'view'; view: TableView } | { type: 'error'; message: string };

/** Lo que la página usa de un Worker (en los tests, un objeto falso). */
export interface EnginePort {
  postMessage(msg: ToEngine): void;
  onmessage: ((e: MessageEvent<FromEngine>) => void) | null;
  terminate(): void;
}
