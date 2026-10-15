import { ACTION_IDS, PLAY_ACTIONS, TRUCO_CALL_LEVEL } from './types';
import type { TableView } from './types';

/** Devuelve la lista de problemas; vacía si el TableView es coherente. */
export function validateTableView(v: TableView): string[] {
  const errors: string[] = [];

  if (v.hand.length !== 3) errors.push(`La mano debe tener 3 cartas (tiene ${v.hand.length})`);
  if (v.tricks.length > 3) errors.push('No puede haber más de 3 bazas');

  v.score.forEach((p, i) => {
    if (!Number.isInteger(p) || p < 0 || p > 30) {
      errors.push(`Puntaje fuera de 0..30 (${i === 0 ? 'yo' : 'bot'}: ${p})`);
    }
  });

  if (new Set(v.actions).size !== v.actions.length) errors.push('Hay acciones repetidas');
  for (const a of v.actions) {
    if (!(ACTION_IDS as readonly string[]).includes(a)) errors.push(`Acción desconocida: ${a}`);
  }

  PLAY_ACTIONS.forEach((id, n) => {
    if (!v.actions.includes(id)) return;
    const slot = v.hand[n];
    if (!slot) errors.push(`${id} está habilitada pero no existe esa carta`);
    else if (slot.played) errors.push(`${id} está habilitada pero esa carta ya se jugó`);
  });

  if (v.phase === 'finDeMano' && v.actions.length > 0) {
    errors.push('En finDeMano no puede haber acciones habilitadas');
  }

  const p = v.truco.pending;
  if (p && TRUCO_CALL_LEVEL[p.call] !== v.truco.acceptedLevel + 1) {
    errors.push(`Canto pendiente "${p.call}" incoherente con el nivel aceptado ${v.truco.acceptedLevel}`);
  }

  if (v.xray) {
    const sum = v.xray.reduce((acc, e) => acc + e.prob, 0);
    if (v.xray.some((e) => e.prob < 0 || e.prob > 1)) errors.push('Probabilidad de rayos X fuera de 0..1');
    if (Math.abs(sum - 1) > 0.01) errors.push(`Las probabilidades de rayos X suman ${sum.toFixed(3)}, no 1`);
    if (new Set(v.xray.map((e) => e.action)).size !== v.xray.length) errors.push('Rayos X con acciones repetidas');
  }

  if (v.botHand && v.botHand.length > 3) errors.push('botHand tiene más de 3 cartas');

  if (v.result && v.phase !== 'finDeMano') errors.push('result solo existe en finDeMano');
  if (v.matchWinner) {
    if (v.phase !== 'finDeMano') errors.push('matchWinner solo existe en finDeMano');
    const idx = v.matchWinner === 'yo' ? 0 : 1;
    if (v.score[idx] !== 30) errors.push(`matchWinner = ${v.matchWinner} pero tiene ${v.score[idx]} puntos`);
  }

  return errors;
}
