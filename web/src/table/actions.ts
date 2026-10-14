import { ACTION_IDS, PLAY_ACTIONS } from './types';
import type { ActionId } from './types';
import { actionLabel } from './labels';

export interface ActionButton {
  id: ActionId;
  label: string;
  tone: 'respuesta' | 'envido' | 'truco' | 'mazo';
}

export interface ActionLayout {
  cartas: ActionId[];
  respuesta: ActionButton[];
  envido: ActionButton[];
  truco: ActionButton[];
  mazo: ActionButton[];
}

const TONE: Partial<Record<ActionId, ActionButton['tone']>> = {
  envido: 'envido', realEnvido: 'envido', faltaEnvido: 'envido',
  truco: 'truco', retruco: 'truco', valeCuatro: 'truco',
  quiero: 'respuesta', noQuiero: 'respuesta',
  mazo: 'mazo',
};

/** Con un truco pendiente, subir el canto es "aceptar y subir": "Quiero retruco". */
function labelFor(id: ActionId, pendingTruco: boolean): string {
  if (pendingTruco && id === 'retruco') return 'Quiero retruco';
  if (pendingTruco && id === 'valeCuatro') return 'Quiero vale cuatro';
  return actionLabel(id);
}

export function layoutActions(actions: readonly ActionId[], pendingTruco: boolean): ActionLayout {
  const layout: ActionLayout = { cartas: [], respuesta: [], envido: [], truco: [], mazo: [] };
  for (const id of ACTION_IDS) {
    if (!actions.includes(id)) continue;
    if ((PLAY_ACTIONS as readonly string[]).includes(id)) {
      layout.cartas.push(id);
      continue;
    }
    const tone = TONE[id]!;
    layout[tone].push({ id, label: labelFor(id, pendingTruco), tone });
  }
  return layout;
}
