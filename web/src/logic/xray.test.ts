import { describe, it, expect } from 'vitest';
import { FIXTURES } from '../table/fixtures';
import { xrayRows } from './xray';

describe('xrayRows', () => {
  it('ordena de mayor a menor probabilidad con etiquetas y porcentajes', () => {
    const rows = xrayRows(FIXTURES.finDeManoRayosX.xray);
    expect(rows.map((r) => r.action)).toEqual(['jugar1', 'truco', 'mazo']);
    expect(rows[0]).toMatchObject({ label: 'Jugar carta 2', text: '58%', widthPct: 58 });
  });
  it('sin datos devuelve lista vacía', () => {
    expect(xrayRows(undefined)).toEqual([]);
    expect(xrayRows([])).toEqual([]);
  });
  it('descarta probabilidad cero y marca <1% con barra mínima visible', () => {
    const rows = xrayRows([
      { action: 'truco', prob: 0.996 },
      { action: 'mazo', prob: 0.004 },
      { action: 'quiero', prob: 0 },
    ]);
    expect(rows.map((r) => r.action)).toEqual(['truco', 'mazo']);
    expect(rows[1]).toMatchObject({ text: '<1%', widthPct: 2 });
  });
  it('desempata por el orden de las acciones del motor', () => {
    const input = [
      { action: 'mazo' as const, prob: 0.5 },
      { action: 'envido' as const, prob: 0.5 },
    ];
    expect(xrayRows(input).map((r) => r.action)).toEqual(['envido', 'mazo']);
  });
  it('no muta la entrada (ni el arreglo ni su orden)', () => {
    const input = Object.freeze([
      Object.freeze({ action: 'mazo' as const, prob: 0.2 }),
      Object.freeze({ action: 'envido' as const, prob: 0.3 }),
      Object.freeze({ action: 'truco' as const, prob: 0.5 }),
    ]);
    // en modo estricto, ordenar o tocar un arreglo congelado tiraría TypeError
    expect(xrayRows(input).map((r) => r.action)).toEqual(['truco', 'envido', 'mazo']);
    expect(input.map((e) => e.action)).toEqual(['mazo', 'envido', 'truco']);
  });
});
