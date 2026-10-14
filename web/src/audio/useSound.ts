import { useCallback } from 'react';
import { getSettings, updateSettings, useSettings } from '../settings';
import { engine } from './engine';
import type { AudioEngine } from './engine';
import { MIN_GAP_MS, SFX } from './sfx';
import type { SfxName } from './sfx';

const last = new Map<SfxName, number>();

/**
 * Toca un efecto si hay audio desbloqueado (primer gesto del usuario), los efectos están prendidos y no hay silencio.
 * `nowMs` y `eng` se pueden inyectar para probarlo.
 */
export function playSfx(name: SfxName, arg?: number, eng: AudioEngine = engine, nowMs: number = Date.now()): boolean {
  const p = eng.getPrefs();
  if (!eng.ready || p.muted || !p.sfx) return false;
  const gap = MIN_GAP_MS[name];
  const prev = last.get(name);
  if (gap !== undefined && prev !== undefined && nowMs - prev < gap) return false;
  last.set(name, nowMs);
  SFX[name](eng, eng.now(), arg);
  return true;
}

/** Solo para tests. */
export function resetSfxLimits(): void {
  last.clear();
}

export function toggleMute(): void {
  updateSettings({ muted: !getSettings().muted });
}

/** Sonido para componentes: `play(nombre)`, silencio y preferencias. */
export function useSound() {
  const settings = useSettings();
  const play = useCallback((name: SfxName, arg?: number) => playSfx(name, arg), []);
  return { play, muted: settings.muted, toggleMute, settings };
}
