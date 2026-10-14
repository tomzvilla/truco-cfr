import { PLAY_ACTIONS, TRUCO_CALL_LEVEL } from '../table/types';
import type { ActionId, Card, EnvidoCall, Seat, TableView, TrucoCall } from '../table/types';
import { envidoPoints, handOutcome, tanto, trickWinner, trucoRank } from './rules';
import type { GameSource } from './source';

const ENVIDO_CALLS: readonly ActionId[] = ['envido', 'realEnvido', 'faltaEnvido'];
const TRUCO_CALLS: readonly ActionId[] = ['truco', 'retruco', 'valeCuatro'];

/** Cartas que "tiene" el bot del demo, en orden de preferencia (se saltean las que tenés vos). */
const BOT_POOL: readonly Card[] = [
  { suit: 'copa', number: 3 },
  { suit: 'basto', number: 6 },
  { suit: 'oro', number: 5 },
  { suit: 'espada', number: 4 },
  { suit: 'copa', number: 5 },
  { suit: 'oro', number: 6 },
  { suit: 'copa', number: 12 },
  { suit: 'basto', number: 10 },
];

const same = (a: Card, b: Card): boolean => a.suit === b.suit && a.number === b.number;

/**
 * Mano del bot, derivada de la tuya (así los tantos y las cartas reveladas son siempre coherentes):
 * primero las que ya tiró, después las del mazo de ejemplo que no tenés vos.
 */
function demoBotHand(view: TableView): Card[] {
  const mine = view.hand.map((h) => h.card);
  const played = view.tricks.flatMap((t) => (t.bot ? [t.bot] : []));
  const rest = BOT_POOL.filter((c) => !mine.some((m) => same(m, c)) && !played.some((p) => same(p, c)));
  return [...played, ...rest].slice(0, 3);
}

const botRemaining = (view: TableView): Card[] => demoBotHand(view).slice(view.tricks.filter((t) => t.bot).length);

const addPoints = (score: readonly [number, number], seat: Seat, pts: number): readonly [number, number] =>
  seat === 'yo' ? [Math.min(30, score[0] + pts), score[1]] : [score[0], Math.min(30, score[1] + pts)];

/** Quién abre la próxima baza: el que ganó la anterior; con parda o al empezar, el mano. */
function leader(view: TableView): Seat {
  const last = [...view.tricks].reverse().find((t) => t.winner !== null);
  return last?.winner === 'yo' || last?.winner === 'bot' ? last.winner : view.mano;
}

/** Acciones que ofrece el demo cuando es tu turno. */
export function defaultActions(view: TableView): ActionId[] {
  if (view.phase === 'finDeMano') return [];
  const actions: ActionId[] = [];
  view.hand.forEach((h, i) => {
    if (!h.played) actions.push(PLAY_ACTIONS[i]!);
  });
  const firstCardNotPlayedYet = view.tricks.length === 0 || (view.tricks.length === 1 && view.tricks[0]!.mine === null);
  if (firstCardNotPlayedYet && view.envido.calls.length === 0) actions.push('envido', 'realEnvido', 'faltaEnvido');
  if (view.truco.acceptedLevel === 1 && !view.truco.pending) actions.push('truco');
  actions.push('mazo');
  return actions;
}

function finish(view: TableView, winner: Seat, points: number): TableView {
  return {
    ...view,
    score: addPoints(view.score, winner, points),
    truco: { ...view.truco, pending: null },
    actions: [],
    mood: winner === 'bot' ? 'gana' : 'pierde',
    phase: 'finDeMano',
    botHand: demoBotHand(view),
  };
}

/** Pone ganador a la baza completa y cierra la mano si ya está decidida. */
function settle(view: TableView): TableView {
  const tricks = view.tricks.map((t) =>
    t.winner === null && t.mine && t.bot ? { ...t, winner: trickWinner(t.mine, t.bot) } : t,
  );
  const next = { ...view, tricks };
  const winner = handOutcome(tricks, view.mano);
  return winner ? finish(next, winner, view.truco.acceptedLevel) : next;
}

/** Envido aceptado: se cantan los tantos reales de las dos manos (el segundo dice "son buenas" si no supera al primero). */
function resolveEnvido(view: TableView): TableView {
  const mine = tanto(view.hand.map((h) => h.card));
  const bot = tanto(demoBotHand(view));
  const winner: Seat = view.mano === 'yo' ? (bot > mine ? 'bot' : 'yo') : mine > bot ? 'yo' : 'bot';
  const reveal = view.mano === 'yo' ? { yo: mine, bot: bot > mine ? bot : null } : { bot, yo: mine > bot ? mine : null };
  const pts = envidoPoints(view.envido.calls.map((c) => c.call), view.score);
  return {
    ...view,
    score: addPoints(view.score, winner, pts),
    envido: { ...view.envido, pending: null, reveal },
    mood: winner === 'bot' ? 'gana' : 'pierde',
  };
}

