import type { Card, CardNumber, Suit, TableView } from './types';

const c = (suit: Suit, number: CardNumber): Card => ({ suit, number });

export const FIXTURE_NAMES = [
  'inicioDeMano', 'envidoPendiente', 'trucoPendiente', 'finDeManoRayosX',
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const inicioDeMano: TableView = {
  hand: [
    { card: c('espada', 1), played: false },
    { card: c('oro', 7), played: false },
    { card: c('basto', 4), played: false },
  ],
  tricks: [],
  score: [3, 5],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [], pending: null, reveal: null },
  actions: ['jugar0', 'jugar1', 'jugar2', 'envido', 'realEnvido', 'faltaEnvido', 'truco', 'mazo'],
  mood: 'neutral',
  phase: 'jugando',
};

// Soy mano, jugué el 3 de bastos y el bot (pie) cantó envido antes de jugar.
const envidoPendiente: TableView = {
  hand: [
    { card: c('basto', 3), played: true },
    { card: c('basto', 6), played: false },
    { card: c('oro', 5), played: false },
  ],
  tricks: [{ mine: c('basto', 3), bot: null, winner: null }],
  score: [12, 14],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [{ call: 'envido', by: 'bot' }], pending: { by: 'bot' }, reveal: null },
  actions: ['quiero', 'noQuiero', 'envido', 'realEnvido', 'faltaEnvido'],
  mood: 'neutral',
  phase: 'jugando',
};

// El bot es mano, perdió la primera baza y en la segunda canta truco.
const trucoPendiente: TableView = {
  hand: [
    { card: c('espada', 1), played: true },
    { card: c('oro', 7), played: true },
    { card: c('basto', 4), played: false },
  ],
  tricks: [
    { mine: c('oro', 7), bot: c('basto', 3), winner: 'yo' },
    { mine: c('espada', 1), bot: null, winner: null },
  ],
  score: [10, 7],
  mano: 'bot',
  truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'bot' } },
  envido: { calls: [], pending: null, reveal: null },
  actions: ['quiero', 'noQuiero', 'retruco'],
  mood: 'farol',
  phase: 'jugando',
};

// Fin de mano: el bot ganó la primera baza con el 6 de oros y yo me fui al mazo.
// Se ven sus cartas reveladas y las probabilidades de sus decisiones (rayos X).
const finDeManoRayosX: TableView = {
  hand: [
    { card: c('copa', 3), played: false },
    { card: c('basto', 6), played: false },
    { card: c('oro', 5), played: true },
  ],
  tricks: [{ mine: c('oro', 5), bot: c('oro', 6), winner: 'bot' }],
  score: [9, 9],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [], pending: null, reveal: null },
  actions: [],
  xray: [
    { action: 'truco', prob: 0.34 },
    { action: 'jugar1', prob: 0.58 },
    { action: 'mazo', prob: 0.08 },
  ],
  botHand: [c('oro', 6), c('copa', 5), c('basto', 4)],
  mood: 'gana',
  phase: 'finDeMano',
  result: { yo: 0, bot: 1, winner: 'bot' },
};

export const FIXTURES: Record<FixtureName, TableView> = {
  inicioDeMano,
  envidoPendiente,
  trucoPendiente,
  finDeManoRayosX,
};
