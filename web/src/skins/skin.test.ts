import { describe, it, expect } from 'vitest';
import { allCards } from '../table/types';
import { DEFAULT_SKIN, getSkin, jcanabalSkin } from './index';

describe('skin jcanabal', () => {
  it('mapea las 40 cartas a 40 URLs distintas con el formato palo-número.png', () => {
    const urls = allCards().map((c) => jcanabalSkin.faceUrl(c));
    expect(new Set(urls).size).toBe(40);
    for (const u of urls) {
      expect(u).toMatch(/cards\/jcanabal\/(espada|basto|oro|copa)-(1|2|3|4|5|6|7|10|11|12)\.png$/);
    }
  });
  it('un caso concreto', () => {
    expect(jcanabalSkin.faceUrl({ suit: 'oro', number: 7 }).endsWith('cards/jcanabal/oro-7.png')).toBe(true);
  });
  it('tamaño nativo 73x113 y crédito obligatorio', () => {
    expect(jcanabalSkin.native).toEqual({ w: 73, h: 113 });
    expect(jcanabalSkin.credit).toBe('Card art by Jose Angel Canabal');
  });
  it('el dorso es el propio (data URL SVG)', () => {
    expect(jcanabalSkin.backUrl().startsWith('data:image/svg+xml')).toBe(true);
  });
  it('getSkin con id desconocido cae en la skin por defecto', () => {
    expect(getSkin('inexistente')).toBe(DEFAULT_SKIN);
    expect(getSkin('jcanabal')).toBe(jcanabalSkin);
  });
});
