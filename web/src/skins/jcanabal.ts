import { cardBackDataUrl, CARD_H, CARD_W } from '../art/cardBack';
import { cardKey } from '../table/types';
import type { CardSkin } from './types';

export const jcanabalSkin: CardSkin = {
  id: 'jcanabal',
  name: 'Baraja española, pixel art',
  credit: 'Card art by Jose Angel Canabal',
  native: { w: CARD_W, h: CARD_H },
  faceUrl: (card) => `${import.meta.env.BASE_URL}cards/jcanabal/${cardKey(card)}.png`,
  backUrl: () => cardBackDataUrl(),
};
