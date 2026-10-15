import type { EnginePort } from './protocol';

/** El Worker del motor. Vite reconoce este patrón exacto (`new URL(..., import.meta.url)`) y lo empaqueta. */
export function createEngineWorker(): EnginePort {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as EnginePort;
}
