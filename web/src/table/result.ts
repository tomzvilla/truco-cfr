import type { Seat, TableView } from './types';

/** El cartel de fin de mano o de partido. Los puntos los calcula el motor. */
export function resultLine(view: TableView): string {
  if (view.matchWinner) return view.matchWinner === 'yo' ? '¡Ganaste el partido!' : 'El bot ganó el partido';
  const r = view.result;
  if (!r) return 'Mano terminada';
  if (r.winner === 'yo') return `Ganaste la mano: +${r.yo}${r.bot ? ` (el bot +${r.bot})` : ''}`;
  if (r.winner === 'bot') return `Ganó el bot: +${r.bot}${r.yo ? ` (vos +${r.yo})` : ''}`;
  return `Mano pareja: +${r.yo} cada uno`;
}

/** Para `data-outcome` del cartel: quién ganó el partido o, si no terminó, la mano. */
export function outcomeOf(view: TableView): Seat | 'none' {
  return view.matchWinner ?? view.result?.winner ?? 'none';
}
