import type { Volume } from '../settings';

/** Ganancia maestra por nivel de volumen. */
export const VOLUME_GAIN: Record<Volume, number> = { low: 0.25, mid: 0.5, high: 0.85 };

export interface AudioPrefs {
  muted: boolean;
  music: boolean;
  sfx: boolean;
  volume: Volume;
}

export const DEFAULT_PREFS: AudioPrefs = { muted: false, music: true, sfx: true, volume: 'mid' };

export type Bus = 'music' | 'sfx';

export interface ToneOptions {
  bus: Bus;
  type: OscillatorType;
  freq: number;
  /** Si está, la frecuencia se desliza hasta este valor durante la nota. */
  freqEnd?: number;
  start: number;
  dur: number;
  gain: number;
  attack?: number;
  release?: number;
  /** Vibrato suave: `rate` en Hz y `depth` en Hz de desvío. */
  vibrato?: { rate: number; depth: number };
}

export interface NoiseOptions {
  bus: Bus;
  start: number;
  dur: number;
  gain: number;
  /** Filtro pasa-altos (Hz). */
  hp?: number;
  /** Filtro pasa-bandas (Hz). */
  bp?: number;
  /** Filtro pasa-bajos (Hz). */
  lp?: number;
}

type CtxFactory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Todo el sonido del sitio sale de acá y está sintetizado con Web Audio (nada de archivos de audio).
 * Cadena: buses de música y efectos -> filtro pasa-bajos "lo-fi" -> ganancia maestra -> salida.
 * El AudioContext se crea recién en el primer gesto del usuario (`unlock`), por la política de autoplay.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  lofi: BiquadFilterNode | null = null;
  private prefs: AudioPrefs = { ...DEFAULT_PREFS };
  private noiseBuf: AudioBuffer | null = null;

  constructor(private readonly factory: CtxFactory = defaultFactory) {}

  get ready(): boolean {
    return this.ctx !== null;
  }

  getPrefs(): AudioPrefs {
    return this.prefs;
  }

  /** Crea (una sola vez) y reanuda el contexto. Devuelve si hay audio disponible. */
  unlock(): boolean {
    if (!this.ctx) {
      let ctx: AudioContext | null = null;
      try {
        ctx = this.factory();
      } catch {
        ctx = null;
      }
      if (!ctx) return false;
      this.ctx = ctx;
      this.lofi = ctx.createBiquadFilter();
      this.lofi.type = 'lowpass';
      this.lofi.frequency.value = 5200;
      this.lofi.Q.value = 0.5;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.lofi);
      this.sfxBus.connect(this.lofi);
      this.lofi.connect(this.master);
      this.master.connect(ctx.destination);
      this.applyPrefs();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume?.();
    return true;
  }

  setPrefs(p: AudioPrefs): void {
    this.prefs = { ...p };
    this.applyPrefs();
  }

  private applyPrefs(): void {
    if (!this.master || !this.musicBus || !this.sfxBus) return;
    const p = this.prefs;
    this.master.gain.value = p.muted ? 0 : VOLUME_GAIN[p.volume];
    this.musicBus.gain.value = p.music ? 1 : 0;
    this.sfxBus.gain.value = p.sfx ? 1 : 0;
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private bus(b: Bus): GainNode {
    return (b === 'music' ? this.musicBus : this.sfxBus)!;
  }

  /** Una nota con envolvente (ataque corto, sostén, caída). */
  tone(o: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const attack = o.attack ?? 0.005;
    const release = o.release ?? 0.04;
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, o.start);
    if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.start + o.dur);
    g.gain.setValueAtTime(0, o.start);
    g.gain.linearRampToValueAtTime(o.gain, o.start + attack);
    g.gain.setValueAtTime(o.gain, Math.max(o.start + attack, o.start + o.dur - release));
    g.gain.linearRampToValueAtTime(0, o.start + o.dur);
    osc.connect(g);
    g.connect(this.bus(o.bus));
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(o.start);
      lfo.stop(o.start + o.dur + 0.05);
    }
    osc.start(o.start);
    osc.stop(o.start + o.dur + 0.05);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // ruido blanco determinista (LCG): suena igual en cada sesión y no depende de Math.random
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 0xffffffff) * 2 - 1;
    }
    this.noiseBuf = buf;
    return buf;
  }

  /** Un golpe de ruido filtrado (hi-hat, caja, deslizar de cartas). */
  noiseBurst(o: NoiseOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    let node: AudioNode = src;
    const chain = (f: BiquadFilterNode): void => {
      node.connect(f);
      node = f;
    };
    if (o.hp !== undefined) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      chain(f);
    }
    if (o.bp !== undefined) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.bp;
      chain(f);
    }
    if (o.lp !== undefined) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      chain(f);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, o.start);
    g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
    node.connect(g);
    g.connect(this.bus(o.bus));
    src.start(o.start);
    src.stop(o.start + o.dur + 0.02);
  }
}

/** Instancia única del sitio. */
export const engine = new AudioEngine();
