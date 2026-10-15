import { useEffect, useMemo } from 'react';
import { useGameSounds } from '../audio/useGameSounds';
import { ConfigDialog } from '../components/ConfigDialog';
import { Mesa } from '../components/Mesa';
import { MuteButton } from '../components/MuteButton';
import { createEngineWorker } from '../engine/createWorker';
import { createEngineSource } from '../engine/engineSource';
import { registerNewMatch } from '../game/session';
import { useGame } from '../game/source';
import type { GameSource } from '../game/source';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useViewport';
import { hrefFor } from '../router';
import { useSettings } from '../settings';
import { DEFAULT_SKIN } from '../skins';
import type { TableView } from '../table/types';

/** `source` solo se pasa en los tests; en la web se crea el Worker con el motor. */
export function Jugar({ source: given }: { source?: GameSource }) {
  const source = useMemo(() => given ?? createEngineSource(createEngineWorker), [given]);
  const snap = useGame(source);

  // "Nuevo partido" también se ofrece desde el menú de arriba (fuera de la mesa)
  useEffect(() => registerNewMatch(source.newMatch), [source]);

  if (snap.status === 'cargando') {
    return (
      <article className="page">
        <h1 className="title-sr-narrow">Jugar</h1>
        <p className="banner" role="status">
          Barajando… cargando el bot (menos de 1 MB).
        </p>
      </article>
    );
  }
  if (snap.status === 'error') {
    return (
      <article className="page">
        <h1 className="title-sr-narrow">Jugar</h1>
        <p className="banner" role="alert">
          No se pudo cargar el bot: {snap.message}
        </p>
        <button type="button" className="btn btn--brasa" onClick={source.retry}>
          Reintentar
        </button>
      </article>
    );
  }
  return <Partida view={snap.view} source={source} />;
}

function Partida({ view, source }: { view: TableView; source: GameSource }) {
  const { xray } = useSettings();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const onAction = useGameSounds(view, source.dispatch);

  return (
    <article className="page">
      <h1 className="title-sr-narrow">Jugar</h1>
      <Mesa
        view={view}
        skin={DEFAULT_SKIN}
        onAction={onAction}
        onNewHand={source.newHand}
        onNewMatch={source.newMatch}
        xrayOn={xray}
        head={
          desktop ? (
            <a className="brand mesa__brand" href={hrefFor('jugar')}>
              Truco CFR
            </a>
          ) : null
        }
        tools={
          desktop ? (
            <>
              <button type="button" className="btn btn--brasa" onClick={source.newMatch}>
                Nuevo partido
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
