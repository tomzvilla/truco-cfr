import { FIXTURES } from '../table/fixtures';
import type { EnginePort, FromEngine, ToEngine } from './protocol';
import { createEngineSource, modelUrl } from './engineSource';

class FakePort implements EnginePort {
  sent: ToEngine[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<FromEngine>) => void) | null = null;
  postMessage(m: ToEngine) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  emit(m: FromEngine) {
    this.onmessage?.({ data: m } as MessageEvent<FromEngine>);
  }
}

describe('createEngineSource', () => {
  it('arranca cargando, inicia el Worker al suscribirse y pasa a listo', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 42);
    expect(src.getSnapshot()).toEqual({ status: 'cargando' });
    const off = src.subscribe(() => {});
    expect(sent[0]).toMatchObject({ type: 'init', seed: 42 });
    port.emit({ type: 'view', view: FIXTURES.inicioDeMano });
    expect(src.getSnapshot()).toEqual({ status: 'listo', view: FIXTURES.inicioDeMano });
    off();
    expect(port.terminated).toBe(true);
  });

  it('solo manda jugadas legales', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 1);
    src.subscribe(() => {});
    src.dispatch('jugar0'); // todavía cargando
    port.emit({ type: 'view', view: { ...FIXTURES.inicioDeMano, actions: ['jugar1'] } });
    src.dispatch('jugar0');
    src.dispatch('jugar1');
    expect(sent.filter((m) => m.type === 'act')).toEqual([{ type: 'act', action: 'jugar1' }]);
  });

  it('error y reintentar', () => {
    const ports = [new FakePort(), new FakePort()];
    let n = 0;
    const src = createEngineSource(() => ports[n++]!, () => 1);
    src.subscribe(() => {});
    ports[0]!.emit({ type: 'error', message: 'HTTP 404' });
    expect(src.getSnapshot()).toEqual({ status: 'error', message: 'HTTP 404' });
    src.retry();
    expect(ports[0]!.terminated).toBe(true);
    expect(src.getSnapshot()).toEqual({ status: 'cargando' });
    expect(ports[1]!.sent[0]).toMatchObject({ type: 'init' });
  });

  it('nueva mano y nuevo partido', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 5);
    src.subscribe(() => {});
    port.emit({ type: 'view', view: FIXTURES.finDeManoRayosX });
    src.newHand();
    src.newMatch();
    expect(sent.slice(1)).toEqual([{ type: 'newHand' }, { type: 'newMatch', seed: 5 }]);
  });

  it('modelUrl con base relativa', () => {
    expect(modelUrl('./', 'https://x.github.io/truco-cfr/index.html')).toBe(
      'https://x.github.io/truco-cfr/models/strategy.tcfrw',
    );
    expect(modelUrl('/', 'http://localhost:5173/')).toBe('http://localhost:5173/models/strategy.tcfrw');
  });
});
