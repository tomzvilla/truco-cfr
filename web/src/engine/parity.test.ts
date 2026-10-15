// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initSync, WasmMatch } from './pkg/truco_engine_wasm.js';
import fixture from './parity-fixture.json';

initSync({ module: readFileSync(new URL('./pkg/truco_engine_wasm_bg.wasm', import.meta.url)) });
const model = readFileSync(new URL('../../../models/strategy.tcfrw', import.meta.url));

it('el WASM da los mismos logits que PyTorch (|Δ| < 1e-4)', () => {
  const m = new WasmMatch(model, 0);
  const x = Uint8Array.from(fixture.inputs.flat());
  const got = m.logits(x);
  const want = fixture.logits.flat();
  expect(got.length).toBe(want.length);
  let worst = 0;
  want.forEach((w, i) => {
    worst = Math.max(worst, Math.abs(got[i]! - w));
  });
  expect(worst).toBeLessThan(1e-4);
});
