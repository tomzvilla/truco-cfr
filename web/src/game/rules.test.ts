import { describe, it, expect } from 'vitest';
import type { Card, Seat, TrickView } from '../table/types';
import { envidoDeclinePoints, envidoPoints, handOutcome, tanto, trickWinner, trucoRank } from './rules';

const c = (suit: Card['suit'], number: Card['number']): Card => ({ suit, number });
const trick = (winner: TrickView['winner']): TrickView => ({ mine: c('oro', 4), bot: c('copa', 4), winner });

describe('tanto', () => {
  it('dos cartas del mismo palo suman 20 más sus valores', () => {
    expect(tanto([c('oro', 7), c('oro', 6), c('copa', 1)])).toBe(33);
    expect(tanto([c('espada', 5), c('espada', 12), c('oro', 3)])).toBe(25);
  });
  it('sin palo repetido vale la carta más alta (las figuras valen 0)', () => {
    expect(tanto([c('oro', 7), c('copa', 7), c('basto', 1)])).toBe(7);
    expect(tanto([c('oro', 12), c('copa', 11), c('basto', 10)])).toBe(0);
  });
  it('con tres del mismo palo toma el mejor par', () => {
    expect(tanto([c('oro', 7), c('oro', 6), c('oro', 5)])).toBe(33);
  });
});

describe('trucoRank / trickWinner', () => {
  it('respeta la jerarquía del truco', () => {
    const order = [c('espada', 1), c('basto', 1), c('espada', 7), c('oro', 7), c('copa', 3), c('basto', 2), c('oro', 1),
      c('copa', 12), c('oro', 11), c('basto', 10), c('copa', 7), c('basto', 6), c('oro', 5), c('espada', 4)];
    const ranks = order.map(trucoRank);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    expect(trucoRank(c('copa', 3))).toBe(trucoRank(c('oro', 3)));
  });
  it('la baza la gana la carta más fuerte y el empate es parda', () => {
    expect(trickWinner(c('espada', 1), c('oro', 3))).toBe('yo');
    expect(trickWinner(c('copa', 4), c('oro', 3))).toBe('bot');
    expect(trickWinner(c('copa', 3), c('oro', 3))).toBe('parda');
  });
});

type W = TrickView['winner'];

describe('handOutcome (spec §2: pardas)', () => {
  // [bazas jugadas], mano -> quién gana la mano (null = sigue)
  const table: [string, W[], Seat, Seat | null][] = [
    ['dos bazas ganadas por mí', ['yo', 'yo'], 'bot', 'yo'],
    ['dos bazas ganadas por el bot', ['bot', 'bot'], 'yo', 'bot'],
    ['1 a 1 todavía sigue', ['yo', 'bot'], 'yo', null],
    ['1 a 1, la tercera la gana el bot', ['yo', 'bot', 'bot'], 'yo', 'bot'],
    ['1 a 1 y tercera parda: gana quien ganó la PRIMERA (yo), aunque el mano sea el bot', ['yo', 'bot', 'parda'], 'bot', 'yo'],
    ['1 a 1 y tercera parda: gana quien ganó la PRIMERA (bot), aunque el mano sea yo', ['bot', 'yo', 'parda'], 'yo', 'bot'],
    ['primera parda: decide la segunda (bot)', ['parda', 'bot'], 'yo', 'bot'],
    ['primera parda: decide la segunda (yo)', ['parda', 'yo'], 'bot', 'yo'],
    ['segunda parda: gana quien ganó la primera (yo)', ['yo', 'parda'], 'bot', 'yo'],
    ['segunda parda: gana quien ganó la primera (bot)', ['bot', 'parda'], 'yo', 'bot'],
    ['primera y segunda pardas: sigue, decide la tercera', ['parda', 'parda'], 'yo', null],
    ['primera y segunda pardas, la tercera la gana el bot', ['parda', 'parda', 'bot'], 'yo', 'bot'],
    ['primera y segunda pardas, la tercera la gano yo', ['parda', 'parda', 'yo'], 'bot', 'yo'],
    ['las tres pardas: gana el mano (yo)', ['parda', 'parda', 'parda'], 'yo', 'yo'],
    ['las tres pardas: gana el mano (bot)', ['parda', 'parda', 'parda'], 'bot', 'bot'],
    ['una sola baza jugada: sigue', ['yo'], 'yo', null],
  ];
  it.each(table)('%s', (_name, winners, mano, expected) => {
    expect(handOutcome(winners.map(trick), mano)).toBe(expected);
  });
  it('una baza sin ganador todavía no cuenta', () => {
    expect(handOutcome([{ mine: c('oro', 4), bot: null, winner: null }], 'yo')).toBeNull();
  });
});

describe('envidoPoints', () => {
  it('suma los cantos aceptados', () => {
    expect(envidoPoints(['envido'], [3, 5])).toBe(2);
    expect(envidoPoints(['envido', 'envido'], [3, 5])).toBe(4);
    expect(envidoPoints(['envido', 'realEnvido'], [3, 5])).toBe(5);
  });
  it('falta envido con el que va ganando por debajo de 15: gana el partido (llega a 30)', () => {
    expect(envidoPoints(['faltaEnvido'], [3, 12])).toBe(30);
    expect(envidoPoints(['faltaEnvido'], [0, 0])).toBe(30);
    expect(envidoPoints(['faltaEnvido'], [14, 9])).toBe(30);
  });
  it('falta envido con el que va ganando en 15 o más: vale 30 menos su puntaje', () => {
    expect(envidoPoints(['faltaEnvido'], [15, 2])).toBe(15);
    expect(envidoPoints(['faltaEnvido'], [3, 20])).toBe(10);
    expect(envidoPoints(['envido', 'faltaEnvido'], [22, 22])).toBe(8);
  });
});

describe('envidoDeclinePoints (no quiero)', () => {
  it('vale 1 si fue el primer canto, o la suma de lo aceptado antes del último', () => {
    expect(envidoDeclinePoints(['envido'], [0, 0])).toBe(1);
    expect(envidoDeclinePoints(['envido', 'envido'], [0, 0])).toBe(2);
    expect(envidoDeclinePoints(['envido', 'realEnvido'], [0, 0])).toBe(2);
    expect(envidoDeclinePoints(['envido', 'envido', 'realEnvido'], [0, 0])).toBe(4);
    expect(envidoDeclinePoints(['realEnvido', 'faltaEnvido'], [0, 0])).toBe(3);
  });
});
