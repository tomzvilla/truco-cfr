import { useCallback, useEffect, useRef } from 'react';
import { handOutcome } from '../game/rules';
import type { ActionId, TableView } from '../table/types';
import type { SfxName } from './sfx';
import { playSfx } from './useSound';

const ACTION_SFX: Partial<Record<ActionId, SfxName>> = {
  jugar0: 'play',
  jugar1: 'play',
  jugar2: 'play',
  envido: 'envido',
  realEnvido: 'envido',
  faltaEnvido: 'envido',
  truco: 'truco',
  retruco: 'retruco',
  valeCuatro: 'valeCuatro',
  quiero: 'quiero',
  noQuiero: 'noQuiero',
};

const botCards = (v: TableView): number => v.tricks.filter((t) => t.bot).length;

/**
 * Único lugar que traduce lo que pasa en la mesa a sonidos: lo que hace el jugador (acciones) y lo que cambia en la
 * vista (carta del bot, cantos del bot, puntos, fin de la mano, mano nueva). Devuelve el `onAction` a usar en la mesa.
 */
export function useGameSounds(view: TableView, dispatch: (a: ActionId) => void): (a: ActionId) => void {
  const prev = useRef(view);

  const onAction = useCallback(
    (a: ActionId) => {
      const sfx = ACTION_SFX[a];
      if (sfx) playSfx(sfx);
      dispatch(a);
    },
    [dispatch],
  );

  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (p === view) return;

    // mano nueva: se reparte
    if (p.phase === 'finDeMano' && view.phase === 'jugando') {
      playSfx('deal');
      return;
    }
    if (botCards(view) > botCards(p)) playSfx('play');
    const bp = view.truco.pending;
    if (bp && bp.by === 'bot' && (p.truco.pending?.call !== bp.call || p.truco.pending?.by !== 'bot')) playSfx(bp.call);
    if (view.envido.pending?.by === 'bot' && p.envido.pending?.by !== 'bot') playSfx('envido');

    const gained = view.score[0] - p.score[0] + (view.score[1] - p.score[1]);
    if (gained > 0) playSfx('points', gained);

    if (p.phase !== 'finDeMano' && view.phase === 'finDeMano') {
      const matchOver = view.score[0] >= 30 && view.score[0] > p.score[0];
      if (matchOver) playSfx('matchWon');
      else {
        const winner = handOutcome(view.tricks, view.mano) ?? (view.score[0] > p.score[0] ? 'yo' : 'bot');
        playSfx(winner === 'yo' ? 'handWon' : 'handLost');
      }
    }
  }, [view]);

  return onAction;
}
