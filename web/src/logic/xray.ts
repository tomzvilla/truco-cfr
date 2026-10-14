import { ACTION_IDS } from '../table/types';
import type { ActionId, XRayEntry } from '../table/types';
import { actionLabel } from '../table/labels';
import { formatPct } from './format';

export interface XRayRow {
  action: ActionId;
  label: string;
  prob: number;
  text: string;
  widthPct: number;
}

export function xrayRows(entries: readonly XRayEntry[] | undefined): XRayRow[] {
  if (!entries) return [];
  return entries
    .filter((e) => e.prob > 0) // filter devuelve una copia: ordenar no muta la entrada
    .sort((a, b) => b.prob - a.prob || ACTION_IDS.indexOf(a.action) - ACTION_IDS.indexOf(b.action))
    .map((e) => ({
      action: e.action,
      label: actionLabel(e.action),
      prob: e.prob,
      text: formatPct(e.prob),
      widthPct: Math.max(2, Math.round(e.prob * 100)),
    }));
}
