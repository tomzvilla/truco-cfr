import { LineChart } from '../components/LineChart';
import { REAL_RESULTS } from '../data/real';
import type { ResultsData } from '../data/types';
import { formatPct, formatPct1, formatSigned } from '../logic/format';
import { VERDICT_TEXT, verdictOf } from '../logic/verdict';
import './Resultados.css';

const comma = (n: number, digits: number): string => n.toFixed(digits).replace('.', ',');

/** `data` son los resultados reales de eval/results (ver data/real.ts). Las series pueden venir vacías. */
export function Resultados({ data = REAL_RESULTS }: { data?: ResultsData }) {
  const learningLast = data.learning[data.learning.length - 1];
  const exploitLast = data.exploitability[data.exploitability.length - 1];

  return (
    <article className="page results">
      <h1>Resultados</h1>
      {data.isMock ? (
        <p className="banner" role="note">
          Datos de ejemplo.
        </p>
      ) : null}

      <h2>Torneo</h2>
      <p>Partidos completos a 30, en formato duplicado (cada reparto se juega dos veces con los asientos invertidos).</p>
      {data.tournament.length === 0 ? (
        <p className="results__empty">Todavía no hay resultados del torneo.</p>
      ) : (
        <div className="results__scroll">
          <table className="results__table">
            <thead>
              <tr>
                <th scope="col">Rival</th>
                <th scope="col">Partidos ganados</th>
                <th scope="col">Veredicto</th>
              </tr>
            </thead>
            <tbody>
              {data.tournament.map((r) => (
                <tr key={r.rival}>
                  <th scope="row">
                    {r.rival}
                    <small>{r.description}</small>
                  </th>
                  <td>
                    <strong>{formatPct1(r.winRate)}</strong>
                    {data.isMock ? <span className="results__example"> (ejemplo)</span> : null} ({r.ganados} de {r.partidos})
                    <small>IC 95%: {formatPct1(r.ciLow)} a {formatPct1(r.ciHigh)}</small>
                    <small>
                      Puntos por mano: {formatSigned(r.netPerHand)} ({formatSigned(r.netCiLow)} a {formatSigned(r.netCiHigh)})
                    </small>
                    {r.fallbackPct !== null ? (
                      <small>Jugadas reemplazadas por una legal: {comma(r.fallbackPct, 1)}%</small>
                    ) : null}
                  </td>
                  <td>{VERDICT_TEXT[verdictOf(r.ciLow, r.ciHigh)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Cómo fue aprendiendo</h2>
      {learningLast === undefined ? (
        <p className="results__empty">Todavía no hay datos de entrenamiento.</p>
      ) : (
        <LineChart
          title="Partidos ganados durante el entrenamiento"
          xLabel="Iteraciones"
          yMin={0.2}
          yMax={1}
          yTicks={[0.25, 0.5, 0.75, 1]}
          yFormat={formatPct}
          refLine={{ y: 0.5, label: 'Empate' }}
          series={[
            { id: 'azar', label: 'Contra el bot al azar', color: 'var(--menta)', points: data.learning.map((p) => ({ x: p.iteration, y: p.vsRandom })) },
            { id: 'heur', label: 'Contra el heurístico', color: 'var(--ambar)', points: data.learning.map((p) => ({ x: p.iteration, y: p.vsHeuristic })) },
          ]}
          summary={`Al final: ${formatPct(learningLast.vsRandom)} contra el azar y ${formatPct(learningLast.vsHeuristic)} contra el heurístico.`}
        />
      )}
      {learningLast === undefined ? null : (
        <p className="results__note">Cada punto: 400 partidos de la política de esa iteración (no la red final) contra cada rival.</p>
      )}

      <h2>Qué tan explotable es</h2>
      <p>
        En el MiniTruco (una versión chica del juego) se puede calcular exacto cuántos puntos por mano perdería el bot contra el mejor rival posible. Cuanto más cerca de cero, mejor. En el truco completo ese número no se puede calcular.
      </p>
      {exploitLast === undefined ? (
        <p className="results__empty">Todavía no hay datos de entrenamiento.</p>
      ) : (
        <LineChart
          title="Explotabilidad del MiniTruco"
          xLabel="Iteraciones"
          yLog
          yMin={0.01}
          yMax={1}
          yTicks={[0.01, 0.1, 1]}
          yFormat={(v) => String(v).replace('.', ',')}
          refLine={{ y: 0.05, label: 'Meta: 0,05' }}
          series={[
            { id: 'exp', label: 'Puntos por mano que se le pueden sacar', color: 'var(--brasa)', points: data.exploitability.map((p) => ({ x: p.iteration, y: p.exploitability })) },
          ]}
          summary={`Última iteración (la política de ese momento, que sube y baja): ${comma(exploitLast.exploitability, 4)} puntos por mano.${
            data.exploitabilityFinal === undefined ? '' : ` La red final, la que juega en la web: ${comma(data.exploitabilityFinal, 4)}.`
          }`}
        />
      )}
      {exploitLast === undefined ? null : (
        <p className="results__note">
          MiniTruco, una versión chica del juego donde se puede calcular exacto cuánto perdería el bot contra el mejor rival posible.
          Cada punto del gráfico es la política de esa iteración, que es ruidosa y no es la que se usa para jugar.
          {data.exploitabilityFinal === undefined ? '' : ` La red final (la que juega en la web, un promedio de todas las iteraciones) pierde solo ${comma(data.exploitabilityFinal, 3)} puntos por mano.`}
        </p>
      )}
    </article>
  );
}
