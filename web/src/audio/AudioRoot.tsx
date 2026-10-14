import { useEffect, useRef } from 'react';
import { useSettings } from '../settings';
import { engine } from './engine';
import { MusicScheduler } from './music';
import { playSfx } from './useSound';

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Un solo lugar donde vive el sonido global: desbloquea el audio en el primer gesto, sincroniza las preferencias con el
 * motor, prende y apaga la música y toca los sonidos de interfaz (hover y click de botones) por delegación de eventos.
 */
export function AudioRoot() {
  const settings = useSettings();
  const music = useRef<MusicScheduler | null>(null);
  const unlocked = useRef(false);

  const sync = () => {
    engine.setPrefs(settings);
    if (!engine.ready) return;
    music.current ??= new MusicScheduler(engine);
    const wantMusic = settings.music && !settings.muted;
    if (wantMusic && !music.current.running) music.current.start();
    if (!wantMusic && music.current.running) music.current.stop();
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    syncRef.current();
  }, [settings]);

  // el primer gesto crea y reanuda el AudioContext (política de autoplay de los navegadores)
  useEffect(() => {
    const unlock = () => {
      if (unlocked.current) return;
      if (engine.unlock()) {
        unlocked.current = true;
        syncRef.current();
        for (const g of GESTURES) document.removeEventListener(g, unlock, true);
      }
    };
    for (const g of GESTURES) document.addEventListener(g, unlock, true);
    return () => {
      for (const g of GESTURES) document.removeEventListener(g, unlock, true);
    };
  }, []);

  // sonidos de interfaz: hover (suave) y click de cualquier botón; las cartas de la mano tienen su propio blip
  useEffect(() => {
    const target = (e: Event): HTMLElement | null => (e.target as HTMLElement | null)?.closest?.('button, a[href]') ?? null;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = target(e);
      if (!el || (el as HTMLButtonElement).disabled) return;
      playSfx(el.classList.contains('pcard') ? 'cardHover' : 'hover');
    };
    const onFocus = (e: FocusEvent) => {
      const el = target(e);
      if (el?.classList.contains('pcard')) playSfx('cardHover');
    };
    const onClick = (e: MouseEvent) => {
      const el = target(e);
      if (el && !(el as HTMLButtonElement).disabled && !el.classList.contains('pcard')) playSfx('press');
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return null;
}
