import { useEffect } from 'react';
import { Nav } from './components/Nav';
import { CrtOverlay } from './fx/CrtOverlay';
import { SettingsToggles } from './fx/SettingsToggles';
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

  // <html data-motion> y data-reduced los mantiene settings.ts; acá solo se pone el título de la pestaña.
  useEffect(() => {
    document.title = `${TITLES[route]} · Truco CFR`;
  }, [route]);

  return (
    <>
      <SwirlBackground />
      <div className="app">
        <header className="app__head">
          <a className="brand" href={hrefFor('jugar')}>Truco CFR</a>
          <Nav route={route} />
        </header>
        <main className="app__main">
          <Page route={route} />
        </main>
        <footer className="app__foot">
          <SettingsToggles />
          <p>
            <a href={ART_URL}>{DEFAULT_SKIN.credit}</a>. El arte de las cartas no es MIT. El código, la mascota y el dorso sí.
          </p>
        </footer>
      </div>
      <CrtOverlay on={settings.crt} />
    </>
  );
}
