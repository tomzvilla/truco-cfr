import { describe, it, expect, vi, afterEach } from 'vitest';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import { validateTableView } from '../table/validate';
import { createDemoSource, defaultActions, demoBotStep, demoReduce } from './demo';

afterEach(() => vi.useRealTimers());

describe('demoReduce', () => {
  it('jugar una carta la marca como jugada y abre la baza', () => {
    const v = demoReduce(FIXTURES.inicioDeMano, 'jugar1');
    expect(v.hand[1]!.played).toBe(true);
    expect(v.tricks).toEqual([{ mine: { suit: 'oro', number: 7 }, bot: null, winner: null }]);
    expect(v.actions).toEqual([]);
  });
  it('jugar una carta ya jugada o inexistente no cambia nada', () => {
    const v = FIXTURES.trucoPendiente;
    expect(demoReduce(v, 'jugar0')).toBe(v);
  });
  it('quiero al truco del bot sube el nivel aceptado y limpia el pendiente', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'quiero');
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: null });
  });
  it('no quiero al truco termina la mano y le da el punto al bot', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'noQuiero');
    expect(v.phase).toBe('finDeMano');
    expect(v.score).toEqual([FIXTURES.trucoPendiente.score[0], FIXTURES.trucoPendiente.score[1] + 1]);
    expect(v.botHand).toHaveLength(3);
  });
  it('retruco como respuesta acepta y vuelve a subir', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'retruco');
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: { call: 'retruco', by: 'yo' } });
  });
  it('envido propio queda pendiente de respuesta del bot', () => {
    const v = demoReduce(FIXTURES.inicioDeMano, 'envido');
    expect(v.envido.pending).toEqual({ by: 'yo' });
    expect(v.envido.calls).toEqual([{ call: 'envido', by: 'yo' }]);
  });
  it('irse al mazo en la primera baza sin envido jugado termina la mano y el bot suma 2', () => {
    const v = demoReduce(FIXTURES.inicioDeMano, 'mazo');
    expect(v.phase).toBe('finDeMano');
    expect(v.score).toEqual([3, 7]); // 1 del truco + 1 porque el envido no se jugó (spec §2)
  });
  it('CUALQUIER acción disponible en CUALQUIER fixture produce un TableView válido', () => {
    for (const name of FIXTURE_NAMES) {
      for (const a of FIXTURES[name].actions) {
        expect(validateTableView(demoReduce(FIXTURES[name], a)), `${name} + ${a}`).toEqual([]);
      }
    }
  });
  it('quiero a un envido del bot revela tantos que salen de la mano real (F16)', () => {
    // fixture: yo tengo 3 y 6 de bastos (29 de tanto) y soy mano
    const v = demoReduce(FIXTURES.envidoPendiente, 'quiero');
    expect(v.envido.reveal?.yo).toBe(29);
    expect(v.envido.pending).toBeNull();
    expect(validateTableView(v)).toEqual([]);
  });
});

describe('demoBotStep / defaultActions', () => {
  it('el bot acepta tu truco y vuelve tu turno', () => {
    const asked = demoReduce(FIXTURES.inicioDeMano, 'truco');
    const v = demoBotStep(asked);
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: null });
    expect(v.actions).toContain('jugar0');
    expect(validateTableView(v)).toEqual([]);
  });
  it('el bot acepta tu envido y los tantos revelados salen de tu mano (7 de tanto, no un número fijo)', () => {
    const v = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'envido'));
    expect(v.envido.pending).toBeNull();
    // espada 1, oro 7, basto 4: tres palos distintos, el mejor es el 7. Sos mano y el bot tiene menos: "son buenas".
    expect(v.envido.reveal).toEqual({ yo: 7, bot: null });
    expect(v.score[0]).toBe(FIXTURES.inicioDeMano.score[0] + 2);
    expect(validateTableView(v)).toEqual([]);
  });
  it('el bot juega una carta en tu baza y la baza queda con ganador (F16)', () => {
    const v = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'jugar0')); // tu as de espada
    expect(v.tricks).toHaveLength(1);
    expect(v.tricks[0]!.bot).not.toBeNull();
    expect(v.tricks[0]!.winner).toBe('yo');
    expect(v.actions).toContain('jugar1');
    expect(validateTableView(v)).toEqual([]);
  });
  it('si el bot gana la baza, abre la siguiente tirando una carta', () => {
    const v = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'jugar2')); // tu 4 de bastos
    expect(v.tricks[0]!.winner).toBe('bot');
    expect(v.tricks[1]).toMatchObject({ mine: null, winner: null });
    expect(v.tricks[1]!.bot).not.toBeNull();
    expect(v.actions).toContain('jugar0');
    expect(validateTableView(v)).toEqual([]);
  });
  it('en fin de mano no hay acciones', () => {
    expect(defaultActions(FIXTURES.finDeManoRayosX)).toEqual([]);
  });
});

