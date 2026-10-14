import { describe, it, expect } from 'vitest';
import type { Card, TrickView } from '../table/types';
import { envidoPoints, handOutcome, tanto, trickWinner, trucoRank } from './rules';

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

describe('handOutcome', () => {
  it('dos bazas ganadas definen la mano', () => {
    expect(handOutcome([trick('yo'), trick('yo')], 'bot')).toBe('yo');
    expect(handOutcome([trick('bot'), trick('yo'), trick('bot')], 'yo')).toBe('bot');
  });
  it('1 a 1 sigue; parda en la tercera la gana el mano', () => {
    expect(handOutcome([trick('yo'), trick('bot')], 'yo')).toBeNull();
    expect(handOutcome([trick('yo'), trick('bot'), trick('parda')], 'bot')).toBe('bot');
  });
  it('parda en la primera: decide la segunda; parda en la segunda: decide la primera', () => {
    expect(handOutcome([trick('parda'), trick('bot')], 'yo')).toBe('bot');
    expect(handOutcome([trick('yo'), trick('parda')], 'bot')).toBe('yo');
  });
  it('dos pardas: decide la tercera; si también es parda, el mano', () => {
    expect(handOutcome([trick('parda'), trick('parda')], 'yo')).toBeNull();
    expect(handOutcome([trick('parda'), trick('parda'), trick('bot')], 'yo')).toBe('bot');
    expect(handOutcome([trick('parda'), trick('parda'), trick('parda')], 'yo')).toBe('yo');
  });
  it('una baza sin ganador todavía no cuenta', () => {
    expect(handOutcome([{ mine: c('oro', 4), bot: null, winner: null }], 'yo')).toBeNull();
  });
});

describe('envidoPoints', () => {
  it('suma los cantos; la falta envido vale lo que le falta al que va ganando', () => {
    expect(envidoPoints(['envido'], [3, 5])).toBe(2);
    expect(envidoPoints(['envido', 'envido'], [3, 5])).toBe(4);
    expect(envidoPoints(['envido', 'realEnvido'], [3, 5])).toBe(5);
    expect(envidoPoints(['faltaEnvido'], [3, 12])).toBe(18);
  });
});
