import { describe, it, expect } from 'vitest';
import {
  ACTION_IDS, actionIndex, actionFromIndex, allCards, cardKey, SUITS, CARD_NUMBERS,
} from './types';

describe('ACTION_IDS', () => {
  it('tiene las 12 acciones en el orden de los índices del motor', () => {
    expect([...ACTION_IDS]).toEqual([
      'jugar0', 'jugar1', 'jugar2', 'envido', 'realEnvido', 'faltaEnvido',
      'truco', 'retruco', 'valeCuatro', 'quiero', 'noQuiero', 'mazo',
    ]);
  });
  it('actionIndex y actionFromIndex son inversas', () => {
    ACTION_IDS.forEach((id, i) => {
      expect(actionIndex(id)).toBe(i);
      expect(actionFromIndex(i)).toBe(id);
    });
  });
  it('actionFromIndex rechaza índices fuera de rango', () => {
    expect(() => actionFromIndex(12)).toThrow(RangeError);
    expect(() => actionFromIndex(-1)).toThrow(RangeError);
  });
});

describe('cartas', () => {
  it('hay 40 cartas distintas', () => {
    const keys = allCards().map(cardKey);
    expect(keys).toHaveLength(40);
    expect(new Set(keys).size).toBe(40);
  });
  it('cardKey tiene formato palo-número', () => {
    expect(cardKey({ suit: 'espada', number: 1 })).toBe('espada-1');
    expect(SUITS).toEqual(['espada', 'basto', 'oro', 'copa']);
    expect([...CARD_NUMBERS]).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
  });
});
