import { useMemo } from 'react';
import type { Mood } from '../table/types';
import { MASCOT_SIZE, mascotRects } from './mascot';

const MOOD_LABEL: Record<Mood, string> = {
  neutral: 'neutral',
  farol: 'haciendo farol',
  descubierto: 'descubierto',
  gana: 'ganando',
  pierde: 'perdiendo',
};

/** `scale` debe ser entero para conservar el pixel perfecto. */
export function Mascot({ mood, scale = 6 }: { mood: Mood; scale?: number }) {
  const rects = useMemo(() => mascotRects(mood), [mood]);
  const size = MASCOT_SIZE * scale;
  return (
    <svg
      className="mascot"
      data-mood={mood}
      role="img"
      aria-label={`Mascota del bot, ${MOOD_LABEL[mood]}`}
      viewBox={`0 0 ${MASCOT_SIZE} ${MASCOT_SIZE}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
