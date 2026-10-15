import type { TableView } from './types';

export interface StatusLine {
  key: string;
  text: string;
}

/** El resumen chico del anotador: quién es mano y cuánto vale la mano. Los cantos y el envido van en el paño (news.ts). */
export function describeStatus(v: TableView): StatusLine[] {
  return [
    { key: 'mano', text: v.mano === 'yo' ? 'Sos mano' : 'El bot es mano' },
    { key: 'valor', text: `La mano vale ${v.truco.acceptedLevel}` },
  ];
}

export function isValeCuatroMoment(v: TableView): boolean {
  return v.truco.pending?.call === 'valeCuatro' || v.truco.acceptedLevel === 4;
}
