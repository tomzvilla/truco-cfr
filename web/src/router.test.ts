import { describe, it, expect } from 'vitest';
import { parseHash, hrefFor, DEFAULT_ROUTE, ROUTES } from './router';

describe('parseHash', () => {
  it('reconoce cada ruta conocida', () => {
    for (const r of ROUTES) expect(parseHash(`#/${r}`)).toBe(r);
  });
  it('ignora query y subrutas', () => {
    expect(parseHash('#/manos?id=3')).toBe('manos');
    expect(parseHash('#/resultados/extra')).toBe('resultados');
  });
  it('cae en Jugar con hash vacío o desconocido', () => {
    expect(parseHash('')).toBe(DEFAULT_ROUTE);
    expect(parseHash('#')).toBe(DEFAULT_ROUTE);
    expect(parseHash('#/nada-que-ver')).toBe(DEFAULT_ROUTE);
    expect(DEFAULT_ROUTE).toBe('jugar');
  });
  it('hrefFor es la inversa de parseHash', () => {
    for (const r of ROUTES) expect(parseHash(hrefFor(r))).toBe(r);
  });
});
