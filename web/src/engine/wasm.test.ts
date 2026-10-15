// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initSync, WasmMatch } from './pkg/truco_engine_wasm.js';
import { validateTableView } from '../table/validate';
import type { TableView } from '../table/types';
import { actionIndex } from '../table/types';

initSync({ module: readFileSync(new URL('./pkg/truco_engine_wasm_bg.wasm', import.meta.url)) });
const model = readFileSync(new URL('../../../models/strategy.tcfrw', import.meta.url));

// matchWinner todavía no está en el tipo TableView de la web (lo suma la Tarea 3).
type View = TableView & { matchWinner?: string | null };
const parse = (json: string) => JSON.parse(json) as View;

describe('WasmMatch', () => {
  it('juega un partido entero con vistas válidas', () => {
    const m = new WasmMatch(model, 7);
    let view = parse(m.view());
    let steps = 0;
    for (;;) {
      expect(validateTableView(view)).toEqual([]);
      if (m.botToMove()) view = parse(m.botStep());
      else if (view.phase === 'finDeMano') {
        if (view.matchWinner) break;
        view = parse(m.newHand());
      } else view = parse(m.act(actionIndex(view.actions[0]!)));
      steps += 1;
      expect(steps).toBeLessThan(5000);
    }
    expect(view.score).toContain(30);
    expect(() => m.newHand()).toThrow();
    m.free();
  });

  it('cada jugada del bot tarda menos de 300 ms', () => {
    const m = new WasmMatch(model, 8);
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const view = parse(m.view());
      if (m.botToMove()) {
        const t = performance.now();
        m.botStep();
        worst = Math.max(worst, performance.now() - t);
      } else if (view.phase === 'finDeMano') {
        if (view.matchWinner) m.newMatch(i);
        else m.newHand();
      } else m.act(actionIndex(view.actions[0]!));
    }
    expect(worst).toBeLessThan(300);
  });

  it('rechaza un modelo inválido', () => {
    expect(() => new WasmMatch(new Uint8Array([1, 2, 3]), 0)).toThrow();
  });
});
