/** AudioContext falso para probar el motor de sonido en jsdom: registra qué se creó y cuándo se agendó. */
export class FakeParam {
  value = 0;
  calls: { fn: string; v: number; t: number }[] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'set', v, t });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'lin', v, t });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push({ fn: 'exp', v, t });
    return this;
  }
}

export class FakeNode {
  connections: unknown[] = [];
  connect(n: unknown) {
    this.connections.push(n);
    return n;
  }
  disconnect() {}
}

export class FakeGain extends FakeNode {
  gain = new FakeParam();
}

export class FakeFilter extends FakeNode {
  type = '';
  frequency = new FakeParam();
  Q = new FakeParam();
}

export class FakeOsc extends FakeNode {
  type = '';
  frequency = new FakeParam();
  starts: number[] = [];
  stops: number[] = [];
  start(t: number) {
    this.starts.push(t);
  }
  stop(t: number) {
    this.stops.push(t);
  }
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  starts: number[] = [];
  stops: number[] = [];
  start(t: number) {
    this.starts.push(t);
  }
  stop(t: number) {
    this.stops.push(t);
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' = 'suspended';
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscs: FakeOsc[] = [];
  filters: FakeFilter[] = [];
  sources: FakeSource[] = [];
  resumed = 0;
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createBiquadFilter() {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
}

/** Timers manuales: `runNext()` dispara el timer pendiente, sin esperar tiempo real. */
export class FakeTimers {
  pending: { id: number; fn: () => void; ms: number }[] = [];
  private n = 0;
  set = (fn: () => void, ms: number) => {
    const id = ++this.n;
    this.pending.push({ id, fn, ms });
    return id;
  };
  clear = (id: unknown) => {
    this.pending = this.pending.filter((p) => p.id !== id);
  };
  runNext(): boolean {
    const p = this.pending.shift();
    if (!p) return false;
    p.fn();
    return true;
  }
}
