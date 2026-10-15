import type { GameSnapshot, GameSource } from '../game/source';
import type { ActionId } from '../table/types';

export interface FakeSource extends GameSource {
  set(s: GameSnapshot): void;
  /** Lo que se llamó, en orden: 'act:jugar0', 'newHand', 'newMatch', 'retry'. */
  calls: string[];
}

export function createFakeSource(initial: GameSnapshot): FakeSource {
  let snap = initial;
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  return {
    calls,
    set(s) {
      snap = s;
      listeners.forEach((l) => l());
    },
    getSnapshot: () => snap,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    dispatch: (a: ActionId) => {
      calls.push(`act:${a}`);
    },
    newHand: () => {
      calls.push('newHand');
    },
    newMatch: () => {
      calls.push('newMatch');
    },
    retry: () => {
      calls.push('retry');
    },
  };
}