export function demoReduce(view: TableView, action: ActionId): TableView {
  const playIdx = (PLAY_ACTIONS as readonly string[]).indexOf(action);
  if (playIdx >= 0) {
    const slot = view.hand[playIdx];
    if (!slot || slot.played) return view;
    const hand = view.hand.map((h, k) => (k === playIdx ? { ...h, played: true } : h));
    const last = view.tricks[view.tricks.length - 1];
    const tricks =
      last && last.mine === null
        ? view.tricks.map((t, k) => (k === view.tricks.length - 1 ? { ...t, mine: slot.card } : t))
        : [...view.tricks, { mine: slot.card, bot: null, winner: null }];
    return settle({ ...view, hand, tricks, actions: [], mood: 'neutral' });
  }

  if (action === 'mazo') return finish(view, 'bot', view.truco.acceptedLevel);

  if (action === 'quiero') {
    if (view.envido.pending) return { ...resolveEnvido(view), actions: [] };
    const p = view.truco.pending;
    if (!p) return view;
    return { ...view, actions: [], truco: { acceptedLevel: TRUCO_CALL_LEVEL[p.call], pending: null }, mood: 'farol' };
  }

  if (action === 'noQuiero') {
    if (view.truco.pending) return finish(view, view.truco.pending.by, view.truco.acceptedLevel);
    if (view.envido.pending) {
      return {
        ...view,
        score: addPoints(view.score, view.envido.pending.by, 1),
        actions: [],
        envido: { ...view.envido, pending: null },
        mood: view.envido.pending.by === 'bot' ? 'gana' : 'pierde',
      };
    }
    return view;
  }

  if (ENVIDO_CALLS.includes(action)) {
    return {
      ...view,
      actions: [],
      envido: {
        ...view.envido,
        calls: [...view.envido.calls, { call: action as EnvidoCall, by: 'yo' }],
        pending: { by: 'yo' },
      },
      mood: 'neutral',
    };
  }

  if (TRUCO_CALLS.includes(action)) {
    const prev = view.truco.pending;
    const acceptedLevel = prev ? TRUCO_CALL_LEVEL[prev.call] : view.truco.acceptedLevel;
    return {
      ...view,
      actions: [],
      truco: { acceptedLevel, pending: { call: action as TrucoCall, by: 'yo' } },
      mood: 'neutral',
    };
  }

  return view;
}

/** El bot "responde": acepta lo que cantaste, contesta tu baza (o abre la siguiente) y te devuelve el turno. */
export function demoBotStep(view: TableView): TableView {
  let v = view;
  if (v.truco.pending?.by === 'yo') {
    v = { ...v, truco: { acceptedLevel: TRUCO_CALL_LEVEL[v.truco.pending.call], pending: null }, mood: 'farol' };
  }
  if (v.envido.pending?.by === 'yo') v = resolveEnvido(v);

  const last = v.tricks[v.tricks.length - 1];
  if (v.phase === 'jugando' && last && last.mine && !last.bot) {
    // el bot contesta con la carta más baja que le gana a la tuya; si ninguna, tira la más baja que tenga
    const rest = botRemaining(v).sort((a, b) => trucoRank(a) - trucoRank(b));
    const card = rest.find((c) => trucoRank(c) > trucoRank(last.mine!)) ?? rest[0];
    if (card) {
      v = settle({ ...v, tricks: v.tricks.map((t, k) => (k === v.tricks.length - 1 ? { ...t, bot: card } : t)) });
    }
  }

  const open = v.tricks[v.tricks.length - 1];
  const noOpenTrick = !open || (open.mine !== null && open.bot !== null);
  if (v.phase === 'jugando' && noOpenTrick && v.tricks.length < 3 && leader(v) === 'bot') {
    const strongest = botRemaining(v).sort((a, b) => trucoRank(b) - trucoRank(a))[0];
    if (strongest) v = { ...v, tricks: [...v.tricks, { mine: null, bot: strongest, winner: null }] };
  }
  return { ...v, actions: defaultActions(v) };
}

export interface DemoSource extends GameSource {
  reset(view?: TableView): void;
}

export function createDemoSource(initial: TableView, delayMs = 900): DemoSource {
  let view = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const set = (v: TableView) => {
    view = v;
    listeners.forEach((l) => l());
  };
  return {
    getView: () => view,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action) => {
      if (!view.actions.includes(action)) return;
      set(demoReduce(view, action));
      clearTimeout(timer);
      timer = setTimeout(() => set(demoBotStep(view)), delayMs);
    },
    reset: (v = initial) => {
      clearTimeout(timer);
      set(v);
    },
  };
}
