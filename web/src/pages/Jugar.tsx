import { useMemo } from 'react';
import { ConfigDialog } from '../components/ConfigDialog';
import { Mesa } from '../components/Mesa';
import { createDemoSource } from '../game/demo';
import { useGameView } from '../game/source';
import { useSettings } from '../settings';
import { DEFAULT_SKIN } from '../skins';
import { FIXTURES } from '../table/fixtures';

export function Jugar() {
  // Acá se enchufa el GameSource real (Worker + WASM) en el plan del motor.
  const source = useMemo(() => createDemoSource(FIXTURES.inicioDeMano), []);
  const view = useGameView(source);
  const { xray } = useSettings();

  return (
    <article className="page">
      <h1 className="title-sr-narrow">Jugar</h1>
      <p className="banner" role="note">
        Modo demostración: bot de ejemplo.
      </p>
      <Mesa
        view={view}
        skin={DEFAULT_SKIN}
        onAction={source.dispatch}
        xrayOn={xray}
        tools={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => source.reset()}>
              Nueva mano
            </button>
            <ConfigDialog />
          </>
        }
      />
    </article>
  );
}
