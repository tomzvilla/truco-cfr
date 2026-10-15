import { FIXTURES } from './fixtures';
import { outcomeOf, resultLine } from './result';
import type { TableView } from './types';

const end = (extra: Partial<TableView>): TableView => ({ ...FIXTURES.finDeManoRayosX, ...extra });

describe('resultLine', () => {
  it('mano ganada, perdida y pareja', () => {
    expect(resultLine(end({ result: { yo: 3, bot: 0, winner: 'yo' } }))).toBe('Ganaste la mano: +3');
    expect(resultLine(end({ result: { yo: 2, bot: 1, winner: 'yo' } }))).toBe('Ganaste la mano: +2 (el bot +1)');
    expect(resultLine(end({ result: { yo: 1, bot: 2, winner: 'bot' } }))).toBe('Ganó el bot: +2 (vos +1)');
    expect(resultLine(end({ result: { yo: 2, bot: 2, winner: null } }))).toBe('Mano pareja: +2 cada uno');
  });
  it('fin de partido', () => {
    expect(resultLine(end({ score: [30, 12], matchWinner: 'yo', result: { yo: 2, bot: 0, winner: 'yo' } }))).toBe('¡Ganaste el partido!');
    expect(resultLine(end({ score: [8, 30], matchWinner: 'bot' }))).toBe('El bot ganó el partido');
  });
  it('sin resultado', () => {
    expect(resultLine(end({ result: undefined }))).toBe('Mano terminada');
    expect(outcomeOf(end({ result: undefined }))).toBe('none');
    expect(outcomeOf(end({ result: { yo: 0, bot: 1, winner: 'bot' } }))).toBe('bot');
    expect(outcomeOf(end({ score: [30, 0], matchWinner: 'yo', result: { yo: 0, bot: 1, winner: 'bot' } }))).toBe('yo');
  });
});
