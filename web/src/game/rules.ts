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
  if (decided.length >= 3) {
    if (yo !== bot) return yo > bot ? 'yo' : 'bot'; // pardas en las dos primeras: define la tercera
    // 1 a 1 con la tercera parda: gana quien ganó la PRIMERA; con las tres pardas, el mano
    const first = decided[0];
    return first === 'yo' || first === 'bot' ? first : mano;
  }
  return null;
}

/**
 * Puntos del envido aceptado (spec §2): suma de los cantos. La falta envido: si el que va ganando tiene menos de 15,
 * quien gane el envido gana el partido (30 alcanza siempre, el puntaje se acota a 30); si no, vale 30 menos el puntaje
 * del que va ganando.
 */
export function envidoPoints(calls: readonly EnvidoCall[], score: readonly [number, number]): number {
  if (calls.includes('faltaEnvido')) {
    const leader = Math.max(score[0], score[1]);
    return leader < 15 ? 30 : 30 - leader;
  }
  return calls.reduce((sum, c) => sum + (c === 'envido' ? 2 : 3), 0);
}

/** "No quiero" al último canto: quien cantó gana la suma de lo aceptado antes de ese canto, o 1 si fue el primero. */
export function envidoDeclinePoints(calls: readonly EnvidoCall[], score: readonly [number, number]): number {
  const accepted = calls.slice(0, -1);
  return accepted.length === 0 ? 1 : envidoPoints(accepted, score);
}
