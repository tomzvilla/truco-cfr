import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import type { FromEngine } from './protocol';
import { createSession, type MatchApi } from './session';

/** Un partido de mentira: el bot juega `botMoves` veces seguidas cuando le toca. */
function fakeMatch(opts: { botFirst?: boolean } = {}) {
  let botTurns = opts.botFirst ? 1 : 0;
  const log: string[] = [];
  const view = (extra: Partial<TableView> = {}) => JSON.stringify({ ...FIXTURES.inicioDeMano, ...extra });
  const api: MatchApi = {
    view: () => view(botTurns > 0 ? { actions: [] } : {}),
    botToMove: () => botTurns > 0,
    act: (a) => {
      log.push(`act:${a}`);
      botTurns = 2; // el bot canta y después juega
      return view({ actions: [] });
    },
    botStep: () => {
      botTurns -= 1;
      log.push('bot');
      return view(botTurns > 0 ? { actions: [] } : {});
    },
    newHand: () => {
      log.push('newHand');
      return view();
    },
    newMatch: (seed) => {
      log.push(`newMatch:${seed}`);
      return view();
    },
  };
  return { api, log };
}

function setup(match: MatchApi) {
  const posted: FromEngine[] = [];
  let thinks = 0;
  const handle = createSession({
    load: async () => match,
    post: (m) => posted.push(m),
    think: async () => {
      thinks += 1;
    },
  });
  return { handle, posted, thinks: () => thinks };
}

describe('sesión del motor', () => {
  it('init manda la primera vista', async () => {
    const { api } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(s.posted).toHaveLength(1);
    expect(s.posted[0]!.type).toBe('view');
  });

  it('el bot juega primero cuando es mano', async () => {
    const { api, log } = fakeMatch({ botFirst: true });
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(log).toEqual(['bot']);
    expect(s.posted).toHaveLength(2);
    expect(s.thinks()).toBe(1);
  });

  it('cada paso del bot es una vista aparte, con su pausa', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    await s.handle({ type: 'act', action: 'jugar0' });
    expect(log).toEqual(['act:0', 'bot', 'bot']);
    expect(s.posted).toHaveLength(4); // inicio, tu jugada, bot, bot
    expect(s.thinks()).toBe(2);
  });

  it('ignora una acción que ya no es legal', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    const first = s.handle({ type: 'act', action: 'jugar0' });
    const double = s.handle({ type: 'act', action: 'jugar0' }); // doble clic: llega mientras el bot piensa
    await Promise.all([first, double]);
    expect(log.filter((l) => l.startsWith('act'))).toHaveLength(1);
    expect(s.posted.some((m) => m.type === 'error')).toBe(false);
  });

  it('un modelo inválido manda un error', async () => {
    const posted: FromEngine[] = [];
    const s = createSession({
      load: async () => {
        throw new Error('modelo roto');
      },
      post: (m) => posted.push(m),
      think: async () => {},
    });
    await s({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(posted).toEqual([{ type: 'error', message: 'modelo roto' }]);
  });

  it('nueva mano y nuevo partido', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    await s.handle({ type: 'newHand' });
    await s.handle({ type: 'newMatch', seed: 9 });
    expect(log).toEqual(['newHand', 'newMatch:9']);
  });
});
