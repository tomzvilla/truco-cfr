import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { FakeAudioContext } from '../test/fakeAudio';
import { engine } from './engine';
import { useGameSounds } from './useGameSounds';
import { resetSfxLimits } from './useSound';

const ctx = () => engine.ctx as unknown as FakeAudioContext;
const count = () => ctx().oscs.length + ctx().sources.length;

beforeEach(() => {
  resetSfxLimits();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  engine.unlock();
  engine.setPrefs({ muted: false, music: true, sfx: true, volume: 'mid' });
});
afterEach(() => {
  engine.setPrefs({ muted: false, music: true, sfx: true, volume: 'mid' });
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('useGameSounds', () => {
  it('una acción del jugador suena y se despacha', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useGameSounds(FIXTURES.inicioDeMano, dispatch));
    const before = count();
    result.current('truco');
    expect(dispatch).toHaveBeenCalledWith('truco');
    expect(count()).toBeGreaterThan(before);
  });

  it('en silencio no suena nada pero la acción igual se despacha', () => {
    engine.setPrefs({ muted: true, music: true, sfx: true, volume: 'mid' });
    const dispatch = vi.fn();
    const { result } = renderHook(() => useGameSounds(FIXTURES.inicioDeMano, dispatch));
    const before = count();
    result.current('quiero');
    expect(dispatch).toHaveBeenCalledWith('quiero');
    expect(count()).toBe(before);
  });

  it('cuando suben los puntos suena el ding, y al terminar la mano el jingle', () => {
    const start: TableView = FIXTURES.inicioDeMano;
    const { rerender } = renderHook(({ v }) => useGameSounds(v, () => {}), { initialProps: { v: start } });
    const before = count();
    const scored: TableView = { ...start, score: [start.score[0] + 2, start.score[1]] };
    rerender({ v: scored });
    const afterScore = count();
    expect(afterScore).toBeGreaterThan(before);
    rerender({ v: { ...scored, phase: 'finDeMano', result: { yo: 2, bot: 0, winner: 'yo' } } });
    expect(count()).toBeGreaterThan(afterScore);
  });

  it('al terminar la mano suena según lo que dice el motor; sin resultado no suena el jingle', () => {
    const start: TableView = FIXTURES.inicioDeMano;
    const ended = (extra: Partial<TableView>): TableView => ({ ...start, phase: 'finDeMano', actions: [], ...extra });
    const jingles = (extra: Partial<TableView>) => {
      const { rerender } = renderHook(({ v }) => useGameSounds(v, () => {}), { initialProps: { v: start } });
      const before = count();
      rerender({ v: ended(extra) });
      return count() - before;
    };
    expect(jingles({ result: { yo: 0, bot: 1, winner: 'bot' } })).toBeGreaterThan(0);
    expect(jingles({ score: [30, 5], matchWinner: 'yo', result: { yo: 0, bot: 0, winner: null } })).toBeGreaterThan(0);
    expect(jingles({ score: [5, 30], matchWinner: 'bot' })).toBeGreaterThan(0);
    expect(jingles({ result: { yo: 1, bot: 1, winner: null } })).toBe(0);
  });
});
