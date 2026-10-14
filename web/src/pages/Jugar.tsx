import { useEffect, useMemo } from 'react';
import { useGameSounds } from '../audio/useGameSounds';
import { ConfigDialog } from '../components/ConfigDialog';
import { Mesa } from '../components/Mesa';
import { MuteButton } from '../components/MuteButton';
import { createDemoSource } from '../game/demo';
import { registerNewHand } from '../game/session';
import { useGameView } from '../game/source';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useViewport';
import { hrefFor } from '../router';
import { useSettings } from '../settings';
import { DEFAULT_SKIN } from '../skins';
import { FIXTURES } from '../table/fixtures';

export function Jugar() {
  // Acá se enchufa el GameSource real (Worker + WASM) en el plan del motor.
  const source = useMemo(() => createDemoSource(FIXTURES.inicioDeMano), []);
  const view = useGameView(source);
  const { xray } = useSettings();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const onAction = useGameSounds(view, source.dispatch);
  const newHand = () => source.reset();

  // "Nueva mano" también se ofrece desde el menú de arriba (fuera de la mesa)
  useEffect(() => registerNewHand(() => source.reset()), [source]);

  const banner = (
    <p className="banner" role="note">
      Modo demostración: bot de ejemplo.
    </p>
  );

  return (
    <article className="page">
      <h1 className="title-sr-narrow">Jugar</h1>
      {desktop ? null : banner}
      <Mesa
        view={view}
        skin={DEFAULT_SKIN}
        onAction={onAction}
        onNewHand={newHand}
        xrayOn={xray}
        head={
          desktop ? (
            <>
              <a className="brand mesa__brand" href={hrefFor('jugar')}>
                Truco CFR
              </a>
              {banner}
            </>
          ) : null
        }
        tools={
          desktop ? (
            <>
              <button type="button" className="btn btn--brasa" onClick={newHand}>
                Nueva mano
              </button>
              <div className="mesa__tools-row">
                <ConfigDialog />
                <MuteButton />
              </div>
            </>
          ) : null
        }
      />
    </article>
  );
}
