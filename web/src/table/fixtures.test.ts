import { describe, it, expect } from 'vitest';
import { FIXTURES, FIXTURE_NAMES } from './fixtures';
import { validateTableView } from './validate';
import type { TableView } from './types';

describe('fixtures', () => {
  it('son exactamente las cuatro esperadas', () => {
    expect([...FIXTURE_NAMES]).toEqual([
      'inicioDeMano', 'envidoPendiente', 'trucoPendiente', 'finDeManoRayosX',
    ]);
  });
  it.each(FIXTURE_NAMES)('%s es un TableView válido', (name) => {
    expect(validateTableView(FIXTURES[name])).toEqual([]);
  });
  it('el fin de mano trae rayos X y cartas del bot reveladas', () => {
    const v = FIXTURES.finDeManoRayosX;
    expect(v.phase).toBe('finDeMano');
    expect(v.xray?.length).toBeGreaterThan(1);
    expect(v.botHand).toHaveLength(3);
    expect(v.actions).toEqual([]);
  });
  it('el truco pendiente lo cantó el bot y se puede subir', () => {
    const v = FIXTURES.trucoPendiente;
    expect(v.truco.pending).toEqual({ call: 'truco', by: 'bot' });
    expect(v.actions).toContain('retruco');
  });
});

describe('validateTableView detecta incoherencias', () => {
  const base = FIXTURES.inicioDeMano;
  const withChange = (patch: Partial<TableView>): TableView => ({ ...base, ...patch });

  it('jugar una carta ya jugada', () => {
    const hand = base.hand.map((h, i) => (i === 0 ? { ...h, played: true } : h));
    expect(validateTableView(withChange({ hand }))).toContain('jugar0 está habilitada pero esa carta ya se jugó');
  });
  it('puntaje fuera de 0..30', () => {
    expect(validateTableView(withChange({ score: [31, 0] }))).toEqual(['Puntaje fuera de 0..30 (yo: 31)']);
    expect(validateTableView(withChange({ score: [0, -1] }))).toEqual(['Puntaje fuera de 0..30 (bot: -1)']);
  });
  it('acciones repetidas', () => {
    expect(validateTableView(withChange({ actions: ['truco', 'truco'] }))).toEqual(['Hay acciones repetidas']);
  });
  it('probabilidades de rayos X que no suman 1', () => {
    const xray = [{ action: 'truco' as const, prob: 0.2 }, { action: 'mazo' as const, prob: 0.2 }];
    expect(validateTableView(withChange({ xray }))).toEqual(['Las probabilidades de rayos X suman 0.400, no 1']);
  });
  it('canto pendiente incoherente con el nivel aceptado', () => {
    const truco = { acceptedLevel: 1 as const, pending: { call: 'retruco' as const, by: 'bot' as const } };
    expect(validateTableView(withChange({ truco }))).toEqual([
      'Canto pendiente "retruco" incoherente con el nivel aceptado 1',
    ]);
  });
  it('acciones en finDeMano', () => {
    expect(validateTableView(withChange({ phase: 'finDeMano' }))).toContain(
      'En finDeMano no puede haber acciones habilitadas',
    );
  });
});
