import { useSyncExternalStore } from 'react';
import { motionPolicy, resolveMotion } from '../logic/motion';
import type { MotionPolicy } from '../logic/motion';
import { useSettings } from '../settings';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.('change', cb);
  return () => mq.removeEventListener?.('change', cb);
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

export function useMotionPolicy(): MotionPolicy {
  const { motion } = useSettings();
  const system = useSystemReducedMotion();
  return motionPolicy(resolveMotion(motion, system));
}
