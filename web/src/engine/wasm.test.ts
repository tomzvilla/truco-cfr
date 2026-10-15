// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initSync, WasmMatch } from './pkg/truco_engine_wasm.js';
import { validateTableView } from '../table/validate';
import type { TableView } from '../table/types';
import { actionIndex } from '../table/types';
import { createSession } from './session';
import type { FromEngine } from './protocol';

initSync({ module: readFileSync(new URL('./pkg/truco_engine_wasm_bg.wasm', import.meta.url)) });
const model = readFileSync(new URL('../../../models/strategy.tcfrw', import.meta.url));

const parse = (json: string) => JSON.parse(json) as TableView;

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

it('la sesión juega un partido real de punta a punta', async () => {
  const posted: FromEngine[] = [];
  const handle = createSession({
    load: async (_url, seed) => new WasmMatch(model, seed),
    post: (m) => posted.push(m),
    think: async () => {},
  });
  await handle({ type: 'init', modelUrl: 'x', seed: 3 });
  for (let i = 0; i < 3000; i++) {
    const last = posted[posted.length - 1]!;
    if (last.type === 'error') throw new Error(last.message);
    const view = last.view;
    if (view.matchWinner) break;
    if (view.phase === 'finDeMano') await handle({ type: 'newHand' });
    else await handle({ type: 'act', action: view.actions[0]! });
  }
  const last = posted[posted.length - 1]!;
  expect(last.type === 'view' && last.view.matchWinner).toBeTruthy();
});
