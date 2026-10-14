import type { AudioEngine } from './engine';

/** [nota, duración en tiempos]. `null` = silencio. */
export type Note = [name: string | null, beats: number];

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frecuencia en Hz de una nota como "A4", "C#5" o "Bb3" (A4 = 440). */
export function noteFreq(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Nota inválida: "${name}"`);
  const semis = NOTE_INDEX[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = 12 * (Number(m[3]) + 1) + semis;
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface Song {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  lead: Note[];
  bass: Note[];
}

/*
 * "Siesta en el pasaje": composición original, sin ninguna melodía ajena. La Am pentatónica con una vuelta por
 * E mayor (G#), a 96 BPM. El bajo hace el 3+3+2 de la milonga: raíz, quinta y raíz en los tiempos 0, 1.5 y 3 de cada
 * compás. La parte B (compases 9 a 16) repite la armonía una octava más arriba en la melodía.
 */
const LEAD: Note[] = [
  // A (compases 1 a 8): Am, Am, F, E, C, G, Dm, E
  ['E5', 1], [null, 0.5], ['A5', 0.5], ['G5', 1], ['E5', 1],
  ['C5', 1.5], ['D5', 0.5], ['E5', 2],
  ['F5', 1], ['E5', 0.5], ['D5', 0.5], ['C5', 1], [null, 1],
  ['B4', 1], ['D5', 1], ['E5', 1.5], [null, 0.5],
  ['G5', 1], ['E5', 1], ['C5', 1], ['E5', 1],
  ['D5', 1.5], ['B4', 0.5], ['G4', 2],
  ['A4', 1], ['D5', 1], ['F5', 1], ['E5', 0.5], ['D5', 0.5],
  ['E5', 2], [null, 1], ['B4', 1],
  // B (compases 9 a 16)
  ['A5', 1], [null, 0.5], ['G5', 0.5], ['E5', 1], ['G5', 1],
  ['A5', 1.5], ['G5', 0.5], ['E5', 1], ['C5', 1],
  ['F5', 1], ['A5', 1], ['G5', 1], ['F5', 0.5], ['E5', 0.5],
  ['D5', 1], ['E5', 1], ['G#4', 1], ['B4', 1],
  ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['B5', 1], ['G5', 1],
  ['A5', 1], ['G5', 1], ['D5', 1], ['B4', 1],
  ['D5', 1], ['F5', 1], ['A5', 1], ['G5', 0.5], ['F5', 0.5],
  ['E5', 3], [null, 1],
];

const bassBar = (root: string, fifth: string): Note[] => [[root, 1.5], [fifth, 1.5], [root, 1]];

const BASS: Note[] = [
  ...bassBar('A2', 'E3'), ...bassBar('A2', 'E3'), ...bassBar('F2', 'C3'), ...bassBar('E2', 'B2'),
  ...bassBar('C3', 'G3'), ...bassBar('G2', 'D3'), ...bassBar('D3', 'A3'), ...bassBar('E2', 'B2'),
  ...bassBar('A2', 'E3'), ...bassBar('A2', 'E3'), ...bassBar('F2', 'C3'), ...bassBar('E2', 'B2'),
  ...bassBar('C3', 'G3'), ...bassBar('G2', 'D3'), ...bassBar('D3', 'A3'), ...bassBar('E2', 'B2'),
];

export const SONG: Song = { bpm: 96, beatsPerBar: 4, bars: 16, lead: LEAD, bass: BASS };

export const sumBeats = (notes: readonly Note[]): number => notes.reduce((a, [, b]) => a + b, 0);

export type MusicKind = 'lead' | 'bass' | 'kick' | 'snare' | 'hat';

export interface MusicEvent {
  /** Tiempo (en negras) desde el inicio del loop. */
  beat: number;
  dur: number;
  kind: MusicKind;
  freq?: number;
  /** Acento (1 = normal). */
  accent?: number;
}

function trackEvents(notes: readonly Note[], kind: MusicKind): MusicEvent[] {
  const out: MusicEvent[] = [];
  let beat = 0;
  for (const [name, dur] of notes) {
    if (name !== null) out.push({ beat, dur, kind, freq: noteFreq(name) });
    beat += dur;
  }
  return out;
}

/** Percusión de un compás: bombo en 0, caja suave en 1.5 y 3 (el acento de la milonga), hi-hat a corcheas. */
function drumEvents(bars: number, beatsPerBar: number): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * beatsPerBar;
    out.push({ beat: o, dur: 0.2, kind: 'kick' });
    out.push({ beat: o + 1.5, dur: 0.15, kind: 'snare' });
    out.push({ beat: o + 3, dur: 0.15, kind: 'snare', accent: 0.7 });
    for (let e = 0; e < beatsPerBar * 2; e++) {
      const beat = o + e / 2;
      const accent = [0, 3, 6].includes(e) ? 1.6 : 1;
      out.push({ beat, dur: 0.05, kind: 'hat', accent });
    }
  }
  return out;
}

/** Todos los eventos del loop, ordenados por tiempo. */
export function buildEvents(song: Song = SONG): MusicEvent[] {
  return [
    ...trackEvents(song.lead, 'lead'),
    ...trackEvents(song.bass, 'bass'),
    ...drumEvents(song.bars, song.beatsPerBar),
  ].sort((a, b) => a.beat - b.beat);
}

export const loopBeats = (song: Song = SONG): number => song.bars * song.beatsPerBar;

/** Cuánto se agenda por adelantado (s) y cada cuánto vuelve a mirar el reloj (ms). */
export const LOOKAHEAD_S = 0.25;
export const TICK_MS = 50;

export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Toca un evento en el tiempo `t` del reloj de audio. */
function playEvent(engine: AudioEngine, ev: MusicEvent, t: number, spb: number): void {
  const dur = ev.dur * spb;
  switch (ev.kind) {
    case 'lead':
      engine.tone({ bus: 'music', type: 'square', freq: ev.freq!, start: t, dur: dur * 0.92, gain: 0.07, release: 0.06, vibrato: { rate: 5.2, depth: ev.freq! * 0.006 } });
      break;
    case 'bass':
      engine.tone({ bus: 'music', type: 'triangle', freq: ev.freq!, start: t, dur: dur * 0.9, gain: 0.24, attack: 0.01, release: 0.05 });
      break;
    case 'kick':
      engine.tone({ bus: 'music', type: 'sine', freq: 130, freqEnd: 45, start: t, dur: 0.14, gain: 0.32, release: 0.06 });
      break;
    case 'snare':
      engine.noiseBurst({ bus: 'music', start: t, dur: 0.11, gain: 0.11 * (ev.accent ?? 1), bp: 1900 });
      break;
    case 'hat':
      engine.noiseBurst({ bus: 'music', start: t, dur: 0.035, gain: 0.04 * (ev.accent ?? 1), hp: 7000 });
      break;
  }
}

/**
 * Agenda la canción con look-ahead: un timer corto mira `AudioContext.currentTime` y agenda en el reloj de audio los
 * eventos de los próximos instantes. El timer solo decide CUÁNDO mirar; el tiempo musical nunca depende de él.
 */
export class MusicScheduler {
  private readonly events: MusicEvent[];
  private readonly spb: number;
  private idx = 0;
  private loopStart = 0;
  private timer: unknown = null;
  running = false;

  constructor(
    private readonly engine: AudioEngine,
    private readonly song: Song = SONG,
    private readonly timers: Timers = realTimers,
  ) {
    this.events = buildEvents(song);
    this.spb = 60 / song.bpm;
  }

  /** Duración de una vuelta completa, en segundos. */
  get loopSeconds(): number {
    return loopBeats(this.song) * this.spb;
  }

  start(): void {
    if (this.running || !this.engine.ctx) return;
    this.running = true;
    this.idx = 0;
    this.loopStart = this.engine.now() + 0.08;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  private tick = (): void => {
    if (!this.running) return;
    const horizon = this.engine.now() + LOOKAHEAD_S;
    for (;;) {
      const ev = this.events[this.idx]!;
      const t = this.loopStart + ev.beat * this.spb;
      if (t >= horizon) break;
      playEvent(this.engine, ev, t, this.spb);
      this.idx++;
      if (this.idx >= this.events.length) {
        this.idx = 0;
        this.loopStart += this.loopSeconds; // da la vuelta
      }
    }
    this.timer = this.timers.set(this.tick, TICK_MS);
  };
}
