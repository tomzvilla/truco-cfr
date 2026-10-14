import type { ActionId, Card, EnvidoCall, Mood, Suit, TrucoCall } from './types';

const SUIT_PLURAL: Record<Suit, string> = { espada: 'espadas', basto: 'bastos', oro: 'oros', copa: 'copas' };

export function cardLabel(c: Card): string {
  const rank = c.number === 10 ? 'Sota' : c.number === 11 ? 'Caballo' : c.number === 12 ? 'Rey' : String(c.number);
  return `${rank} de ${SUIT_PLURAL[c.suit]}`;
}

export const ACTION_LABEL: Record<ActionId, string> = {
  jugar0: 'Jugar carta 1',
  jugar1: 'Jugar carta 2',
  jugar2: 'Jugar carta 3',
  envido: 'Envido',
  realEnvido: 'Real envido',
  faltaEnvido: 'Falta envido',
  truco: 'Truco',
  retruco: 'Retruco',
  valeCuatro: 'Vale cuatro',
  quiero: 'Quiero',
  noQuiero: 'No quiero',
  mazo: 'Al mazo',
};

export const actionLabel = (id: ActionId): string => ACTION_LABEL[id];

export const CALL_LABEL: Record<EnvidoCall | TrucoCall, string> = {
  envido: 'envido',
  realEnvido: 'real envido',
  faltaEnvido: 'falta envido',
  truco: 'truco',
  retruco: 'retruco',
  valeCuatro: 'vale cuatro',
};

export const MOOD_LINE: Record<Mood, string> = {
  neutral: 'Dale, jugá.',
  farol: 'Tengo una mano bárbara. Seguro.',
  descubierto: 'Uy… me vieron las cartas.',
  gana: '¡Esta mano es mía!',
  pierde: 'Bien jugado. Revancha.',
};

export const moodLine = (m: Mood): string => MOOD_LINE[m];
