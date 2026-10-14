/** jsdom no trae matchMedia. `reduced` simula prefers-reduced-motion: reduce. */
export function mockMatchMedia(reduced: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
