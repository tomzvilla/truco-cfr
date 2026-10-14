import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import './fx.css';

export function ShakeRoot({ trigger, children }: { trigger: number; children: ReactNode }) {
  const policy = useMotionPolicy();
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (trigger <= 0 || !policy.shake) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [trigger, policy.shake]);

  return (
    <div className="shake-root" data-shaking={String(shaking)}>
      {children}
    </div>
  );
}
