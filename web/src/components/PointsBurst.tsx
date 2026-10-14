import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import { burstCount, burstParticles } from '../logic/motion';
import './fx.css';

const COLORS = ['var(--ambar)', 'var(--brasa)', 'var(--menta)', 'var(--tiza)'];

/** Duración del +N; coincide con `burst-label` en fx.css. Con animaciones reducidas el CSS no lo anima, así que lo quita este timer. */
export const BURST_MS = 900;

/** `burstKey` cambia en cada suma para reiniciar la animación, la semilla y el timer. */
export function PointsBurst({ delta, burstKey }: { delta: number; burstKey: number }) {
  const policy = useMotionPolicy();
  const [doneKey, setDoneKey] = useState<number | null>(null);
  const particles = useMemo(
    () => (policy.burst ? burstParticles(burstCount(delta), burstKey + 1) : []),
    [delta, burstKey, policy.burst],
  );

  useEffect(() => {
    if (delta <= 0) return;
    const t = setTimeout(() => setDoneKey(burstKey), BURST_MS);
    return () => clearTimeout(t);
  }, [delta, burstKey]);

  if (delta <= 0 || doneKey === burstKey) return null;
  return (
    <span className="burst" key={burstKey} role="status">
      <span className="burst__label">+{delta}</span>
      {particles.map((p, i) => (
        <span
          key={i}
          className="burst__p"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--d': `${p.delay}ms`,
              '--s': `${p.size}px`,
              '--c': COLORS[p.color],
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
