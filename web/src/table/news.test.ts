import { describe, expect, it } from 'vitest';
import { FIXTURES } from './fixtures';
import { envidoLine, handBreakdown, tableNews } from './news';
import type { TableView } from './types';

const base = FIXTURES.inicioDeMano; // soy mano, 3 a 5

const envidoQuerido = (over: Partial<TableView> = {}): TableView => ({
  ...base,
  mano: 'bot',
  envido: { calls: [{ call: 'realEnvido', by: 'bot' }], pending: null, reveal: { yo: null, bot: 31 } },
  envidoPoints: { yo: 0, bot: 3 },
  last: { by: 'yo', action: 'quiero' },
  ...over,
});

describe('envidoLine', () => {
  it('sin envido resuelto no hay línea', () => {
    expect(envidoLine(base)).toBeNull();
  });
  it('los tantos van en el orden en que se dicen: primero el mano', () => {
    expect(envidoLine(envidoQuerido())).toBe('Real envido: Bot (mano): 31 · Vos: son buenas → +3 para el bot');
  });
  it('soy mano y gano: muestro los dos tantos', () => {
    const v = envidoQuerido({
      mano: 'yo',
      envido: {
        calls: [{ call: 'envido', by: 'yo' }, { call: 'realEnvido', by: 'bot' }],
        pending: null,
        reveal: { yo: 33, bot: null },
      },
      envidoPoints: { yo: 5, bot: 0 },
    });
    expect(envidoLine(v)).toBe('Envido + real envido: Vos (mano): 33 · Bot: son buenas → +5 para vos');
  });
  it('el pie gana: se ven los dos tantos', () => {
    const v = envidoQuerido({
      envido: { calls: [{ call: 'envido', by: 'yo' }], pending: null, reveal: { yo: 30, bot: 27 } },
      envidoPoints: { yo: 2, bot: 0 },
    });
    expect(envidoLine(v)).toBe('Envido: Bot (mano): 27 · Vos: 30 → +2 para vos');
  });
  it('no querido: dice quién no quiso', () => {
    const noQuiso = envidoQuerido({
      envido: { calls: [{ call: 'envido', by: 'yo' }], pending: null, reveal: null },
      envidoPoints: { yo: 1, bot: 0 },
      last: { by: 'bot', action: 'noQuiero' },
    });
    expect(envidoLine(noQuiso)).toBe('Envido: el bot no quiso → +1 para vos');
    const noQuise = envidoQuerido({
      envido: { calls: [{ call: 'faltaEnvido', by: 'bot' }], pending: null, reveal: null },
      envidoPoints: { yo: 0, bot: 1 },
    });
    expect(envidoLine(noQuise)).toBe('Falta envido: no quisiste → +1 para el bot');
  });
});

describe('tableNews', () => {
  it('sin nada que contar, no hay cartel', () => {
    expect(tableNews(base)).toBeNull();
  });
  it('el bot canta truco: cartel grande', () => {
    expect(tableNews(FIXTURES.trucoPendiente)).toEqual({
      tone: 'bot',
      kicker: 'El bot canta',
      title: '¡TRUCO!',
      lines: [],
    });
  });
  it('el canto exacto del envido y la cadena si hubo más de uno', () => {
    const v: TableView = {
      ...base,
      envido: {
        calls: [{ call: 'envido', by: 'yo' }, { call: 'realEnvido', by: 'bot' }],
        pending: { by: 'bot' },
        reveal: null,
      },
    };
    expect(tableNews(v)).toEqual({
      tone: 'bot',
      kicker: 'El bot canta',
      title: '¡REAL ENVIDO!',
      lines: ['Envido → real envido'],
    });
  });
  it('el envido está primero: si el bot lo canta encima de mi truco, se ve el envido', () => {
    const v: TableView = {
      ...base,
      truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'yo' } },
      envido: { calls: [{ call: 'envido', by: 'bot' }], pending: { by: 'bot' }, reveal: null },
      last: { by: 'bot', action: 'envido' },
    };
    expect(tableNews(v)).toEqual({
      tone: 'bot',
      kicker: 'El bot canta',
      title: '¡ENVIDO!',
      lines: ['El truco queda esperando'],
    });
  });
  it('mi canto: el cartel dice que canté', () => {
    const v: TableView = { ...base, truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'yo' } } };
    expect(tableNews(v)).toMatchObject({ tone: 'yo', kicker: 'Cantaste', title: '¡TRUCO!', lines: [] });
  });
  it('la respuesta del bot y el resultado del envido quedan a la vista', () => {
    const v = envidoQuerido({
      mano: 'yo',
      envido: { calls: [{ call: 'envido', by: 'yo' }], pending: null, reveal: { yo: 33, bot: null } },
      envidoPoints: { yo: 2, bot: 0 },
      last: { by: 'bot', action: 'quiero' },
    });
    expect(tableNews(v)).toEqual({
      tone: 'bot',
      kicker: 'El bot',
      title: '¡QUIERO!',
      lines: ['Envido: Vos (mano): 33 · Bot: son buenas → +2 para vos'],
    });
  });
  it('después de la respuesta sigue el resumen, sin título', () => {
    const v = envidoQuerido({ last: { by: 'bot', action: 'jugar0' }, truco: { acceptedLevel: 3, pending: null } });
    expect(tableNews(v)).toEqual({
      tone: 'bot',
      lines: ['Real envido: Bot (mano): 31 · Vos: son buenas → +3 para el bot', 'Retruco querido: la mano vale 3'],
    });
  });
  it('con la mano terminada no hay cartel de cantos (está el de fin de mano)', () => {
    expect(tableNews(FIXTURES.finDeManoRayosX)).toBeNull();
  });
});

describe('handBreakdown', () => {
  const end = (over: Partial<TableView>): TableView => ({ ...base, phase: 'finDeMano', actions: [], ...over });

  it('separa el envido de lo que dio la mano', () => {
    const v = end({
      envido: { calls: [{ call: 'envido', by: 'yo' }], pending: null, reveal: { yo: 33, bot: null } },
      envidoPoints: { yo: 2, bot: 0 },
      truco: { acceptedLevel: 2, pending: null },
      result: { yo: 2, bot: 2, winner: null },
      last: { by: 'bot', action: 'jugar1' },
    });
    expect(handBreakdown(v)).toBe('Envido: +2 para vos · Truco: +2 para el bot');
  });
  it('sin cantos: la mano', () => {
    const v = end({ result: { yo: 1, bot: 0, winner: 'yo' }, last: { by: 'yo', action: 'jugar0' } });
    expect(handBreakdown(v)).toBe('La mano: +1 para vos');
  });
  it('dice quién no quiso el truco o se fue al mazo', () => {
    expect(handBreakdown(end({ result: { yo: 1, bot: 0, winner: 'yo' }, last: { by: 'bot', action: 'noQuiero' } }))).toBe(
      'El bot no quiso el truco: +1 para vos',
    );
    expect(handBreakdown(end({ result: { yo: 0, bot: 2, winner: 'bot' }, last: { by: 'yo', action: 'mazo' } }))).toBe(
      'Te fuiste al mazo: +2 para el bot',
    );
  });
  it('sin resultado no hay detalle', () => {
    expect(handBreakdown(base)).toBeNull();
  });
});
