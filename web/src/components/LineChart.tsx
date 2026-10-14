import { linear, log } from '../logic/chartScale';
import { YGrid } from './chartAxes';
import './LineChart.css';

export interface Series {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

interface Props {
  title: string;
  series: Series[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  yFormat: (v: number) => string;
  yLog?: boolean;
  refLine?: { y: number; label: string };
  xLabel: string;
  /** Texto que resume el gráfico para quien no lo puede ver. */
  summary: string;
}

const W = 360;
const H = 210;
const PAD = { l: 44, r: 12, t: 12, b: 30 };

export function LineChart({ title, series, yMin, yMax, yTicks, yFormat, yLog = false, refLine, xLabel, summary }: Props) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const x0 = xs.length > 0 ? Math.min(...xs) : 0;
  const x1 = xs.length > 0 ? Math.max(...xs) : 1;
  const sx = linear(x0, x1, PAD.l, W - PAD.r);
  const sy = yLog ? log(yMin, yMax, H - PAD.b, PAD.t) : linear(yMin, yMax, H - PAD.b, PAD.t);

  return (
    <figure className="chart panel">
      <figcaption className="chart__title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} shapeRendering="crispEdges" className="chart__svg">
        <YGrid left={PAD.l} right={W - PAD.r} yOf={sy} ticks={yTicks} format={yFormat} />
        {refLine ? (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(refLine.y)} y2={sy(refLine.y)} stroke="var(--menta)" strokeDasharray="4 4" />
            <text x={W - PAD.r} y={sy(refLine.y) - 4} textAnchor="end" className="chart__ref">{refLine.label}</text>
          </g>
        ) : null}
        {series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={s.color}
            strokeWidth={3}
            strokeLinejoin="miter"
            points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          />
        ))}
        <text x={PAD.l} y={H - 8} className="chart__tick">{x0}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="chart__tick">{x1}</text>
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} textAnchor="middle" className="chart__tick">{xLabel}</text>
      </svg>
      <ul className="chart__legend">
        {series.map((s) => (
          <li key={s.id}>
            <span className="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <p className="chart__summary">{summary}</p>
    </figure>
  );
}
