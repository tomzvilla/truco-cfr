import { pickScaleUpTo } from '../skins/scale';

/** Anchos mínimos (px CSS) que pide el diseño: se cumplen aunque haya que perder la escala entera. */
export const MIN_HAND_MOBILE_PX = 120;
export const MIN_PLAYED_MOBILE_PX = 85;
export const MIN_HAND_DESKTOP_PX = 146;
export const MIN_PLAYED_DESKTOP_PX = 110;

/** Cuánto de la altura de la carta del bot tapa la mía en cada baza. */
export const BAZA_OVERLAP_MOBILE = 0.5;
export const BAZA_OVERLAP_DESKTOP = 0.55;
/** Cuánto se pueden pisar entre sí las cartas de la mano (fracción del ancho). */
export const HAND_MAX_OVERLAP = 0.4;

/** Alto fijo (px) de todo lo que no son cartas, en celular y escritorio. Debe coincidir con Mesa.css. */
export const MOBILE_FIXED = 288;
export const DESKTOP_FIXED = 120;

const MOBILE_PLAYED_RATIO = 0.8;
const DESKTOP_PLAYED_RATIO = 0.753;
const DESKTOP_BOT_RATIO = 0.5;
const MOBILE_BOT = 0.6;

export interface SizingInput {
  desktop: boolean;
  /** Ancho del contenedor de la mano (px). */
  width: number;
  /** Alto que le queda a la mesa en la ventana (px). */
  height: number;
  dpr: number;
  native: { w: number; h: number };
}

export interface Sizes {
  hand: number;
  played: number;
  bot: number;
  /** Ventana baja: los dorsos del bot van en la esquina del paño en vez de arriba al centro (no restan alto). */
  botCorner: boolean;
}

/** Escalas de las cartas de la mano, de las bazas y de los dorsos del bot. */
export function tableSizes({ desktop, width, height, dpr, native }: SizingInput): Sizes {
  const w = Number.isFinite(width) && width > 0 ? width : 360;
  const h = Number.isFinite(height) && height > 0 ? height : 700;
  if (desktop) {
    const stack = DESKTOP_PLAYED_RATIO * (2 - BAZA_OVERLAP_DESKTOP) + 1;
    const minHand = MIN_HAND_DESKTOP_PX / native.w;
    const botCorner = (h - DESKTOP_FIXED) / native.h / (stack + DESKTOP_BOT_RATIO) < minHand;
    const units = botCorner ? stack : stack + DESKTOP_BOT_RATIO;
    const byHeight = (h - DESKTOP_FIXED) / native.h / units;
    const byWidth = w / (3 - 2 * HAND_MAX_OVERLAP) / native.w;
    const hand = pickScaleUpTo(Math.min(3, byHeight, byWidth), MIN_HAND_DESKTOP_PX / native.w, dpr);
    const played = pickScaleUpTo(hand * DESKTOP_PLAYED_RATIO, MIN_PLAYED_DESKTOP_PX / native.w, dpr);
    const bot = pickScaleUpTo(hand / 2, 1, dpr);
    return { hand, played, bot, botCorner };
  }
  const units = 1 + (2 - BAZA_OVERLAP_MOBILE) * MOBILE_PLAYED_RATIO;
  const byHeight = (h - MOBILE_FIXED) / native.h / units;
  const byWidth = w / (3 - 2 * HAND_MAX_OVERLAP) / native.w;
  const hand = pickScaleUpTo(Math.min(2.2, byHeight, byWidth), MIN_HAND_MOBILE_PX / native.w, dpr);
  // columna del paño: ancho menos riel y relleno (28), partido en 3, menos el corrimiento y giro de las cartas (16)
  const bazaWidth = ((w - 28) / 3 - 16) / native.w;
  const played = pickScaleUpTo(Math.min(hand * MOBILE_PLAYED_RATIO, bazaWidth), MIN_PLAYED_MOBILE_PX / native.w, dpr);
  const bot = pickScaleUpTo(MOBILE_BOT, 0.5, dpr);
  return { hand, played, bot, botCorner: false };
}

/** Cuánto se pisan las cartas de la mano (px, >= 0): lo justo para que las 3 entren en `width`, más un abanico mínimo. */
export function handOverlap(width: number, cardW: number, minFan: number, cardH = 0): number {
  // las cartas de los costados giran 6 grados sobre su base: la punta de arriba se abre ~10% del alto hacia afuera
  const need = (3 * cardW - (width - 2 * Math.round(cardH * 0.1))) / 2;
  return Math.max(minFan, Number.isFinite(need) ? Math.ceil(need) : 0);
}
