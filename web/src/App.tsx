import { useEffect } from 'react';
import { AudioRoot } from './audio/AudioRoot';
import { Nav } from './components/Nav';
import { CrtOverlay } from './fx/CrtOverlay';
import { ConfigDialog } from './components/ConfigDialog';
import { MuteButton } from './components/MuteButton';
import { useNewMatch } from './game/session';
import { SwirlBackground } from './fx/SwirlBackground';
import { ComoFunciona } from './pages/ComoFunciona';
import { Jugar } from './pages/Jugar';
import { Manos } from './pages/Manos';
import { Playground } from './pages/Playground';
import { Resultados } from './pages/Resultados';
import { hrefFor, useRoute } from './router';
import type { RouteId } from './router';
import { useSettings } from './settings';
import { DEFAULT_SKIN } from './skins';

const ART_URL = 'https://jcanabal.itch.io/spanish-deck-pixel-art';
const CODE_URL = 'https://github.com/tomzvilla/truco-cfr';
const MODEL_URL = 'https://huggingface.co/tomzv1/truco-cfr';

const TITLES: Record<RouteId, string> = {
  jugar: 'Jugar',
  'como-funciona': 'Cómo funciona',
  resultados: 'Resultados',
  manos: 'Manos destacadas',
  playground: 'Banco de pruebas',
};

function Page({ route }: { route: RouteId }) {
  switch (route) {
    case 'jugar': return <Jugar />;
    case 'como-funciona': return <ComoFunciona />;
    case 'resultados': return <Resultados />;
    case 'manos': return <Manos />;
    case 'playground': return <Playground />;
  }
}

export function App() {
  const route = useRoute();
  const settings = useSettings();
  const newMatch = useNewMatch();

  // <html data-motion> y data-reduced los mantiene settings.ts; acá solo se pone el título de la pestaña.
  useEffect(() => {
    document.title = `${TITLES[route]} · Truco CFR`;
  }, [route]);

  return (
    <>
      <SwirlBackground />
      <AudioRoot />
      <div className="app" data-route={route}>
        {/* la misma barra en todas las páginas: marca, secciones, y a la derecha silencio y configuración */}
        <header className="app__head">
          <a className="brand" href={hrefFor('jugar')}>Truco CFR</a>
          <Nav route={route} onNewMatch={route === 'jugar' ? newMatch : null} />
          <div className="app__tools">
            <MuteButton />
            <ConfigDialog icon />
          </div>
        </header>
        <main className="app__main">
          <Page route={route} />
        </main>
        <footer className="app__foot">
          <p>
            <a href={ART_URL}>{DEFAULT_SKIN.credit}</a>. El arte de las cartas no es MIT. El código, la mascota y el dorso sí.
          </p>
          <p>
            <a href={CODE_URL}>Código</a> · <a href={MODEL_URL}>Modelo</a> · <a href={hrefFor('playground')}>Banco de pruebas</a>
          </p>
        </footer>
      </div>
      <CrtOverlay on={settings.crt} />
    </>
  );
}
