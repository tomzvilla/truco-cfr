import { EnvidoCurve } from '../components/EnvidoCurve';
import { HOW_LEAD, HOW_SECTIONS } from '../content/howItWorks';
import { REAL_ENVIDO_CURVE } from '../data/real';
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
              data={REAL_ENVIDO_CURVE}
              note="20 000 manos del bot contra sí mismo (eval/results/bluff.json)."
            />
          ) : null}
        </section>
      ))}
    </article>
  );
}
