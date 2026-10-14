import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { updateSettings } from '../settings';
import { FakeAudioContext } from '../test/fakeAudio';
import { AudioRoot } from './AudioRoot';
import { engine } from './engine';
import { resetSfxLimits } from './useSound';

let created: FakeAudioContext[] = [];

beforeEach(() => {
  created = [];
  resetSfxLimits();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (window as unknown as { AudioContext: unknown }).AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      created.push(this);
    }
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('AudioRoot', () => {
  it('no crea el AudioContext hasta el primer gesto del usuario', async () => {
    render(<AudioRoot />);
    expect(created).toHaveLength(0);
    expect(engine.ready).toBe(false);
    await userEvent.click(document.body);
    expect(created).toHaveLength(1);
    expect(engine.ready).toBe(true);
  });

  it('con música prendida agenda notas y silenciar pone la ganancia maestra en cero', async () => {
    render(<AudioRoot />);
    await userEvent.click(document.body);
    const ctx = engine.ctx as unknown as FakeAudioContext; // el motor es único: lo crea el primer test
    expect(ctx.oscs.length).toBeGreaterThan(0);
    expect(engine.master!.gain.value).toBeGreaterThan(0);
    act(() => updateSettings({ muted: true }));
    expect(engine.master!.gain.value).toBe(0);
    act(() => updateSettings({ muted: false }));
    expect(engine.master!.gain.value).toBeGreaterThan(0);
  });
});
