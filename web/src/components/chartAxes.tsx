import './chartAxes.css';

interface YGridProps {
  /** x donde empieza y termina la línea (coordenadas del viewBox). */
  left: number;
  right: number;
  /** Convierte un valor del eje (0..1 por defecto) en la coordenada y del viewBox. */
  yOf: (v: number) => number;
  /** Valores del eje donde se dibuja una línea. */
  ticks?: readonly number[];
  /** Cómo se escribe cada valor del eje; por defecto, porcentaje entero. */
  format?: (v: number) => string;
}

const DEFAULT_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;
const asPercent = (v: number): string => `${Math.round(v * 100)}%`;

/** Líneas horizontales de guía con sus etiquetas a la izquierda. Compartido por los gráficos hechos a mano. */
export function YGrid({ left, right, yOf, ticks = DEFAULT_TICKS, format = asPercent }: YGridProps) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={yOf(t)} y2={yOf(t)} stroke="var(--tiza)" strokeOpacity={0.18} />
          <text x={left - 4} y={yOf(t) + 4} textAnchor="end" className="chart__tick">{format(t)}</text>
        </g>
      ))}
    </>
  );
}
