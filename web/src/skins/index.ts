import { jcanabalSkin } from './jcanabal';
import type { CardSkin } from './types';

export type { CardSkin } from './types';
export { jcanabalSkin } from './jcanabal';

export const SKINS: Record<string, CardSkin> = { [jcanabalSkin.id]: jcanabalSkin };
export const DEFAULT_SKIN: CardSkin = jcanabalSkin;

export function getSkin(id: string): CardSkin {
  return SKINS[id] ?? DEFAULT_SKIN;
}
