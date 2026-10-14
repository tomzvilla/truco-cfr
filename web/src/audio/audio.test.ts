import { describe, expect, it } from 'vitest';
import { FakeAudioContext, FakeTimers } from '../test/fakeAudio';
import type { AudioPrefs } from './engine';
import { AudioEngine, VOLUME_GAIN } from './engine';
import { SONG, MusicScheduler, buildEvents, loopBeats, noteFreq, sumBeats } from './music';
import { SFX, SFX_NAMES } from './sfx';
import { playSfx, resetSfxLimits } from './useSound';

const prefs = (p: Partial<AudioPrefs> = {}): AudioPrefs => ({ muted: false, music: true, sfx: true, volume: 'mid', ...p });

function makeEngine() {
  const ctx = new FakeAudioContext();
  const eng = new AudioEngine(() => ctx as unknown as AudioContext);
  return { ctx, eng };
}

describe('canción', () => {
  it('melodía y bajo suman compases enteros', () => {
    expect(sumBeats(SONG.lead)).toBe(SONG.bars * SONG.beatsPerBar);
    expect(sumBeats(SONG.bass)).toBe(SONG.bars * SONG.beatsPerBar);
    expect(loopBeats()).toBe(64);
  });

  it('el bajo hace 3+3+2 (corcheas) en cada compás', () => {
    const bars = SONG.bars;
    for (let b = 0; b < bars; b++) {
      const durs = SONG.bass.slice(b * 3, b * 3 + 3).map(([, d]) => d * 2);
      expect(durs).toEqual([3, 3, 2]);
    }
  });

  it('todos los eventos caen dentro del loop', () => {
    const evs = buildEvents();
    expect(evs.length).toBeGreaterThan(100);
    for (const e of evs) {
      expect(e.beat).toBeGreaterThanOrEqual(0);
      expect(e.beat).toBeLessThan(loopBeats());
    }
  });

  it('noteFreq: A4 = 440 y las octavas duplican', () => {
    expect(noteFreq('A4')).toBeCloseTo(440);
    expect(noteFreq('A5')).toBeCloseTo(880);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
    expect(() => noteFreq('H4')).toThrow();
  });
});

describe('MusicScheduler', () => {
  it('agenda con look-ahead usando el reloj de audio y da la vuelta al loop', () => {
    const { ctx, eng } = makeEngine();
    eng.unlock();
    const timers = new FakeTimers();
    const sched = new MusicScheduler(eng, SONG, timers);
    sched.start();
    expect(sched.running).toBe(true);
    const spb = 60 / SONG.bpm;
    const afterFirst = ctx.oscs.length;
    expect(afterFirst).toBeGreaterThan(0);
    // lo agendado en el primer tick no pasa del horizonte (0.08 de arranque + 0.25 de look-ahead)
    for (const o of ctx.oscs) expect(Math.max(...o.starts)).toBeLessThan(0.34);

    // avanza el reloj de audio más allá de un loop completo, tick a tick
    const loopSeconds = loopBeats() * spb;
    let ticks = 0;
    while (ctx.currentTime < loopSeconds + 2 && ticks < 5000) {
      ctx.currentTime += 0.05;
      timers.runNext();
      ticks++;
    }
    const starts = ctx.oscs.flatMap((o) => o.starts);
    expect(Math.max(...starts)).toBeGreaterThan(loopSeconds + 0.08);
    // la primera nota del segundo loop (E5) cae exactamente un loop después de la primera
    const e5 = ctx.oscs.filter((o) => o.frequency.calls[0]?.v === noteFreq('E5'));
    const firstNote = Math.min(...e5.flatMap((o) => o.starts));
    expect(e5.flatMap((o) => o.starts).some((t) => Math.abs(t - (firstNote + loopSeconds)) < 1e-6)).toBe(true);
  });

  it('stop cancela el timer y deja de agendar', () => {
    const { ctx, eng } = makeEngine();
    eng.unlock();
    const timers = new FakeTimers();
    const sched = new MusicScheduler(eng, SONG, timers);
    sched.start();
    sched.stop();
    expect(sched.running).toBe(false);
    expect(timers.pending).toHaveLength(0);
    const n = ctx.oscs.length;
    ctx.currentTime += 5;
    timers.runNext();
    expect(ctx.oscs.length).toBe(n);
  });

  it('no arranca sin AudioContext (antes del primer gesto)', () => {
    const { eng } = makeEngine();
    const sched = new MusicScheduler(eng, SONG, new FakeTimers());
    sched.start();
    expect(sched.running).toBe(false);
  });
});

