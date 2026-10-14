import { describe, it, expect } from 'vitest';
import { SUITS, CARD_NUMBERS } from '../table/types';
import { destName, formatProblems, normalize, planImport, pngSize } from '../../scripts/cards-lib';
import type { SourceNamer } from '../../scripts/cards-lib';
import { sourceNamer } from '../../scripts/cards-map';

const namer: SourceNamer = (suit, n) => `${suit}s/${String(n).padStart(2, '0')}.png`;
const allFiles = SUITS.flatMap((s) => CARD_NUMBERS.map((n) => `Deck/${namer(s, n)}`));

describe('planImport', () => {
  it('con las 40 cartas presentes (aun dentro de una carpeta raíz) arma 40 copias', () => {
    const plan = planImport(allFiles, namer);
    expect(plan.copies).toHaveLength(40);
    expect(plan.missing).toEqual([]);
    expect(plan.copies[0]).toEqual({ from: 'Deck/espadas/01.png', to: 'espada-1.png' });
  });
  it('es insensible a mayúsculas y separadores de Windows', () => {
    const files = allFiles.map((f) => f.toUpperCase().replace(/\//g, '\\'));
    expect(planImport(files, namer).copies).toHaveLength(40);
  });
  it('informa exactamente qué carta falta', () => {
    const plan = planImport(allFiles.filter((f) => !f.endsWith('oros/07.png')), namer);
    expect(plan.copies).toHaveLength(39);
    expect(plan.missing).toEqual(['oro-7.png (esperaba "oros/07.png")']);
    const lines = formatProblems(plan);
    expect(lines.join('\n')).toContain('Faltan 1 de las 40 cartas');
    expect(lines.join('\n')).toContain('oro-7.png');
  });
  it('detecta archivos ambiguos', () => {
    const plan = planImport([...allFiles, 'Otra/espadas/01.png'], namer);
    expect(plan.ambiguous).toHaveLength(1);
    expect(formatProblems(plan).join('\n')).toContain('espada-1.png');
  });
  it('destName y normalize', () => {
    expect(destName('copa', 12)).toBe('copa-12.png');
    expect(normalize('.\\a\\b.png')).toBe('a/b.png');
  });
});

describe('cards-map (layout real del zip: free_deck/<k>.PNG)', () => {
  it('k = índice de palo (oro, copa, espada, basto) * 10 + índice de número + 1', () => {
    expect(sourceNamer('oro', 1)).toBe('free_deck/1.png');
    expect(sourceNamer('oro', 10)).toBe('free_deck/8.png');
    expect(sourceNamer('espada', 7)).toBe('free_deck/27.png');
    expect(sourceNamer('basto', 12)).toBe('free_deck/40.png');
    expect(sourceNamer('copa', 1)).toBe('free_deck/11.png');
  });
  it('un zip con free_deck/1..40.PNG (más back.PNG) da 40 copias sin ambigüedad', () => {
    const files = [...Array.from({ length: 40 }, (_, i) => `free_deck/${i + 1}.PNG`), 'free_deck/back.PNG'];
    const plan = planImport(files, sourceNamer);
    expect(plan.copies).toHaveLength(40);
    expect(plan.missing).toEqual([]);
    expect(plan.ambiguous).toEqual([]);
    expect(plan.copies).toContainEqual({ from: 'free_deck/27.PNG', to: 'espada-7.png' });
    expect(plan.copies).toContainEqual({ from: 'free_deck/8.PNG', to: 'oro-10.png' });
    expect(plan.copies.some((c) => c.from.includes('back'))).toBe(false);
  });
});

describe('pngSize', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(b.buffer);
    dv.setUint32(16, w);
    dv.setUint32(20, h);
    return b;
  };
  it('lee el ancho y alto del encabezado', () => {
    expect(pngSize(png(73, 113))).toEqual({ w: 73, h: 113 });
  });
  it('devuelve null si no es PNG', () => {
    expect(pngSize(new Uint8Array(30))).toBeNull();
    expect(pngSize(new Uint8Array(3))).toBeNull();
  });
});
