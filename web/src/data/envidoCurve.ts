import { TANTOS } from '../logic/curve';
import type { CurvePoint } from '../logic/curve';

// DATOS DE EJEMPLO. Los reales salen del análisis de faroleo de eval/ cuando termine el entrenamiento.
const MANO = [
  0.02, 0.02, 0.03, 0.03, 0.04, 0.05, 0.07, 0.09,
  0.1, 0.14, 0.22, 0.35, 0.52, 0.66, 0.78, 0.88, 0.93, 0.96, 0.97, 0.86, 0.82, 0.8,
];
const PIE = [
  0.01, 0.01, 0.02, 0.02, 0.03, 0.04, 0.05, 0.06,
  0.06, 0.09, 0.15, 0.27, 0.43, 0.58, 0.71, 0.83, 0.9, 0.94, 0.95, 0.82, 0.78, 0.75,
];

export const ENVIDO_CURVE_MOCK: CurvePoint[] = TANTOS.map((tantos, i) => ({
  tantos,
  mano: MANO[i]!,
  pie: PIE[i]!,
}));
