import { describe, expect, it } from 'vitest';
import { FIXTURES } from './fixtures';
import { BOT_PHRASES, botLine } from './phrases';
import type { ActionId, TableView } from './types';

const base = FIXTURES.inicioDeMano;
const after = (by: 'yo' | 'bot', action: ActionId, over: Partial<TableView> = {}): TableView => ({
  ...base,
  last: { by, action },
  ...over,
});

describe('botLine', () => {
  it('cada canto y respuesta del bot tiene varias frases', () => {
    for (const a of ['truco', 'retruco', 'valeCuatro', 'envido', 'realEnvido', 'faltaEnvido', 'quiero', 'noQuiero'] as const) {
      expect(BOT_PHRASES[a].length, a).toBeGreaterThanOrEqual(3);
    }
  });

  it('cuando el bot canta, dice una frase de ese canto', () => {
    expect(BOT_PHRASES.realEnvido).toContain(botLine(after('bot', 'realEnvido')));
    expect(BOT_PHRASES.truco).toContain(botLine(after('bot', 'truco')));
  });

  it('el farol no se delata: mintiendo o no, sale de las mismas frases', () => {
    const honest = botLine(after('bot', 'envido'));
    const bluff = botLine(after('bot', 'envido', { mood: 'farol' }));
    expect(BOT_PHRASES.envido).toContain(bluff);
    expect(bluff).toBe(honest);
  });

  it('la frase cambia de una mano a otra', () => {
    const lines = new Set(
      [0, 1, 2, 3, 4, 5].map((n) => botLine(after('bot', 'truco', { score: [n, 2 * n] }))),
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it('mientras piensa mi canto, piensa en voz alta', () => {
    const v = after('yo', 'truco', { truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'yo' } } });
    expect(BOT_PHRASES.pensando).toContain(botLine(v));
  });

  it('al terminar la mano confiesa el farol o festeja', () => {
    const end = (mood: TableView['mood']): TableView => ({ ...after('bot', 'jugar0'), phase: 'finDeMano', mood });
    expect(BOT_PHRASES.confiesa).toContain(botLine(end('farol')));
    expect(BOT_PHRASES.descubierto).toContain(botLine(end('descubierto')));
    expect(BOT_PHRASES.gana).toContain(botLine(end('gana')));
    expect(BOT_PHRASES.pierde).toContain(botLine(end('pierde')));
  });

  it('sin nada especial, invita a jugar', () => {
    expect(BOT_PHRASES.neutral).toContain(botLine(base));
  });
});
