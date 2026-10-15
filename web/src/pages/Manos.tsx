import { useState } from 'react';
import { ReplayViewer } from '../components/ReplayViewer';
import { REAL_HIGHLIGHTS } from '../data/real';
import type { Highlight } from '../data/types';
import './Manos.css';

export function Manos({ highlights = REAL_HIGHLIGHTS }: { highlights?: Highlight[] }) {
  const [selected, setSelected] = useState(highlights[0]!.id);
  const highlight = highlights.find((h) => h.id === selected) ?? highlights[0]!;

  return (
    <article className="page manos">
      <h1>Manos destacadas</h1>
      <p>
        Faroles que funcionaron, sacados de los partidos del torneo: el bot cantó con una mano floja y el rival no se animó. Pasá los pasos para verlos; en cada decisión del bot ves sus probabilidades (rayos X).
      </p>
      <div className="manos__list" role="group" aria-label="Elegí una repetición">
        {highlights.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`btn ${h.id === highlight.id ? '' : 'btn--ghost'}`}
            aria-pressed={h.id === highlight.id}
            onClick={() => setSelected(h.id)}
          >
            {h.title}
          </button>
        ))}
      </div>
      <ReplayViewer highlight={highlight} />
    </article>
  );
}
