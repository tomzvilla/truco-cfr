import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures';
import { describeStatus, isValeCuatroMoment } from './status';
import type { TableView } from './types';

const texts = (v: TableView) => describeStatus(v).map((l) => l.text);

describe('describeStatus', () => {
  it('inicio de mano', () => {
    expect(texts(FIXTURES.inicioDeMano)).toEqual(['Sos mano', 'Truco sin cantar: la mano vale 1']);
  });
  it('envido pendiente cantado por el bot', () => {
    expect(texts(FIXTURES.envidoPendiente)).toContain('El bot cantó envido. Respondé.');
  });
  it('truco pendiente cantado por el bot', () => {
    const t = texts(FIXTURES.trucoPendiente);
    expect(t).toContain('El bot es mano');
    expect(t).toContain('El bot cantó truco. Respondé.');
  });
  it('canto propio pendiente', () => {
    const v: TableView = {
      ...FIXTURES.inicioDeMano,
      truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'yo' } },
    };
    expect(texts(v)).toContain('Cantaste truco. El bot está pensando.');
  });
  it('truco aceptado y tantos revelados (uno dijo "son buenas")', () => {
    const v: TableView = {
      ...FIXTURES.inicioDeMano,
      truco: { acceptedLevel: 3, pending: null },
      envido: {
        calls: [{ call: 'envido', by: 'yo' }, { call: 'realEnvido', by: 'bot' }],
        pending: null,
        reveal: { yo: 29, bot: null },
      },
    };
    const t = texts(v);
    expect(t).toContain('Truco aceptado: la mano vale 3');
    expect(t).toContain('Envido cantado: envido y real envido');
    expect(t).toContain('Tantos. Vos: 29. Bot: son buenas.');
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
