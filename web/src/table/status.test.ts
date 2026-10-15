import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures';
import { describeStatus, isValeCuatroMoment } from './status';
import type { TableView } from './types';

const texts = (v: TableView) => describeStatus(v).map((l) => l.text);

describe('describeStatus', () => {
  it('inicio de mano', () => {
    expect(texts(FIXTURES.inicioDeMano)).toEqual(['Sos mano', 'La mano vale 1']);
  });
  it('el bot es mano', () => {
    expect(texts(FIXTURES.trucoPendiente)).toEqual(['El bot es mano', 'La mano vale 1']);
  });
  it('con el truco querido sube lo que vale la mano', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, truco: { acceptedLevel: 3, pending: null } };
    expect(texts(v)).toContain('La mano vale 3');
  });
});

describe('isValeCuatroMoment', () => {
  it('es verdadero con vale cuatro pendiente o aceptado', () => {
    const base = FIXTURES.trucoPendiente;
    expect(isValeCuatroMoment(base)).toBe(false);
    expect(isValeCuatroMoment({ ...base, truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } } })).toBe(true);
    expect(isValeCuatroMoment({ ...base, truco: { acceptedLevel: 4, pending: null } })).toBe(true);
  });
});
