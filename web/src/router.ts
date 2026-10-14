import { useSyncExternalStore } from 'react';

export const ROUTES = ['jugar', 'como-funciona', 'resultados', 'manos', 'playground'] as const;
export type RouteId = (typeof ROUTES)[number];
export const DEFAULT_ROUTE: RouteId = 'jugar';

export function parseHash(hash: string): RouteId {
  const first = hash.replace(/^#\/?/, '').split(/[?/]/)[0] ?? '';
  return (ROUTES as readonly string[]).includes(first) ? (first as RouteId) : DEFAULT_ROUTE;
}

export function hrefFor(route: RouteId): string {
  return `#/${route}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): RouteId {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}
