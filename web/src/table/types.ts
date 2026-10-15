export const SUITS = ['espada', 'basto', 'oro', 'copa'] as const;
export type Suit = (typeof SUITS)[number];

export const CARD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type CardNumber = (typeof CARD_NUMBERS)[number];

export interface Card {
  suit: Suit;
  number: CardNumber;
}

export const cardKey = (c: Card): string => `${c.suit}-${c.number}`;

export function allCards(): Card[] {
  return SUITS.flatMap((suit) => CARD_NUMBERS.map((number) => ({ suit, number })));
}

/** Mismo orden que los índices 0..11 del motor Rust. NO reordenar. */
export const ACTION_IDS = [
  'jugar0', 'jugar1', 'jugar2',
  'envido', 'realEnvido', 'faltaEnvido',
  'truco', 'retruco', 'valeCuatro',
  'quiero', 'noQuiero', 'mazo',
] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export const PLAY_ACTIONS = ['jugar0', 'jugar1', 'jugar2'] as const;

export function actionIndex(id: ActionId): number {
  return ACTION_IDS.indexOf(id);
}

export function actionFromIndex(i: number): ActionId {
  const id = ACTION_IDS[i];
  if (id === undefined) throw new RangeError(`Índice de acción fuera de rango: ${i}`);
  return id;
}

export type Seat = 'yo' | 'bot';

export const MOODS = ['neutral', 'farol', 'descubierto', 'gana', 'pierde'] as const;
export type Mood = (typeof MOODS)[number];

/** 1 = truco sin cantar (la mano vale 1). */
export type TrucoLevel = 1 | 2 | 3 | 4;
export type TrucoCall = 'truco' | 'retruco' | 'valeCuatro';
export type EnvidoCall = 'envido' | 'realEnvido' | 'faltaEnvido';
export const TRUCO_CALL_LEVEL: Record<TrucoCall, TrucoLevel> = { truco: 2, retruco: 3, valeCuatro: 4 };

/** `HandCard[i]` corresponde a la acción `jugar{i}` (mano original ordenada por jerarquía). */
export interface HandCard {
  card: Card;
  played: boolean;
}

export type TrickWinner = Seat | 'parda' | null;

export interface TrickView {
  mine: Card | null;
  bot: Card | null;
  winner: TrickWinner;
}

export interface TrucoView {
  acceptedLevel: TrucoLevel;
  pending: { call: TrucoCall; by: Seat } | null;
}

export interface EnvidoView {
  calls: { call: EnvidoCall; by: Seat }[];
  pending: { by: Seat } | null;
  /** Tantos revelados. `null` en un jugador = no reveló ("son buenas"). `reveal: null` = no hubo reveal. */
  reveal: { yo: number | null; bot: number | null } | null;
}

export interface XRayEntry {
  action: ActionId;
  prob: number;
}

export type Phase = 'jugando' | 'finDeMano';

/** Puntos que sumó cada uno en la mano. `winner` = quien sumó más; `null` si sumaron lo mismo. */
export interface HandResult {
  yo: number;
  bot: number;
  winner: Seat | null;
}

export interface TableView {
  hand: HandCard[];
  tricks: TrickView[];
  /** [yo, bot], de 0 a 30. */
  score: readonly [number, number];
  mano: Seat;
  truco: TrucoView;
  envido: EnvidoView;
  actions: ActionId[];
  /** Probabilidades del bot por acción (modo rayos X). */
  xray?: XRayEntry[];
  /** Cartas del bot reveladas (típicamente al terminar la mano). */
  botHand?: Card[];
  mood: Mood;
  phase: Phase;
  /** Solo en finDeMano: lo que sumó cada uno en la mano (lo calcula el motor). */
  result?: HandResult;
  /** Quién llegó a 30. Solo cuando terminó el partido. */
  matchWinner?: Seat;
  /** La última jugada de la mano y quién la hizo (no viene al empezar la mano). */
  last?: LastAction;
  /** Lo que sumó cada uno con el envido, una vez resuelto (querido o no). */
  envidoPoints?: { yo: number; bot: number };
}

export interface LastAction {
  by: Seat;
  action: ActionId;
}
