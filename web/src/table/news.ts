import { CALL_LABEL } from './labels';
import type { Seat, TableView, TrucoCall } from './types';

/** El cartel del paño: lo que se cantó o respondió y cómo viene la mano. */
export interface News {
  /** Quién habla: colorea el cartel. */
  tone: Seat;
  /** "El bot canta", "Cantaste", "El bot". Sin título, el cartel es solo el resumen. */
  kicker?: string;
  title?: string;
  lines: string[];
}

const LEVEL_CALL: Record<number, TrucoCall> = { 2: 'truco', 3: 'retruco', 4: 'valeCuatro' };

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const shout = (s: string): string => `¡${s.toUpperCase()}!`;
const gainText = (p: { yo: number; bot: number }): string =>
  p.yo > 0 ? `+${p.yo} para vos` : `+${p.bot} para el bot`;
const seatName = (s: Seat): string => (s === 'yo' ? 'Vos' : 'Bot');

/** "Envido + real envido": los cantos de la mano, en orden. */
function envidoChain(v: TableView, sep: string): string {
  return capitalize(v.envido.calls.map((c) => CALL_LABEL[c.call]).join(sep));
}

/**
 * El envido resuelto, en una línea. Los tantos van en el orden en que se dicen: primero el mano;
 * el otro dice su número o "son buenas" si no le alcanza.
 */
export function envidoLine(v: TableView): string | null {
  const pts = v.envidoPoints;
  if (!pts) return null;
  const chain = envidoChain(v, ' + ');
  const reveal = v.envido.reveal;
  if (!reveal) {
    const decliner = pts.yo > 0 ? 'el bot no quiso' : 'no quisiste';
    return `${chain}: ${decliner} → ${gainText(pts)}`;
  }
  const first = v.mano;
  const second: Seat = first === 'yo' ? 'bot' : 'yo';
  const said = (s: Seat): string => {
    const n = reveal[s];
    return n === null ? 'son buenas' : String(n);
  };
  return `${chain}: ${seatName(first)} (mano): ${said(first)} · ${seatName(second)}: ${said(second)} → ${gainText(pts)}`;
}

function trucoLine(v: TableView): string | null {
  const level = v.truco.acceptedLevel;
  const call = LEVEL_CALL[level];
  return call ? `${capitalize(CALL_LABEL[call])} querido: la mano vale ${level}` : null;
}

/** Qué mostrar en el paño mientras se juega la mano; `null` si no hay nada que contar. */
export function tableNews(v: TableView): News | null {
  if (v.phase === 'finDeMano') return null;
  const envido = envidoLine(v);

  // como mucho dos líneas, así el cartel entra en la franja reservada del paño. "Te toca responder" ya
  // lo dicen los botones Quiero / No quiero, y el resultado del envido vuelve apenas se responde.
  const canto = (by: Seat, title: string, chain: string[]): News => ({
    tone: by,
    kicker: by === 'bot' ? 'El bot canta' : 'Cantaste',
    title,
    lines: chain,
  });

  // el envido va primero: si alguien lo canta encima de un truco, se responde antes y el truco espera
  const tp = v.truco.pending;
  const ep = v.envido.pending;
  const lastCall = v.envido.calls[v.envido.calls.length - 1];
  if (ep && lastCall) {
    const chain = v.envido.calls.length > 1 ? [envidoChain(v, ' → ')] : [];
    const waiting = tp ? [`El ${CALL_LABEL[tp.call]} queda esperando`] : [];
    return canto(ep.by, shout(CALL_LABEL[lastCall.call]), [...chain, ...waiting]);
  }
  if (tp) return canto(tp.by, shout(CALL_LABEL[tp.call]), []);

  const lines = [envido, trucoLine(v)].filter((l): l is string => l !== null);
  const last = v.last;
  if (last?.by === 'bot' && (last.action === 'quiero' || last.action === 'noQuiero')) {
    return { tone: 'bot', kicker: 'El bot', title: last.action === 'quiero' ? '¡QUIERO!' : 'NO QUIERO', lines };
  }
  if (lines.length === 0) return null;
  return { tone: v.envidoPoints && v.envidoPoints.bot > 0 ? 'bot' : 'yo', lines };
}

/** El detalle del cartel de fin de mano: de dónde salió cada punto. */
export function handBreakdown(v: TableView): string | null {
  const r = v.result;
  if (!r) return null;
  const env = v.envidoPoints ?? { yo: 0, bot: 0 };
  const parts: string[] = [];
  if (env.yo + env.bot > 0) parts.push(`Envido: ${gainText(env)}`);

  const rest = { yo: r.yo - env.yo, bot: r.bot - env.bot };
  if (rest.yo + rest.bot > 0) {
    const last = v.last;
    const mine = last?.by === 'yo';
    let label: string;
    if (last?.action === 'mazo') label = mine ? 'Te fuiste al mazo' : 'El bot se fue al mazo';
    else if (last?.action === 'noQuiero') label = mine ? 'No quisiste el truco' : 'El bot no quiso el truco';
    else {
      const call = LEVEL_CALL[v.truco.acceptedLevel];
      label = call ? capitalize(CALL_LABEL[call]) : 'La mano';
    }
    parts.push(`${label}: ${gainText(rest)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