describe('AudioEngine', () => {
  it('no crea el contexto hasta el primer gesto y lo reanuda', () => {
    const { ctx, eng } = makeEngine();
    expect(eng.ready).toBe(false);
    expect(eng.unlock()).toBe(true);
    expect(eng.ready).toBe(true);
    expect(ctx.resumed).toBe(1);
  });

  it('sin AudioContext disponible unlock devuelve false', () => {
    const eng = new AudioEngine(() => null);
    expect(eng.unlock()).toBe(false);
    expect(eng.ready).toBe(false);
  });

  it('silenciar pone la ganancia maestra en cero y volver la restituye según el volumen', () => {
    const { eng } = makeEngine();
    eng.unlock();
    eng.setPrefs(prefs({ volume: 'high' }));
    expect(eng.master!.gain.value).toBe(VOLUME_GAIN.high);
    eng.setPrefs(prefs({ volume: 'high', muted: true }));
    expect(eng.master!.gain.value).toBe(0);
    eng.setPrefs(prefs({ volume: 'low' }));
    expect(eng.master!.gain.value).toBe(VOLUME_GAIN.low);
  });

  it('música y efectos tienen buses independientes', () => {
    const { eng } = makeEngine();
    eng.unlock();
    eng.setPrefs(prefs({ music: false }));
    expect(eng.musicBus!.gain.value).toBe(0);
    expect(eng.sfxBus!.gain.value).toBe(1);
    eng.setPrefs(prefs({ sfx: false }));
    expect(eng.musicBus!.gain.value).toBe(1);
    expect(eng.sfxBus!.gain.value).toBe(0);
  });

  it('las preferencias previas al gesto se aplican al crear el contexto', () => {
    const { eng } = makeEngine();
    eng.setPrefs(prefs({ muted: true }));
    eng.unlock();
    expect(eng.master!.gain.value).toBe(0);
  });
});

describe('efectos', () => {
  it('cada efecto agenda algo y dura menos de 400 ms (salvo la fanfarria del partido)', () => {
    for (const name of SFX_NAMES) {
      const { ctx, eng } = makeEngine();
      eng.unlock();
      SFX[name](eng, 0, 3);
      const stops = [...ctx.oscs.flatMap((o) => o.stops), ...ctx.sources.flatMap((s) => s.stops)];
      expect(stops.length, name).toBeGreaterThan(0);
      const end = Math.max(...stops);
      if (name === 'matchWon') {
        expect(end).toBeGreaterThan(1.3);
        expect(end).toBeLessThan(2);
      } else {
        expect(end, name).toBeLessThan(0.4);
      }
    }
  });

  it('el Truco sube de a un escalón por nivel', () => {
    const count = (name: 'truco' | 'retruco' | 'valeCuatro') => {
      const { ctx, eng } = makeEngine();
      eng.unlock();
      SFX[name](eng, 0);
      return ctx.oscs.length;
    };
    expect(count('retruco')).toBeGreaterThan(count('truco'));
    expect(count('valeCuatro')).toBeGreaterThan(count('retruco'));
  });

  it('playSfx respeta el silencio, el interruptor de efectos y el audio bloqueado', () => {
    resetSfxLimits();
    const { ctx, eng } = makeEngine();
    expect(playSfx('quiero', undefined, eng, 1000)).toBe(false); // todavía sin gesto
    eng.unlock();
    eng.setPrefs(prefs({ muted: true }));
    expect(playSfx('quiero', undefined, eng, 1000)).toBe(false);
    eng.setPrefs(prefs({ sfx: false }));
    expect(playSfx('quiero', undefined, eng, 1000)).toBe(false);
    expect(ctx.oscs).toHaveLength(0);
    eng.setPrefs(prefs());
    expect(playSfx('quiero', undefined, eng, 1000)).toBe(true);
    expect(ctx.oscs.length).toBeGreaterThan(0);
  });

  it('los blips de hover tienen límite de frecuencia', () => {
    resetSfxLimits();
    const { eng } = makeEngine();
    eng.unlock();
    expect(playSfx('hover', undefined, eng, 1000)).toBe(true);
    expect(playSfx('hover', undefined, eng, 1050)).toBe(false);
    expect(playSfx('hover', undefined, eng, 1200)).toBe(true);
  });
});
