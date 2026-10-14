import { useState } from 'react';
import { ReplayViewer } from '../components/ReplayViewer';
import { MOCK_HIGHLIGHTS } from '../data/mock';
import './Manos.css';

export function Manos() {
  const [selected, setSelected] = useState(MOCK_HIGHLIGHTS[0]!.id);
  const highlight = MOCK_HIGHLIGHTS.find((h) => h.id === selected) ?? MOCK_HIGHLIGHTS[0]!;

  return (
    <article className="page manos">
      <h1>Manos destacadas</h1>
      <p className="banner" role="note">
        Repeticiones de ejemplo. Las reales se eligen automáticamente de los registros del torneo.
      </p>
      <p>Faroles que funcionaron: el bot cantó con una mano floja y el rival no se animó a aceptar. Pasá los pasos para verlos.</p>
      <div className="manos__list" role="group" aria-label="Elegí una repetición">
        {MOCK_HIGHLIGHTS.map((h) => (
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
