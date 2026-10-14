import type { AudioEngine } from './engine';
import { noteFreq } from './music';

export const SFX_NAMES = [
  'deal', 'play', 'cardHover', 'hover', 'press',
  'truco', 'retruco', 'valeCuatro', 'envido',
  'quiero', 'noQuiero', 'points', 'handWon', 'handLost', 'matchWon',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

/** Cada efecto agenda su sonido empezando en `t` (reloj del AudioContext). Todos duran menos de 400 ms salvo el match. */
export type SfxFn = (e: AudioEngine, t: number, arg?: number) => void;

const sq = (e: AudioEngine, freq: number, start: number, dur: number, gain = 0.16, freqEnd?: number): void =>
  e.tone({ bus: 'sfx', type: 'square', freq, freqEnd, start, dur, gain, release: Math.min(0.05, dur / 2) });

const tri = (e: AudioEngine, freq: number, start: number, dur: number, gain = 0.22): void =>
  e.tone({ bus: 'sfx', type: 'triangle', freq, start, dur, gain, release: Math.min(0.06, dur / 2) });

/** Arpegio ascendente: cada nota 60 ms después de la anterior. */
function arpeggio(e: AudioEngine, t: number, names: string[], step = 0.06, last = 0.12): void {
  names.forEach((n, i) => sq(e, noteFreq(n), t + i * step, i === names.length - 1 ? last : step * 1.4, 0.14));
}

export const SFX: Record<SfxName, SfxFn> = {
  // repartir: un deslizar suave de cartas
  deal(e, t) {
    e.noiseBurst({ bus: 'sfx', start: t, dur: 0.16, gain: 0.18, bp: 2600 });
    e.noiseBurst({ bus: 'sfx', start: t + 0.06, dur: 0.12, gain: 0.1, bp: 3400 });
  },
  // tirar la carta: un golpe seco sobre el paño
  play(e, t) {
    e.tone({ bus: 'sfx', type: 'sine', freq: 190, freqEnd: 70, start: t, dur: 0.11, gain: 0.4 });
    e.noiseBurst({ bus: 'sfx', start: t, dur: 0.06, gain: 0.16, bp: 1200 });
  },
  cardHover(e, t) {
    sq(e, noteFreq('E6'), t, 0.035, 0.05);
  },
  hover(e, t) {
    sq(e, noteFreq('A5'), t, 0.025, 0.025);
  },
  press(e, t) {
    e.noiseBurst({ bus: 'sfx', start: t, dur: 0.02, gain: 0.14, hp: 2000 });
    sq(e, noteFreq('C6'), t, 0.04, 0.09, noteFreq('G5'));
  },
  truco(e, t) {
    arpeggio(e, t, ['A4', 'C5', 'E5']);
  },
  retruco(e, t) {
    arpeggio(e, t, ['A4', 'C5', 'E5', 'A5']);
  },
  valeCuatro(e, t) {
    arpeggio(e, t, ['A4', 'C5', 'E5', 'A5', 'C6'], 0.05, 0.13);
    tri(e, noteFreq('A2'), t, 0.28, 0.3);
  },
  envido(e, t) {
    sq(e, noteFreq('E5'), t, 0.09, 0.15);
    sq(e, noteFreq('A5'), t + 0.1, 0.16, 0.15);
  },
  quiero(e, t) {
    sq(e, noteFreq('C5'), t, 0.07, 0.15);
    sq(e, noteFreq('G5'), t + 0.07, 0.14, 0.15);
  },
  noQuiero(e, t) {
    sq(e, noteFreq('E4'), t, 0.09, 0.15);
    sq(e, noteFreq('C4'), t + 0.09, 0.18, 0.15);
  },
  // sumar puntos: "ding" de moneda y una matraca con un tic por punto (hasta 6)
  points(e, t, n = 1) {
    sq(e, noteFreq('B5'), t, 0.07, 0.13);
    sq(e, noteFreq('E6'), t + 0.07, 0.25, 0.13);
    const ticks = Math.max(1, Math.min(6, Math.round(n)));
    for (let i = 0; i < ticks; i++) e.noiseBurst({ bus: 'sfx', start: t + 0.04 * i, dur: 0.02, gain: 0.12, hp: 4000 });
  },
  handWon(e, t) {
    arpeggio(e, t, ['C5', 'E5', 'G5', 'C6'], 0.06, 0.15);
  },
  handLost(e, t) {
    ['E4', 'D4', 'C4'].forEach((n, i) => tri(e, noteFreq(n), t + i * 0.07, i === 2 ? 0.18 : 0.1, 0.26));
  },
  // fanfarria del partido (~1,5 s)
  matchWon(e, t) {
    const seq: [string, number, number][] = [
      ['G4', 0, 0.14], ['C5', 0.15, 0.14], ['E5', 0.3, 0.14], ['G5', 0.45, 0.2],
      ['E5', 0.7, 0.12], ['G5', 0.84, 0.12], ['C6', 0.98, 0.5],
    ];
    for (const [n, off, dur] of seq) sq(e, noteFreq(n), t + off, dur, 0.15);
    tri(e, noteFreq('C3'), t + 0.98, 0.5, 0.28);
    tri(e, noteFreq('G3'), t, 0.9, 0.2);
  },
};

/** Separación mínima entre repeticiones del mismo efecto (ms): los blips de hover no pueden ametrallar. */
export const MIN_GAP_MS: Partial<Record<SfxName, number>> = {
  cardHover: 90,
  hover: 120,
  press: 40,
  deal: 60,
  play: 60,
};
