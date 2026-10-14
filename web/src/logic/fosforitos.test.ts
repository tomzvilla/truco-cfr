import { describe, it, expect } from 'vitest';
import { GRID, clampPoints, fosforitos, groupRects } from './fosforitos';

describe('fosforitos (grupos de 5, 15 malas + 15 buenas)', () => {
  const cases: [number, number[], number[]][] = [
    [0, [0, 0, 0], [0, 0, 0]],
    [1, [1, 0, 0], [0, 0, 0]],
    [4, [4, 0, 0], [0, 0, 0]],
    [5, [5, 0, 0], [0, 0, 0]],
    [7, [5, 2, 0], [0, 0, 0]],
    [15, [5, 5, 5], [0, 0, 0]],
    [16, [5, 5, 5], [1, 0, 0]],
    [22, [5, 5, 5], [5, 2, 0]],
    [29, [5, 5, 5], [5, 5, 4]],
    [30, [5, 5, 5], [5, 5, 5]],
  ];
  it.each(cases)('%i puntos', (p, malas, buenas) => {
    const b = fosforitos(p);
    expect(b.malas).toEqual(malas);
    expect(b.buenas).toEqual(buenas);
    expect(b.points).toBe(p);
  });
  it('puntajes raros no rompen nada: se acotan a 0..30 y no dibujan de más', () => {
    const full = { malas: [5, 5, 5], buenas: [5, 5, 5] };
    const empty = { malas: [0, 0, 0], buenas: [0, 0, 0] };
    expect(fosforitos(31)).toEqual({ points: 30, ...full });
    expect(fosforitos(1000)).toEqual({ points: 30, ...full });
    expect(fosforitos(30.5)).toEqual({ points: 30, ...full });
    expect(fosforitos(Number.POSITIVE_INFINITY)).toEqual({ points: 30, ...full });
    expect(fosforitos(-3)).toEqual({ points: 0, ...empty });
    expect(fosforitos(Number.NEGATIVE_INFINITY)).toEqual({ points: 0, ...empty });
    expect(fosforitos(Number.NaN)).toEqual({ points: 0, ...empty });
    expect(fosforitos(7.9).points).toBe(7);
    expect(fosforitos(-0.5).points).toBe(0);
    expect(clampPoints(Number.POSITIVE_INFINITY)).toBe(30);
  });
  it('la cantidad de palitos dibujados coincide con el puntaje', () => {
    for (let p = 0; p <= 30; p++) {
      const b = fosforitos(p);
      const total = [...b.malas, ...b.buenas].reduce<number>((a, f) => a + f, 0);
      expect(total).toBe(p);
    }
  });
  it('siempre hay 3 grupos de malas y 3 de buenas', () => {
    for (const p of [-1, 0, 15, 16, 30, 31, Number.NaN]) {
      const b = fosforitos(p);
      expect(b.malas).toHaveLength(3);
      expect(b.buenas).toHaveLength(3);
    }
  });
});

describe('groupRects (fósforos con cabeza roja)', () => {
  const sticksOf = (n: 0 | 1 | 2 | 3 | 4 | 5) => {
    const by = new Map<number, ReturnType<typeof groupRects>>();
    for (const r of groupRects(n)) by.set(r.stick, [...(by.get(r.stick) ?? []), r]);
    return by;
  };
  const cells = (rs: ReturnType<typeof groupRects>) => {
    const out = new Set<string>();
    for (const r of rs) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) out.add(`${x},${y}`);
    return out;
  };

  it('hay un fósforo por punto: n fósforos distintos, cada uno con madera y cabeza', () => {
    expect(groupRects(0)).toHaveLength(0);
    for (const n of [1, 2, 3, 4, 5] as const) {
      const by = sticksOf(n);
      expect([...by.keys()].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      for (const rs of by.values()) {
        expect(rs.some((r) => r.kind === 'madera')).toBe(true);
        expect(rs.some((r) => r.kind === 'cabeza')).toBe(true);
      }
    }
  });
  it('los primeros 4 forman un cuadrado cerrado y el quinto lo cruza en diagonal', () => {
    const square = cells(groupRects(4));
    // esquinas y puntos medios de los 4 lados
    for (const c of ['2,2', '12,2', '12,12', '2,12', '6,2', '12,6', '8,12', '2,8']) expect(square.has(c), c).toBe(true);
    // adentro del cuadrado no hay nada (todavía)
    expect(square.has('7,7')).toBe(false);
    const diagonal = sticksOf(5).get(4)!;
    const d = cells(diagonal);
    expect(d.has('7,7') || d.has('8,7') || d.has('7,8')).toBe(true); // pasa por el centro
    const xs = [...d].map((c) => Number(c.split(',')[0]));
    const ys = [...d].map((c) => Number(c.split(',')[1]));
    expect(Math.min(...xs)).toBeLessThanOrEqual(4);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(11);
    expect(Math.min(...ys)).toBeLessThanOrEqual(4);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(10);
  });
  it('los fósforos no se pisan entre sí salvo en las esquinas y el cruce', () => {
    const by = sticksOf(4);
    const sets = [...by.values()].map(cells);
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const shared = [...sets[i]!].filter((c) => sets[j]!.has(c));
        expect(shared.length, `${i} y ${j}`).toBeLessThanOrEqual(1);
      }
    }
  });
  it('todo cae dentro de la grilla de 15x15', () => {
    expect(GRID).toBe(15);
    for (const r of groupRects(5)) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(GRID);
      expect(r.y + r.h).toBeLessThanOrEqual(GRID);
    }
  });
});
