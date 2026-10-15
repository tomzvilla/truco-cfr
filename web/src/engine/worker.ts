import init, { WasmMatch } from './pkg/truco_engine_wasm.js';
import type { FromEngine, ToEngine } from './protocol';
import { createSession } from './session';

const THINK_MIN_MS = 400;
const THINK_MAX_MS = 900;

// El tsconfig no carga los tipos de WebWorker (chocan con los del DOM): lo mínimo que se usa.
const ctx = self as unknown as {
  postMessage(msg: FromEngine): void;
  onmessage: ((e: MessageEvent<ToEngine>) => void) | null;
};

const handle = createSession({
  async load(modelUrl, seed) {
    await init();
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`No se pudo bajar el modelo (HTTP ${res.status})`);
    return new WasmMatch(new Uint8Array(await res.arrayBuffer()), seed);
  },
  post: (msg) => ctx.postMessage(msg),
  think: () => new Promise((r) => setTimeout(r, THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS))),
});

ctx.onmessage = (e) => {
  void handle(e.data);
};
