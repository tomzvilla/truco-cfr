import type { CurvePoint } from '../logic/curve';
import type { Highlight, ResultsData } from './types';
import envidoCurve from './real/envidoCurve.json';
import highlights from './real/highlights.json';
import results from './real/results.json';

// Generado por `cargo run --release -p truco-engine-wasm --bin web-data` desde eval/results.
export const REAL_RESULTS: ResultsData = results;
export const REAL_ENVIDO_CURVE: CurvePoint[] = envidoCurve;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** El JSON importado tiene tipos anchos (string, number[]): esta guarda revisa la forma y la deja como `Highlight[]`.
 *  La validez fina de cada vista la revisa real.test.ts con `validateTableView`. */
function isHighlights(v: unknown): v is Highlight[] {
  return (
    Array.isArray(v) &&
    v.every(
      (h) =>
        isObject(h) &&
        typeof h.id === 'string' &&
        typeof h.title === 'string' &&
        typeof h.why === 'string' &&
        Array.isArray(h.steps) &&
        h.steps.every(
          (st) =>
            isObject(st) &&
            typeof st.caption === 'string' &&
            isObject(st.view) &&
            Array.isArray(st.view.score) &&
            st.view.score.length === 2,
        ),
    )
  );
}

function loadHighlights(raw: unknown): Highlight[] {
  if (!isHighlights(raw)) throw new Error('data/real/highlights.json no tiene el formato esperado');
  return raw;
}

export const REAL_HIGHLIGHTS: Highlight[] = loadHighlights(highlights);
