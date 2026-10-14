import { useEffect, useRef, useState } from 'react';
import { groupRects, fosforitos } from '../logic/fosforitos';
import type { GroupFill } from '../logic/fosforitos';
import type { Seat } from '../table/types';
import { PointsBurst } from './PointsBurst';

interface Fx {
  delta: number;
  key: number;
}

function useScoreFx(yo: number, bot: number): { yo: Fx; bot: Fx } {
  const prev = useRef({ yo: fosforitos(yo).points, bot: fosforitos(bot).points });
  const [fx, setFx] = useState({ yo: { delta: 0, key: 0 }, bot: { delta: 0, key: 0 } });
  useEffect(() => {
    // se compara el puntaje ya acotado, así NaN o 99 no generan explosiones raras
    const now = { yo: fosforitos(yo).points, bot: fosforitos(bot).points };
    if (now.yo > prev.current.yo) {
      const delta = now.yo - prev.current.yo;
      setFx((f) => ({ ...f, yo: { delta, key: f.yo.key + 1 } }));
    }
    if (now.bot > prev.current.bot) {
      const delta = now.bot - prev.current.bot;
      setFx((f) => ({ ...f, bot: { delta, key: f.bot.key + 1 } }));
    }
    prev.current = now;
  }, [yo, bot]);
  return fx;
}

function Group({ fill }: { fill: GroupFill }) {
  return (
    <svg className="fosforito" data-fill={fill} viewBox="0 0 12 12" width="24" height="24" shapeRendering="crispEdges" aria-hidden="true">
      {groupRects(fill).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.kind === 'cruz' ? 'var(--ambar)' : 'var(--tiza)'} />
      ))}
    </svg>
  );
}

function Row({ who, points, isMano, fx }: { who: string; points: number; isMano: boolean; fx: Fx }) {
  const b = fosforitos(points);
  return (
    <div className="score__row" role="group" aria-label={`${who}: ${b.points} puntos`}>
      <span className="score__name">
        {who}
        {isMano ? <small> (mano)</small> : null}
      </span>
      <span className="score__half">{b.malas.map((f, i) => <Group key={i} fill={f} />)}</span>
      <span className="score__half">{b.buenas.map((f, i) => <Group key={i} fill={f} />)}</span>
      <span className="score__num">
        {b.points}
        <PointsBurst delta={fx.delta} burstKey={fx.key} />
      </span>
    </div>
  );
}

export function Scoreboard({ score, mano }: { score: readonly [number, number]; mano: Seat }) {
  const fx = useScoreFx(score[0], score[1]);
  return (
    <section className="score panel" aria-label="Marcador">
      <div className="score__legend" aria-hidden="true">
        <span />
        <span>Malas</span>
        <span>Buenas</span>
        <span />
      </div>
      <Row who="Vos" points={score[0]} isMano={mano === 'yo'} fx={fx.yo} />
      <Row who="Bot" points={score[1]} isMano={mano === 'bot'} fx={fx.bot} />
    </section>
  );
}
