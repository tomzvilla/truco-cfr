import { useMemo, useState } from 'react';
import { Mesa } from '../components/Mesa';
import { createDemoSource } from '../game/demo';
import { useGameView } from '../game/source';
import { DEFAULT_SKIN } from '../skins';
import { FIXTURES } from '../table/fixtures';

export function Jugar() {
  // Acá se enchufa el GameSource real (Worker + WASM) en el plan del motor.
  const source = useMemo(() => createDemoSource(FIXTURES.inicioDeMano), []);
  const view = useGameView(source);
  const [xray, setXray] = useState(false);

  return (
    <article className="page">
      <h1>Jugar</h1>
      <p className="banner" role="note">
        Modo demostración: todavía no hay un bot real conectado. Las respuestas son de ejemplo.
      </p>
      <Mesa view={view} skin={DEFAULT_SKIN} onAction={source.dispatch} xrayOn={xray} />
      <div className="page__tools">
        <label>
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} />
          <span>Modo rayos X</span>
        </label>
        <button type="button" className="btn btn--ghost" onClick={() => source.reset()}>
          Nueva mano
        </button>
      </div>
    </article>
  );
}
