import { useEffect, useRef, useState } from 'react';
import { createSwirl } from './swirl';
import { useMotionPolicy } from './useMotionPolicy';

/** Fondo remolino. El CSS (.swirl) ya pinta un degradé cónico: es el fallback y lo que se ve antes del primer frame. */
export function SwirlBackground() {
  const policy = useMotionPolicy();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createSwirl(canvas, () => setFallback(true));
    if (!handle) {
      setFallback(true);
      return;
    }
    const still = () => handle.draw(12);
    if (policy.swirlAnimated) handle.start();
    else {
      still();
      window.addEventListener('resize', still);
    }
    return () => {
      window.removeEventListener('resize', still);
      handle.destroy();
    };
  }, [policy.swirlAnimated]);

  return (
    <div className="swirl" aria-hidden="true" data-fallback={String(fallback)}>
      {fallback ? null : <canvas ref={canvasRef} className="swirl__canvas" />}
    </div>
  );
}