describe('createDemoSource', () => {
  it('despacha, notifica y el bot "responde" después del retardo', () => {
    vi.useFakeTimers();
    const src = createDemoSource(FIXTURES.inicioDeMano, 500);
    const listener = vi.fn();
    src.subscribe(listener);
    src.dispatch('jugar0');
    expect(src.getView().actions).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(src.getView().actions).toContain('jugar1');
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it('ignora acciones que no están disponibles', () => {
    const src = createDemoSource(FIXTURES.finDeManoRayosX);
    const before = src.getView();
    src.dispatch('truco');
    expect(src.getView()).toBe(before);
  });
  it('unsubscribe deja de notificar y reset vuelve al inicio', () => {
    const src = createDemoSource(FIXTURES.inicioDeMano);
    const listener = vi.fn();
    const off = src.subscribe(listener);
    off();
    src.dispatch('mazo');
    expect(listener).not.toHaveBeenCalled();
    src.reset();
    expect(src.getView()).toBe(FIXTURES.inicioDeMano);
  });
  it('una mano completa jugando cartas llega al fin de mano con las cartas del bot reveladas y puntos (F16)', () => {
    vi.useFakeTimers();
    const src = createDemoSource(FIXTURES.inicioDeMano, 100);
    for (let i = 0; i < 6 && src.getView().phase !== 'finDeMano'; i++) {
      const play = src.getView().actions.find((a) => a.startsWith('jugar'));
      expect(play, `paso ${i}`).toBeDefined();
      src.dispatch(play!);
      expect(validateTableView(src.getView())).toEqual([]);
      vi.advanceTimersByTime(100);
      expect(validateTableView(src.getView())).toEqual([]);
    }
    const end = src.getView();
    expect(end.phase).toBe('finDeMano');
    expect(end.actions).toEqual([]);
    expect(end.botHand).toHaveLength(3);
    // las cartas que el bot tiró en las bazas están entre las reveladas
    const shown = end.botHand!.map((k) => `${k.suit}-${k.number}`);
    for (const t of end.tricks) if (t.bot) expect(shown).toContain(`${t.bot.suit}-${t.bot.number}`);
    expect(end.score[0] + end.score[1]).toBeGreaterThan(FIXTURES.inicioDeMano.score[0] + FIXTURES.inicioDeMano.score[1]);
  });
});

describe('demo: reglas del spec §2', () => {
  it('con el truco ya aceptado el envido queda cerrado', () => {
    const v = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'truco'));
    expect(v.truco.acceptedLevel).toBe(2);
    for (const a of ['envido', 'realEnvido', 'faltaEnvido'] as const) expect(v.actions).not.toContain(a);
  });
  it('sin truco cantado el envido sí se ofrece en la primera baza', () => {
    expect(defaultActions(FIXTURES.inicioDeMano)).toContain('envido');
  });
  it('irse al mazo en la primera baza con el envido ya jugado vale solo el truco', () => {
    const afterEnvido = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'envido'));
    const v = demoReduce(afterEnvido, 'mazo');
    expect(v.score[1]).toBe(afterEnvido.score[1] + 1);
  });
  it('irse al mazo después de la primera baza vale solo el truco', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'mazo'); // además: hay un canto pendiente
    expect(v).toBe(FIXTURES.trucoPendiente);
    const afterFirst = { ...FIXTURES.trucoPendiente, truco: { acceptedLevel: 1 as const, pending: null }, actions: ['mazo' as const] };
    expect(demoReduce(afterFirst, 'mazo').score[1]).toBe(afterFirst.score[1] + 1);
  });
  it('el mazo no existe mientras hay un canto pendiente (el motor lo prohíbe)', () => {
    expect(demoReduce(FIXTURES.envidoPendiente, 'mazo')).toBe(FIXTURES.envidoPendiente);
    expect(demoReduce(FIXTURES.trucoPendiente, 'mazo')).toBe(FIXTURES.trucoPendiente);
  });
  it('un "no quiero" a un envido encadenado paga la suma de lo aceptado antes del último canto', () => {
    const chained = {
      ...FIXTURES.envidoPendiente,
      envido: {
        calls: [{ call: 'envido' as const, by: 'yo' as const }, { call: 'realEnvido' as const, by: 'bot' as const }],
        pending: { by: 'bot' as const },
        reveal: null,
      },
    };
    const v = demoReduce(chained, 'noQuiero');
    expect(v.score).toEqual([chained.score[0], chained.score[1] + 2]);
    // y a un primer canto vale 1
    expect(demoReduce(FIXTURES.envidoPendiente, 'noQuiero').score[1]).toBe(FIXTURES.envidoPendiente.score[1] + 1);
  });
  it('una falta envido aceptada con el que va ganando por debajo de 15 define el partido en 30', () => {
    const falta = {
      ...FIXTURES.envidoPendiente,
      envido: { calls: [{ call: 'faltaEnvido' as const, by: 'bot' as const }], pending: { by: 'bot' as const }, reveal: null },
    };
    const v = demoReduce(falta, 'quiero');
    expect(Math.max(...v.score)).toBe(30);
  });
});
