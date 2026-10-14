export type MotionSetting = 'auto' | 'reduced' | 'full';

/** true = hay que reducir animaciones. */
export function resolveMotion(setting: MotionSetting, systemPrefersReduced: boolean): boolean {
  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  return systemPrefersReduced;
}

export interface MotionPolicy {
  idle: boolean;
  tilt: boolean;
  pop: boolean;
  burst: boolean;
  shake: boolean;
  swirlAnimated: boolean;
}

export function motionPolicy(reduced: boolean): MotionPolicy {
  const on = !reduced;
  return { idle: on, tilt: on, pop: on, burst: on, shake: on, swirlAnimated: on };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/** Inclinación (grados) de una carta según la posición del puntero dentro de su rectángulo. */
export function tiltFromPointer(rect: Rect, x: number, y: number, maxDeg = 12): { rx: number; ry: number } {
  if (rect.width <= 0 || rect.height <= 0) return { rx: 0, ry: 0 };
  const nx = clamp1(((x - rect.left) / rect.width) * 2 - 1);
  const ny = clamp1(((y - rect.top) / rect.height) * 2 - 1);
  return { rx: -ny * maxDeg, ry: nx * maxDeg };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Particle {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  size: number;
  color: number;
}

export function burstCount(delta: number): number {
  return delta <= 0 ? 0 : Math.min(24, 6 + 4 * delta);
}

export function burstParticles(count: number, seed: number): Particle[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + rnd() * 0.6;
    const dist = 28 + rnd() * 44;
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      rot: Math.round(rnd() * 360),
      delay: Math.round(rnd() * 80),
      size: 4 + Math.floor(rnd() * 3) * 2,
      color: i % 4,
    };
  });
}
