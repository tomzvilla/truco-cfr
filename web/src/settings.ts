import { useSyncExternalStore } from 'react';
import { resolveMotion } from './logic/motion';
import type { MotionSetting } from './logic/motion';

export interface Settings {
  crt: boolean;
  motion: MotionSetting;
  /** Modo rayos X de la mesa: muestra las probabilidades del bot. */
  xray: boolean;
}

const KEY = 'truco-cfr.settings.v1';
const DEFAULTS: Settings = { crt: false, motion: 'auto', xray: false };

export function parseSettings(raw: string | null): Settings {
  try {
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw);
    return {
      crt: o.crt === true,
      xray: o.xray === true,
      motion: o.motion === 'reduced' || o.motion === 'full' ? o.motion : 'auto',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    // modo privado o almacenamiento bloqueado
    return { ...DEFAULTS };
  }
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
let watchingSystem = false;

/**
 * Refleja las preferencias en <html>: `data-motion` es la elección del usuario (auto|reduced|full) y
 * `data-reduced` el resultado final (elección + preferencia del sistema), que es lo que lee base.css.
 */
function applyMotionAttributes(): void {
  if (typeof document === 'undefined') return;
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_QUERY) : null;
  if (mq && !watchingSystem) {
    watchingSystem = true;
    mq.addEventListener?.('change', applyMotionAttributes);
  }
  const root = document.documentElement;
  root.dataset.motion = state.motion;
  root.dataset.reduced = String(resolveMotion(state.motion, mq?.matches ?? false));
}

let state: Settings = load();
applyMotionAttributes();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getSettings = (): Settings => state;

export function updateSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch };
  applyMotionAttributes();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // modo privado o almacenamiento bloqueado: seguimos en memoria
  }
  emit();
}

/** Solo para tests. */
export function resetSettings(): void {
  state = { ...DEFAULTS };
  applyMotionAttributes();
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
