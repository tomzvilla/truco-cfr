import { FIXTURES } from './fixtures';
import type { TableView } from './types';
import { validateTableView } from './validate';

const end = (extra: Partial<TableView>): TableView => ({ ...FIXTURES.finDeManoRayosX, ...extra });

describe('validateTableView: result y matchWinner', () => {
  it('result fuera de finDeMano da error', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, result: { yo: 1, bot: 0, winner: 'yo' } };
    expect(validateTableView(v)).toContain('result solo existe en finDeMano');
  });
  it('matchWinner con 30 puntos es válido', () => {
    expect(validateTableView(end({ matchWinner: 'yo', score: [30, 4] }))).toEqual([]);
  });
  it('matchWinner sin los 30 puntos da error', () => {
    expect(validateTableView(end({ matchWinner: 'yo', score: [29, 4] }))).toEqual([
      'matchWinner = yo pero tiene 29 puntos',
    ]);
  });
  it('matchWinner fuera de finDeMano da error', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, matchWinner: 'bot', score: [3, 30] };
    expect(validateTableView(v)).toContain('matchWinner solo existe en finDeMano');
  });
});
