import { TANTOS } from '../logic/curve';
import { validateTableView } from '../table/validate';
import { REAL_ENVIDO_CURVE, REAL_HIGHLIGHTS, REAL_RESULTS } from './real';

describe('datos reales', () => {
  it('torneo con los tres rivales del Plan 3', () => {
    expect(REAL_RESULTS.isMock).toBe(false);
    expect(REAL_RESULTS.tournament.map((r) => r.rival)).toEqual(['Bot al azar', 'Heurístico propio', 'Claude Haiku']);
    const haiku = REAL_RESULTS.tournament[2]!;
    expect(haiku.partidos).toBe(100);
    expect(haiku.ganados).toBe(59);
    expect(haiku.fallbackPct).toBe(0);
    expect(REAL_RESULTS.learning.length).toBeGreaterThan(10);
    expect(REAL_RESULTS.exploitability.length).toBeGreaterThan(5);
  });

  it('curva del envido completa y en 0..1', () => {
    expect(REAL_ENVIDO_CURVE.map((p) => p.tantos)).toEqual([...TANTOS]);
    for (const p of REAL_ENVIDO_CURVE) {
      for (const v of [p.mano, p.pie]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('repeticiones válidas, primero las de Haiku', () => {
    expect(REAL_HIGHLIGHTS.length).toBeGreaterThanOrEqual(4);
    expect(REAL_HIGHLIGHTS[0]!.id.startsWith('haiku')).toBe(true);
    expect(new Set(REAL_HIGHLIGHTS.map((h) => h.id)).size).toBe(REAL_HIGHLIGHTS.length);
    expect(new Set(REAL_HIGHLIGHTS.map((h) => h.title)).size).toBe(REAL_HIGHLIGHTS.length);
    for (const h of REAL_HIGHLIGHTS) {
      for (const s of h.steps) expect(validateTableView(s.view), `${h.id}: ${s.caption}`).toEqual([]);
    }
  });
});
