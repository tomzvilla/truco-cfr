// Reglas mínimas del truco que usa el demo para que la mesa cuente una mano creíble.
// No es el motor: el real vive en Rust. Acá solo hay lo justo para jerarquía, tanto y resultado de la mano.
import type { Card, EnvidoCall, Seat, TrickView, TrickWinner } from '../table/types';

/** Mayor número = carta más fuerte. */
export function trucoRank(card: Card): number {
  const { suit, number: n } = card;
  if (n === 1 && suit === 'espada') return 14;
  if (n === 1 && suit === 'basto') return 13;
  if (n === 7 && suit === 'espada') return 12;
  if (n === 7 && suit === 'oro') return 11;
  if (n === 3) return 10;
  if (n === 2) return 9;
  if (n === 1) return 8; // ases falsos: oro y copa
  if (n === 12) return 7;
  if (n === 11) return 6;
  if (n === 10) return 5;
  if (n === 7) return 4; // copa y basto
  return n - 3; // 6, 5, 4 -> 3, 2, 1
}

export function trickWinner(mine: Card, bot: Card): TrickWinner {
  const a = trucoRank(mine);
  const b = trucoRank(bot);
  return a === b ? 'parda' : a > b ? 'yo' : 'bot';
}

const envidoValue = (c: Card): number => (c.number >= 10 ? 0 : c.number);

/** Tanto de envido de una mano: mejor par del mismo palo (20 + valores) o, sin par, la carta más alta. */
export function tanto(cards: readonly Card[]): number {
  let best = 0;
  for (const c of cards) best = Math.max(best, envidoValue(c));
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i]!;
      const b = cards[j]!;
      if (a.suit === b.suit) best = Math.max(best, 20 + envidoValue(a) + envidoValue(b));
    }
  }
  return best;
}

/** Quién gana la mano según las bazas jugadas, o `null` si todavía sigue. */
export function handOutcome(tricks: readonly TrickView[], mano: Seat): Seat | null {
  const decided = tricks.filter((t) => t.winner !== null).map((t) => t.winner);
  const yo = decided.filter((w) => w === 'yo').length;
  const bot = decided.filter((w) => w === 'bot').length;
  if (yo >= 2) return 'yo';
  if (bot >= 2) return 'bot';
  if (decided.length === 2 && yo + bot === 1) return yo === 1 ? 'yo' : 'bot'; // una parda y una baza ganada
  if (decided.length >= 3) return yo > bot ? 'yo' : bot > yo ? 'bot' : mano;
  return null;
}

/** Puntos del envido aceptado: suma de los cantos; la falta vale lo que le falta al que va ganando. */
export function envidoPoints(calls: readonly EnvidoCall[], score: readonly [number, number]): number {
  if (calls.includes('faltaEnvido')) return 30 - Math.max(score[0], score[1]);
  return calls.reduce((sum, c) => sum + (c === 'envido' ? 2 : 3), 0);
}
