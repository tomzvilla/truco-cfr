import { wilson } from '../logic/verdict';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { TANTOS } from '../logic/curve';
import type { CurvePoint } from '../logic/curve';
import type { Highlight, ResultsData, TournamentRow } from './types';

// DATOS DE EJEMPLO. Los reales los produce eval/ (eval/results/*.json).

function row(
  rival: string,
  description: string,
  partidos: number,
  ganados: number,
  net: [number, number, number],
  fallbackPct: number | null,
): TournamentRow {
  const { low, high } = wilson(ganados, partidos);
  return {
    rival, description, partidos, ganados,
    winRate: ganados / partidos, ciLow: low, ciHigh: high,
    netPerHand: net[0], netCiLow: net[1], netCiHigh: net[2], fallbackPct,
  };
}

const ITER = [0, 50, 100, 200, 400, 800, 1200, 1600, 2000];
const VS_RANDOM = [0.5, 0.74, 0.86, 0.93, 0.96, 0.97, 0.98, 0.98, 0.985];
const VS_HEUR = [0.31, 0.38, 0.44, 0.49, 0.52, 0.54, 0.55, 0.56, 0.563];
const EXPLOIT = [0.9, 0.52, 0.31, 0.19, 0.11, 0.07, 0.05, 0.04, 0.035];

export const MOCK_RESULTS: ResultsData = {
  isMock: true,
  generatedAt: '2026-10-13',
  tournament: [
    row('Bot al azar', 'Juega cualquier acción legal', 2000, 1910, [1.42, 1.31, 1.53], null),
    row('Heurístico propio', 'Reglas fijas: canta envido con 27 o más, truco con dos cartas altas', 2000, 1126, [0.21, 0.14, 0.28], null),
    row('Bot de marianogappa', 'Reglas en Go, con la flor desactivada', 2000, 1030, [0.03, -0.04, 0.1], 3.1),
    row('Heurístico de nicovon24', 'Corre local; no se copia su código', 2000, 1240, [0.38, 0.31, 0.45], 0.4),
  ],
  learning: ITER.map((iteration, i) => ({ iteration, vsRandom: VS_RANDOM[i]!, vsHeuristic: VS_HEUR[i]! })),
  exploitability: ITER.map((iteration, i) => ({ iteration, exploitability: EXPLOIT[i]! })),
};

const base = FIXTURES.finDeManoRayosX;
const sinReveal = (v: TableView): TableView => ({ ...v, botHand: undefined, xray: undefined, result: undefined });

// Los textos de cada paso describen exactamente lo que muestra la mesa (F16).
export const MOCK_HIGHLIGHTS: Highlight[] = [
  {
    id: 'farol-truco',
    title: 'El truco con la peor mano',
    why: 'Con 6, 5 y 4 (lo más flojo del mazo) el bot cantó truco y se llevó el punto porque no se lo aceptaron.',
    steps: [
      {
        caption: 'Perdés la primera baza: el bot respondió tu 5 de oros con un 6.',
        view: sinReveal({ ...base, phase: 'jugando', actions: [], mood: 'neutral' }),
      },
      {
        caption: 'En la segunda baza el bot canta truco. Con esa mano, es un farol.',
        view: sinReveal({
          ...base,
          phase: 'jugando',
          truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'bot' } },
          actions: ['quiero', 'noQuiero', 'retruco'],
          mood: 'farol',
        }),
      },
      {
        caption: 'Decís no quiero: el bot suma 1 punto y muestra que no tenía nada.',
        view: { ...base, score: [base.score[0], base.score[1] + 1] },
      },
    ],
  },
  {
    id: 'envido-bajo',
    title: 'Envido con 5 de tanto',
    why: 'El bot cantó envido con un 5 y un 4 de distinto palo: casi nada de tanto. Sirvió para que no lo leas.',
    steps: [
      {
        caption: 'Sos mano y jugás tu 3 de bastos. El bot, que es pie, todavía no jugó.',
        view: {
          ...FIXTURES.envidoPendiente,
          envido: { calls: [], pending: null, reveal: null },
          actions: [],
          mood: 'neutral',
        },
      },
      {
        caption: 'El bot canta envido. Con 5 de tanto, es un farol de manual.',
        view: { ...FIXTURES.envidoPendiente, mood: 'farol' },
      },
      {
        caption: 'Con la duda, decís no quiero. El bot suma 1 punto sin mostrar sus tantos.',
        view: {
          ...FIXTURES.envidoPendiente,
          envido: { calls: [{ call: 'envido', by: 'bot' }], pending: null, reveal: null },
          score: [12, 15],
          actions: [],
          mood: 'gana',
        },
      },
    ],
  },
];

// DATOS DE EJEMPLO. Los reales salen del análisis de faroleo de eval/ cuando termine el entrenamiento.
const MANO = [
  0.02, 0.02, 0.03, 0.03, 0.04, 0.05, 0.07, 0.09,
  0.1, 0.14, 0.22, 0.35, 0.52, 0.66, 0.78, 0.88, 0.93, 0.96, 0.97, 0.86, 0.82, 0.8,
];
const PIE = [
  0.01, 0.01, 0.02, 0.02, 0.03, 0.04, 0.05, 0.06,
  0.06, 0.09, 0.15, 0.27, 0.43, 0.58, 0.71, 0.83, 0.9, 0.94, 0.95, 0.82, 0.78, 0.75,
];

export const ENVIDO_CURVE_MOCK: CurvePoint[] = TANTOS.map((tantos, i) => ({
  tantos,
  mano: MANO[i]!,
  pie: PIE[i]!,
}));
