import { EnvidoCurve } from '../components/EnvidoCurve';
import { HOW_LEAD, HOW_SECTIONS } from '../content/howItWorks';
import { ENVIDO_CURVE_MOCK } from '../data/envidoCurve';
import './ComoFunciona.css';

export function ComoFunciona() {
  return (
    <article className="page how">
      <h1>Cómo funciona</h1>
      <p className="how__lead">{HOW_LEAD}</p>
      {HOW_SECTIONS.map((s) => (
        <section key={s.id} aria-labelledby={`how-${s.id}`}>
          <h2 id={`how-${s.id}`}>{s.title}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {s.id === 'farol' ? (
            <EnvidoCurve
              data={ENVIDO_CURVE_MOCK}
              note="Datos de ejemplo: se reemplazan por la curva real del bot cuando termine el entrenamiento."
            />
          ) : null}
        </section>
      ))}
    </article>
  );
}
