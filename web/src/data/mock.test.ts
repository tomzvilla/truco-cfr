import { describe, it, expect } from 'vitest';
import { validateTableView } from '../table/validate';
import { MOCK_HIGHLIGHTS, MOCK_RESULTS } from './mock';

describe('datos mock de resultados', () => {
  it('están rotulados como mock', () => {
    expect(MOCK_RESULTS.isMock).toBe(true);
  });
  it('la tabla del torneo es coherente', () => {
    expect(MOCK_RESULTS.tournament.length).toBeGreaterThanOrEqual(4);
    for (const r of MOCK_RESULTS.tournament) {
      expect(r.ganados).toBeLessThanOrEqual(r.partidos);
      expect(r.winRate).toBeCloseTo(r.ganados / r.partidos, 10);
      expect(r.ciLow).toBeLessThan(r.winRate);
      expect(r.ciHigh).toBeGreaterThan(r.winRate);
      expect(r.netCiLow).toBeLessThanOrEqual(r.netPerHand);
      expect(r.netCiHigh).toBeGreaterThanOrEqual(r.netPerHand);
    }
  });
  it('las curvas están ordenadas por iteración y el aprendizaje mejora', () => {
    const its = MOCK_RESULTS.learning.map((p) => p.iteration);
    expect([...its].sort((a, b) => a - b)).toEqual(its);
    const first = MOCK_RESULTS.learning[0]!;
    const last = MOCK_RESULTS.learning[MOCK_RESULTS.learning.length - 1]!;
    expect(last.vsHeuristic).toBeGreaterThan(first.vsHeuristic);
    const ex = MOCK_RESULTS.exploitability;
    expect(ex[ex.length - 1]!.exploitability).toBeLessThan(ex[0]!.exploitability);
  });
});

describe('manos destacadas mock', () => {
  it('hay al menos dos repeticiones de 2 o más pasos', () => {
    expect(MOCK_HIGHLIGHTS.length).toBeGreaterThanOrEqual(2);
    for (const h of MOCK_HIGHLIGHTS) expect(h.steps.length).toBeGreaterThanOrEqual(2);
  });
  it('todos los pasos son TableView válidos y con texto', () => {
    for (const h of MOCK_HIGHLIGHTS) {
      expect(h.title.length).toBeGreaterThan(5);
      for (const s of h.steps) {
        expect(s.caption.length).toBeGreaterThan(10);
        expect(validateTableView(s.view)).toEqual([]);
      }
    }
  });
  it('los ids son únicos', () => {
    const ids = MOCK_HIGHLIGHTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  // F16: los textos tienen que coincidir con lo que muestra la mesa en cada paso.
  it('los pasos del farol de truco cuentan lo que muestra la mesa', () => {
    const h = MOCK_HIGHLIGHTS.find((x) => x.id === 'farol-truco')!;
    expect(h.steps[1]!.view.truco.pending).toEqual({ call: 'truco', by: 'bot' });
    expect(h.steps[1]!.view.botHand).toBeUndefined();
    const last = h.steps[h.steps.length - 1]!.view;
    expect(last.botHand).toBeDefined();
    expect(last.score[1]).toBe(h.steps[0]!.view.score[1] + 1); // el punto del "no quiero"
    expect(h.why).not.toMatch(/sin mostrar/);
  });
  it('en el envido bajo, el "no quiero" le da 1 punto al bot', () => {
    const h = MOCK_HIGHLIGHTS.find((x) => x.id === 'envido-bajo')!;
    const before = h.steps[1]!.view;
    const after = h.steps[h.steps.length - 1]!.view;
    expect(after.score[1]).toBe(before.score[1] + 1);
    expect(after.envido.reveal).toBeNull();
  });
});

describe('manos destacadas mock: coherencia con el motor', () => {
  it('ningún paso habla de irse al mazo con un canto pendiente (el motor lo prohíbe)', () => {
    const h = MOCK_HIGHLIGHTS.find((x) => x.id === 'farol-truco')!;
    const step = h.steps[1]!;
    expect(step.view.truco.pending).not.toBeNull();
    expect(h.steps[2]!.caption).not.toMatch(/mazo/i);
    expect(h.steps[2]!.caption).toMatch(/no quiero/i);
  });
});
