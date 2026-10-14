import { useState } from 'react';
import { BLUFF_MAX_TANTOS, TANTOS, barSlot, curveSummary } from '../logic/curve';
import type { CurvePoint, CurveSeat } from '../logic/curve';
import { formatPct } from '../logic/format';
import { YGrid } from './chartAxes';
import './EnvidoCurve.css';

interface Props {
  data: CurvePoint[];
  /** Aclaración que se muestra debajo del gráfico (por ejemplo, "Datos de ejemplo"). */
  note?: string;
  initialSeat?: CurveSeat;
  initialTantos?: number;
}

const W = 440;
const H = 190;
const PAD = { l: 38, r: 8, t: 8, b: 24 };
const LABELED = new Set([0, 7, 20, 25, 30, 33]);

export function EnvidoCurve({ data, note, initialSeat = 'mano', initialTantos = 27 }: Props) {
  const [seat, setSeat] = useState<CurveSeat>(initialSeat);
  const [idx, setIdx] = useState(Math.max(0, (TANTOS as readonly number[]).indexOf(initialTantos)));
  const tantos = TANTOS[idx]!;

  const chartH = H - PAD.t - PAD.b;
  const slotW = (W - PAD.l - PAD.r) / (TANTOS.length + 1);
  const yOf = (p: number) => PAD.t + (1 - p) * chartH;

  return (
    <figure className="curve panel">
      <div className="curve__controls">
        <fieldset>
          <legend>Posición del bot</legend>
          <label>
            <input type="radio" name="curve-seat" checked={seat === 'mano'} onChange={() => setSeat('mano')} />
            <span>El bot es mano</span>
          </label>
          <label>
            <input type="radio" name="curve-seat" checked={seat === 'pie'} onChange={() => setSeat('pie')} />
            <span>El bot es pie</span>
          </label>
        </fieldset>
        <div className="curve__slider">
          <label htmlFor="curve-tantos">
            Tantos del bot: <span className="curve__value">{tantos}</span>
          </label>
          <input
            id="curve-tantos"
            type="range"
            min={0}
            max={TANTOS.length - 1}
            step={1}
            value={idx}
            aria-valuetext={`${tantos} de tanto`}
            onChange={(e) => setIdx(Number(e.target.value))}
          />
        </div>
      </div>

      <svg
        className="curve__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Probabilidad de que el bot cante envido según sus tantos"
        shapeRendering="crispEdges"
      >
        <YGrid left={PAD.l} right={W - PAD.r} yOf={yOf} />
        {data.map((d) => {
          // la posición sale de los tantos, no del índice en `data`: así datos desordenados o parciales no se corren
          const i = TANTOS.indexOf(d.tantos as (typeof TANTOS)[number]);
          if (i < 0) return null;
          const p = seat === 'mano' ? d.mano : d.pie;
          const x = PAD.l + barSlot(i) * slotW + 1;
          const farol = d.tantos <= BLUFF_MAX_TANTOS;
          const selected = i === idx;
          return (
            <g key={d.tantos}>
              <rect
                data-tantos={d.tantos}
                className={`curve__bar${farol ? ' curve__bar--farol' : ''}${selected ? ' curve__bar--sel' : ''}`}
                x={x}
                y={yOf(p)}
                width={slotW - 2}
                height={Math.max(1, p * chartH)}
                onClick={() => setIdx(i)}
              />
              {LABELED.has(d.tantos) || selected ? (
                <text x={x + (slotW - 2) / 2} y={H - 8} textAnchor="middle" className="chart__tick">{d.tantos}</text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <p className="curve__summary" role="status" aria-live="polite">
        {curveSummary(data, seat, tantos)}
      </p>

      <details className="curve__details">
        <summary>Ver los datos en una tabla</summary>
        <table>
          <thead>
            <tr><th scope="col">Tantos</th><th scope="col">Bot mano</th><th scope="col">Bot pie</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.tantos}>
                <th scope="row">{d.tantos}</th>
                <td>{formatPct(d.mano)}</td>
                <td>{formatPct(d.pie)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {note ? <figcaption className="curve__note">{note}</figcaption> : null}
    </figure>
  );
}
