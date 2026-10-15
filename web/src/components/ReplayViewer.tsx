import { useEffect, useState } from 'react';
import type { Highlight } from '../data/types';
import { DEFAULT_SKIN } from '../skins';
import { Mesa } from './Mesa';
import './ReplayViewer.css';

export function ReplayViewer({ highlight }: { highlight: Highlight }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
  }, [highlight.id]);

  const last = highlight.steps.length - 1;
  // Entre el render y el efecto que vuelve al paso 1, `step` puede apuntar a un paso que ya no existe.
  const shown = Math.min(step, last);
  const current = highlight.steps[shown]!;

  return (
    <section className="replay" aria-label={`Repetición: ${highlight.title}`}>
      <p className="replay__why">{highlight.why}</p>
      {/* los controles van arriba, junto al texto del paso: así no se mueven cuando la mesa cambia de alto */}
      <div className="replay__step">
        <button type="button" className="btn btn--ghost" disabled={shown <= 0} onClick={() => setStep(shown - 1)}>
          Anterior
        </button>
        <div className="replay__text">
          <span className="replay__count">{`Paso ${shown + 1} de ${highlight.steps.length}`}</span>
          <p className="replay__caption" role="status">
            {current.caption}
          </p>
        </div>
        <button type="button" className="btn" disabled={shown >= last} onClick={() => setStep(shown + 1)}>
          Siguiente
        </button>
      </div>
      <Mesa view={current.view} skin={DEFAULT_SKIN} xrayOn={current.view.xray !== undefined} />
    </section>
  );
}
