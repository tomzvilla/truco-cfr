import type { Card } from '../table/types';

export interface CardSkin {
  id: string;
  name: string;
  /** Texto de crédito que debe mostrarse en la web. */
  credit: string;
  /** Tamaño nativo en píxeles. El escalado conserva píxeles físicos enteros (ver pickScale). */
  native: { w: number; h: number };
  faceUrl(card: Card): string;
  backUrl(): string;
}
