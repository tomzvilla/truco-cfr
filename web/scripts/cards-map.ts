import { CARD_NUMBERS } from '../src/table/types.ts';
import type { CardNumber, Suit } from '../src/table/types.ts';
import type { SourceNamer } from './cards-lib.ts';

/**
 * Mapeo palo+número -> archivo dentro del zip de jcanabal (edición gratuita).
 * Layout inspeccionado: `free_deck/<k>.PNG`, 73x113 RGBA, k = 1..40,
 * k = índice de palo * 10 + índice de número + 1.
 * Orden de palos del zip: oro, copa, espada, basto. Orden de números: 1..7, 10, 11, 12.
 * `free_deck/back.PNG` existe pero no se usa (nuestro dorso es original).
 * La ruta se busca por sufijo y sin distinguir mayúsculas.
 */
export const ZIP_SUIT_ORDER: readonly Suit[] = ['oro', 'copa', 'espada', 'basto'];

export const sourceNamer: SourceNamer = (suit: Suit, number: CardNumber) => {
  const k = ZIP_SUIT_ORDER.indexOf(suit) * 10 + CARD_NUMBERS.indexOf(number) + 1;
  return `free_deck/${k}.png`;
};
