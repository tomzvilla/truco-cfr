import { CALL_LABEL } from './labels';
import type { TableView } from './types';

export interface StatusLine {
  key: string;
  text: string;
}

const tantos = (n: number | null): string => (n === null ? 'son buenas' : String(n));

export function describeStatus(v: TableView): StatusLine[] {
  const lines: StatusLine[] = [{ key: 'mano', text: v.mano === 'yo' ? 'Sos mano' : 'El bot es mano' }];

  const tp = v.truco.pending;
  if (tp) {
    lines.push({
      key: 'truco',
      text: tp.by === 'bot'
        ? `El bot cantó ${CALL_LABEL[tp.call]}. Respondé.`
        : `Cantaste ${CALL_LABEL[tp.call]}. El bot está pensando.`,
    });
  } else if (v.truco.acceptedLevel > 1) {
    lines.push({ key: 'truco', text: `Truco aceptado: la mano vale ${v.truco.acceptedLevel}` });
  } else {
    lines.push({ key: 'truco', text: 'Truco sin cantar: la mano vale 1' });
  }

  const e = v.envido;
  if (e.pending) {
    const last = e.calls[e.calls.length - 1];
    if (!last) lines.push({ key: 'envido', text: 'Hay un envido pendiente.' });
    else {
      lines.push({
        key: 'envido',
        text: e.pending.by === 'bot'
          ? `El bot cantó ${CALL_LABEL[last.call]}. Respondé.`
          : `Cantaste ${CALL_LABEL[last.call]}. El bot está pensando.`,
      });
    }
  } else if (e.calls.length > 0) {
    lines.push({ key: 'envido', text: `Envido cantado: ${e.calls.map((c) => CALL_LABEL[c.call]).join(' y ')}` });
  }

  if (e.reveal && (e.reveal.yo !== null || e.reveal.bot !== null)) {
    lines.push({ key: 'tantos', text: `Tantos. Vos: ${tantos(e.reveal.yo)}. Bot: ${tantos(e.reveal.bot)}.` });
  }
  return lines;
}

export function isValeCuatroMoment(v: TableView): boolean {
  return v.truco.pending?.call === 'valeCuatro' || v.truco.acceptedLevel === 4;
}
