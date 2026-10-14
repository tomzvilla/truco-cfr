# Plan W — Web visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el sitio estático `web/` de truco-cfr (Vite + React + TypeScript) con toda la capa visual: mesa jugable con estética Balatro, mascota y dorso propios, skin de cartas `jcanabal`, "Cómo funciona", "Resultados" y "Manos destacadas", todo contra un view model (`TableView`) desacoplado del motor y alimentado con fixtures mock.

**Architecture:** La UI solo conoce `TableView` (datos planos) y `ActionId` (12 acciones, mismo orden que los índices 0..11 del motor). Un `GameSource` (`getView / subscribe / dispatch`) es la costura donde otro plan enchufará el Web Worker con `engine-wasm`; acá se implementa un `GameSource` demo. La lógica pura (fosforitos, skin, movimiento, curvas, layout de botones) vive en módulos sin React y con tests; los componentes son finos. Efectos con CSS + `requestAnimationFrame` + un fragment shader WebGL propio de ~25 líneas, sin librerías.

**Tech Stack:** Node 24 (WSL), Vite, React 19, TypeScript estricto, vitest + jsdom + Testing Library, `@fontsource/pixelify-sans` y `@fontsource/atkinson-hyperlegible` (fuentes gratis, empaquetadas, sin CDN). Scripts de Node en TypeScript (Node 24 los ejecuta sin compilar).

**Spec:** `docs/superpowers/specs/2026-10-13-truco-cfr-design.md` (sección 3.4 Web; también 3.1 para las 12 acciones y 4 para testing). El motor WASM y el Worker son de otro plan; este plan NO los toca.

> **Dónde se corren los comandos:** todos en WSL Ubuntu, dentro de `~/projects/truco-cfr/web`, salvo que diga otra cosa. Las rutas de archivo del plan son relativas a `~/projects/truco-cfr/web` (excepto las que empiezan con `docs/`).

## Global Constraints

- Stack: Vite + React + TypeScript, npm, Node 24 en WSL, vitest para tests. Sin Playwright y sin deploy en este plan.
- Web 100% en español (rioplatense, voseo). Texto de interfaz en oración normal, sin MAYÚSCULAS sostenidas.
- Todo gratis: sin servicios pagos, sin CDN obligatorio, sin cuentas. Fuentes y arte por npm / descarga gratuita.
- Sitio estático independiente del hosting: `base: './'` y navegación por hash (`#/jugar`), así funciona en cualquier hosting sin reglas de reescritura.
- Peso total del sitio (`dist/`) menor a 5 MB.
- Mobile-first: se puede jugar con una mano en un celular de 360 px de ancho; objetivos táctiles de al menos 48 px de alto.
- Pixel art escalado sin suavizado: `image-rendering: pixelated` y escalas enteras (1x, 2x, 3x) para cartas y mascota.
- Respetar `prefers-reduced-motion` (y permitir forzarlo desde un selector propio).
- Efectos sin librerías pesadas: CSS + `requestAnimationFrame`; fondo con fragment shader WebGL propio y liviano + fallback CSS; filtro CRT con toggle.
- `ActionId` = `'jugar0'|'jugar1'|'jugar2'|'envido'|'realEnvido'|'faltaEnvido'|'truco'|'retruco'|'valeCuatro'|'quiero'|'noQuiero'|'mazo'`, en ese orden = índices 0..11 del motor.
- `Card = { suit: 'espada'|'basto'|'oro'|'copa', number: 1|2|3|4|5|6|7|10|11|12 }`.
- Marcador a 30 puntos (15 malas y 15 buenas), fosforitos en grupos de 5.
- Arte de cartas: "Spanish Deck – Pixel Art" de jcanabal, edición gratuita 73×113 PNG. Crédito visible en la web: "Card art by Jose Angel Canabal". `web/public/cards/LICENSE-ART.md` aclara que el arte no es MIT y no puede redistribuirse como pack independiente.
- Hecho por nosotros y ORIGINAL (nada de la mascota de Claude ni marcas de terceros): mascota del bot, dorso de carta, fondo.
- Las cartas se cargan siempre a través de la interfaz `CardSkin` (`faceUrl`, `backUrl`, tamaño nativo).
- Código del repo bajo MIT; créditos a terceros en `NOTICE` (lo mantiene el plan de publicación).

## Review Focus

Entradas y condiciones que el spec insinúa y que más probablemente muerdan a alguien. Cada línea tiene su test en la tarea indicada.

1. **Pantalla de 360 px (o menos):** las cartas deben escalar a 1x sin desbordar nunca el ancho disponible, y nunca bajar de 1x ni salir de enteros. Test en Task 4 (`pickScale`, `handWidth`).
2. **Puntajes fuera de rango o raros** (0, 15, 16, 30, 31, negativos, `NaN`, decimales): los fosforitos y el marcador no se rompen ni dibujan de más. Test en Task 5.
3. **Una imagen de carta que falla al cargar** (PNG faltante o corrupto): la carta muestra su nombre en texto en vez de un cuadro roto, y sigue siendo jugable. Test en Task 7.
4. **WebGL no disponible / contexto perdido / `localStorage` que tira excepción** (modo privado, bloqueo de cookies): el fondo cae al CSS y las preferencias siguen funcionando en memoria. Tests en Task 6.
5. **Ruta desconocida en el hash y turno del bot (sin acciones disponibles):** una URL inválida cae en Jugar; si `actions` está vacío la botonera muestra "El bot está pensando…" y no ofrece nada. Tests en Tasks 1, 8 y 11.

## Dirección de arte (criterios del skill `frontend-design`, volcados al proyecto)

**Sujeto:** un bot de truco que se juega en el celular, con onda de timba nocturna. **Lo memorable (una sola cosa):** las cartas "vivas" (balanceo, tilt, pop) flotando sobre un remolino pixelado que nunca para. Todo lo demás es callado y disciplinado.

- **Paleta (6 colores con nombre):** Tinta `#1b1033` (fondo/contornos), Noche `#2b1b52` (paneles), Tiza `#fff6e0` (texto), Ámbar mate `#f2b134` (acción principal y mascota), Brasa `#e0453a` (peligro, farol, vale cuatro), Menta `#38d6c8` (foco y datos). Paño de mesa: `#14573d` / `#0d3d2b`. Remolino: bordó `#5a1230`, índigo `#1d1a4f`, verde azulado `#0f6f6a`.
- **Tipografía:** `Pixelify Sans` (display: títulos, botones, números del marcador) + `Atkinson Hyperlegible` (cuerpo de texto largo, pensada para legibilidad). Dos familias claramente distintas; el pixel solo donde es identidad, nunca en párrafos.
- **Forma:** esquinas "mordidas" de pixel (bordes con `box-shadow` escalonado, sin `border-radius`), sombras duras sin blur, botones que se hunden 2 px al apretar. Nada de gradientes decorativos (el único degradé vivo es el shader).
- **Movimiento:** `steps()` en las animaciones para que se sientan a pixel; una sola coreografía protagonista (cartas), efectos puntuales ante acciones (pop, explosión de puntos, temblor en vale cuatro). Nada de entradas "fade-up" en cada sección.
- **Evitado a propósito:** fondo crema con acento terracota, etiquetas en MAYÚSCULAS espaciadas sobre cada título, numeración 01/02/03 decorativa, tarjetas idénticas con sombra gris, flechas "→" en los botones. Los bordes y separadores solo aparecen cuando codifican algo (por ejemplo, la zona de farol de la curva está en Brasa).
- **Voz:** frases cortas, verbos concretos ("Jugar", "Quiero", "No quiero", "Al mazo"). Errores y vacíos dicen qué pasó y qué hacer.

## File Structure

```
web/
  index.html
  package.json  tsconfig.json  vite.config.ts  .gitignore
  scripts/
    cards-lib.ts        # lógica pura del importador (plan, PNG size, mensajes)
    cards-map.ts        # TABLA de mapeo palo+número -> archivo del zip (se completa tras inspeccionar)
    import-cards.ts     # CLI: descomprime, valida y copia a public/cards/jcanabal
  art-src/              # (gitignored) acá el usuario deja el zip
  public/cards/
    LICENSE-ART.md
    jcanabal/<palo>-<numero>.png   # 40 archivos generados por el script
  src/
    main.tsx  App.tsx  router.ts  settings.ts
    test/setup.ts  test/helpers.ts
    table/    types.ts validate.ts fixtures.ts labels.ts actions.ts status.ts
    skins/    types.ts jcanabal.ts index.ts scale.ts
    art/      pixels.ts mascot.ts Mascot.tsx cardBack.ts
    logic/    fosforitos.ts motion.ts format.ts xray.ts curve.ts scale.ts verdict.ts
    fx/       swirl.ts SwirlBackground.tsx CrtOverlay.tsx SettingsToggles.tsx useMotionPolicy.ts
    hooks/    useElementWidth.ts
    components/ PixelCard.tsx PointsBurst.tsx ShakeRoot.tsx Scoreboard.tsx ActionBar.tsx
                XRayPanel.tsx Mesa.tsx EnvidoCurve.tsx LineChart.tsx ReplayViewer.tsx Nav.tsx
    game/     source.ts demo.ts
    content/  howItWorks.ts
    data/     types.ts mock.ts
    pages/    Jugar.tsx ComoFunciona.tsx Resultados.tsx Manos.tsx Playground.tsx
    styles/   base.css  (más un .css por componente)
```

## Enmienda aprobada (2026-10-13): escala según la densidad de pantalla

El usuario aprobó que las cartas escalen en **píxeles físicos enteros** en vez de píxeles CSS enteros: en un celular con `devicePixelRatio` 3, una escala CSS de 4/3 equivale a 4 píxeles físicos por píxel del arte, así que se ve nítido y las cartas quedan ~33% más grandes que a 1x. Esta enmienda **reemplaza** lo que dicen las Tareas 4 y 8 sobre `pickScale`:

1. **Task 4, `src/skins/scale.ts`:** `pickScale` suma un sexto parámetro opcional `dpr = 1` y deja de devolver siempre un entero. Implementación:

```ts
/** Escala CSS (>= 1) tal que escala × dpr sea un entero: píxeles físicos enteros, sin desbordar. */
export function pickScale(
  availableWidth: number,
  nativeWidth: number,
  cardsAcross: number,
  gap: number,
  maxScale = 3,
  dpr = 1,
): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  const d = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1;
  const perCard = (availableWidth - gap * (cardsAcross - 1)) / cardsAcross;
  const deviceSteps = Math.floor((perCard / nativeWidth) * d + 1e-9);
  return Math.max(1, Math.min(maxScale, deviceSteps / d));
}
```

Los tests existentes de `scale.test.ts` se mantienen: con `dpr = 1` todo sigue siendo entero. Se agregan estos a `src/skins/scale.test.ts`:

```ts
describe('pickScale con densidad de pantalla', () => {
  it('dpr 3 en 360 px: 4 píxeles físicos por píxel del arte', () => {
    expect(pickScale(328, 73, 3, 8, 3, 3)).toBeCloseTo(4 / 3);
  });
  it('escala × dpr siempre entero', () => {
    for (const dpr of [1, 2, 3]) {
      for (let w = 200; w <= 1400; w += 37) {
        const s = pickScale(w, 73, 3, 8, 3, dpr);
        expect(Number.isInteger(Math.round(s * dpr * 1e6) / 1e6)).toBe(true);
        expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(Math.max(w, handWidth(73, 1, 3, 8)) + 1e-6);
      }
    }
  });
  it('dpr inválido se trata como 1', () => {
    expect(pickScale(328, 73, 3, 8, 3, Number.NaN)).toBe(1);
    expect(pickScale(328, 73, 3, 8, 3, 0.5)).toBe(1);
  });
});
```

2. **Task 8, la mesa:** la llamada pasa a ser `pickScale(width - 32, skin.native.w, 3, 8, 3, window.devicePixelRatio || 1)`. Donde la Task 8 dice "a 360 px las cartas van a escala 1x", ahora vale: "a 360 px la escala depende de la densidad; con dpr 3 queda en 4/3". Ningún otro cálculo cambia: `w = skin.native.w * scale` y `--scale` aceptan valores fraccionarios.

3. **Review Focus, punto 1:** se lee como "las cartas nunca desbordan el ancho disponible, nunca bajan de 1x, y escala × dpr es entero".

---

### Task 1: Scaffold Vite + React + TypeScript + vitest + router por hash

**En criollo:** armamos la carpeta `web/` desde cero, a mano (sin el asistente interactivo de Vite, así queda reproducible). Dejamos andando tres cosas: el servidor de desarrollo, los tests (vitest) y un mini router que usa el `#` de la URL. Usamos el hash porque así el sitio funciona en cualquier hosting estático sin configurar nada. Al final de la tarea hay una pantalla mínima que ya lee la ruta y un test que lo prueba.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/router.ts`
- Create: `src/test/setup.ts`
- Test: `src/router.test.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `ROUTES`, `type RouteId = 'jugar'|'como-funciona'|'resultados'|'manos'|'playground'`, `DEFAULT_ROUTE`, `parseHash(hash: string): RouteId`, `hrefFor(route: RouteId): string`, `useRoute(): RouteId`. `App` exportado como `export function App()`.

- [ ] **Step 1: Crear la carpeta y verificar Node**

```bash
cd ~/projects/truco-cfr
mkdir -p web && cd web
node --version
```
Expected: `v24.x.x`. Si no es 24, parar y avisar al usuario (el entorno se arma en otro plan).

- [ ] **Step 2: Escribir `package.json` solo con scripts e instalar dependencias**

`package.json`:
```json
{
  "name": "truco-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "cards:list": "node scripts/import-cards.ts --list",
    "cards:import": "node scripts/import-cards.ts"
  }
}
```

Instalar (npm resuelve las versiones vigentes):
```bash
npm install react react-dom @fontsource/pixelify-sans @fontsource/atkinson-hyperlegible
npm install -D vite @vitejs/plugin-react typescript vitest jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @types/react @types/react-dom @types/node
```
Expected: termina sin errores; aparecen `node_modules/` y `package-lock.json`.

- [ ] **Step 3: Configuración de TypeScript, Vite y Git**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals", "node", "vite/client"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

`.gitignore`:
```
node_modules
dist
art-src
*.tsbuildinfo
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1b1033" />
    <title>Truco CFR</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Escribir el test que falla del router**

`src/router.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseHash, hrefFor, DEFAULT_ROUTE, ROUTES } from './router';

describe('parseHash', () => {
  it('reconoce cada ruta conocida', () => {
    for (const r of ROUTES) expect(parseHash(`#/${r}`)).toBe(r);
  });
  it('ignora query y subrutas', () => {
    expect(parseHash('#/manos?id=3')).toBe('manos');
    expect(parseHash('#/resultados/extra')).toBe('resultados');
  });
  it('cae en Jugar con hash vacío o desconocido', () => {
    expect(parseHash('')).toBe(DEFAULT_ROUTE);
    expect(parseHash('#')).toBe(DEFAULT_ROUTE);
    expect(parseHash('#/nada-que-ver')).toBe(DEFAULT_ROUTE);
    expect(DEFAULT_ROUTE).toBe('jugar');
  });
  it('hrefFor es la inversa de parseHash', () => {
    for (const r of ROUTES) expect(parseHash(hrefFor(r))).toBe(r);
  });
});
```

- [ ] **Step 5: Correr el test y ver que falla**

Run: `npx vitest run src/router.test.ts`
Expected: FAIL (`Failed to resolve import "./router"`).

- [ ] **Step 6: Implementar el router**

`src/router.ts`:
```ts
import { useSyncExternalStore } from 'react';

export const ROUTES = ['jugar', 'como-funciona', 'resultados', 'manos', 'playground'] as const;
export type RouteId = (typeof ROUTES)[number];
export const DEFAULT_ROUTE: RouteId = 'jugar';

export function parseHash(hash: string): RouteId {
  const first = hash.replace(/^#\/?/, '').split(/[?/]/)[0] ?? '';
  return (ROUTES as readonly string[]).includes(first) ? (first as RouteId) : DEFAULT_ROUTE;
}

export function hrefFor(route: RouteId): string {
  return `#/${route}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): RouteId {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}
```

- [ ] **Step 7: Test de App y pantalla mínima**

`src/App.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App (esqueleto)', () => {
  it('muestra el título y la ruta actual', () => {
    window.location.hash = '#/resultados';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Truco CFR');
    expect(screen.getByTestId('route')).toHaveTextContent('resultados');
  });
  it('una ruta inválida cae en jugar', () => {
    window.location.hash = '#/no-existe';
    render(<App />);
    expect(screen.getByTestId('route')).toHaveTextContent('jugar');
  });
});
```

`src/App.tsx`:
```tsx
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return (
    <main>
      <h1>Truco CFR</h1>
      <p data-testid="route">{route}</p>
    </main>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
(Si algún peso no existe, mirar `ls node_modules/@fontsource/<paquete>/` y usar los archivos que haya.)

- [ ] **Step 8: Verificar tests, tipos y build**

Run: `npx vitest run && npx tsc && npm run build`
Expected: tests PASS (6 tests), `tsc` sin salida, build genera `dist/`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore index.html src
git commit -m "feat(web): scaffold Vite + React + TS + vitest con router por hash"
```

---

### Task 2: View model `TableView`, acciones, fixtures y validador

**En criollo:** la interfaz no debe saber nada del motor Rust. Definimos un "contrato" de datos: todo lo que la pantalla necesita para dibujar una mano (mis cartas, lo jugado en cada baza, el marcador, los cantos, las acciones habilitadas, las probabilidades del bot para el modo rayos X, el ánimo de la mascota). Después el otro plan solo tiene que traducir el estado del motor a este formato. También armamos cuatro "fotos" falsas del juego (fixtures) para desarrollar lo visual sin motor, y un validador que detecta fixtures incoherentes (por ejemplo, ofrecer jugar una carta que ya se jugó).

**Files:**
- Create: `src/table/types.ts`, `src/table/validate.ts`, `src/table/fixtures.ts`
- Test: `src/table/types.test.ts`, `src/table/fixtures.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (todos desde `src/table/types.ts` salvo aclaración):
  - `SUITS`, `type Suit`, `CARD_NUMBERS`, `type CardNumber`, `interface Card`, `cardKey(c: Card): string` (`'espada-1'`), `allCards(): Card[]` (40 cartas).
  - `ACTION_IDS` (array ordenado, `as const`), `type ActionId`, `PLAY_ACTIONS`, `actionIndex(id): number`, `actionFromIndex(i: number): ActionId` (tira `RangeError` fuera de 0..11).
  - `type Seat = 'yo'|'bot'`, `MOODS`, `type Mood`, `type TrucoLevel = 1|2|3|4`, `type TrucoCall`, `type EnvidoCall`, `TRUCO_CALL_LEVEL`, `interface HandCard`, `TrickWinner`, `TrickView`, `TrucoView`, `EnvidoView`, `XRayEntry`, `type Phase`, `interface TableView`.
  - `validateTableView(v: TableView): string[]` (`src/table/validate.ts`; lista vacía = válido).
  - `FIXTURES: Record<FixtureName, TableView>`, `FIXTURE_NAMES` (`src/table/fixtures.ts`): `inicioDeMano`, `envidoPendiente`, `trucoPendiente`, `finDeManoRayosX`.

- [ ] **Step 1: Escribir los tests de tipos que fallan**

`src/table/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  ACTION_IDS, actionIndex, actionFromIndex, allCards, cardKey, SUITS, CARD_NUMBERS,
} from './types';

describe('ACTION_IDS', () => {
  it('tiene las 12 acciones en el orden de los índices del motor', () => {
    expect([...ACTION_IDS]).toEqual([
      'jugar0', 'jugar1', 'jugar2', 'envido', 'realEnvido', 'faltaEnvido',
      'truco', 'retruco', 'valeCuatro', 'quiero', 'noQuiero', 'mazo',
    ]);
  });
  it('actionIndex y actionFromIndex son inversas', () => {
    ACTION_IDS.forEach((id, i) => {
      expect(actionIndex(id)).toBe(i);
      expect(actionFromIndex(i)).toBe(id);
    });
  });
  it('actionFromIndex rechaza índices fuera de rango', () => {
    expect(() => actionFromIndex(12)).toThrow(RangeError);
    expect(() => actionFromIndex(-1)).toThrow(RangeError);
  });
});

describe('cartas', () => {
  it('hay 40 cartas distintas', () => {
    const keys = allCards().map(cardKey);
    expect(keys).toHaveLength(40);
    expect(new Set(keys).size).toBe(40);
  });
  it('cardKey tiene formato palo-número', () => {
    expect(cardKey({ suit: 'espada', number: 1 })).toBe('espada-1');
    expect(SUITS).toEqual(['espada', 'basto', 'oro', 'copa']);
    expect([...CARD_NUMBERS]).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
  });
});
```

`src/table/fixtures.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { FIXTURES, FIXTURE_NAMES } from './fixtures';
import { validateTableView } from './validate';
import type { TableView } from './types';

describe('fixtures', () => {
  it('son exactamente las cuatro esperadas', () => {
    expect([...FIXTURE_NAMES]).toEqual([
      'inicioDeMano', 'envidoPendiente', 'trucoPendiente', 'finDeManoRayosX',
    ]);
  });
  it.each(FIXTURE_NAMES)('%s es un TableView válido', (name) => {
    expect(validateTableView(FIXTURES[name])).toEqual([]);
  });
  it('el fin de mano trae rayos X y cartas del bot reveladas', () => {
    const v = FIXTURES.finDeManoRayosX;
    expect(v.phase).toBe('finDeMano');
    expect(v.xray?.length).toBeGreaterThan(1);
    expect(v.botHand).toHaveLength(3);
    expect(v.actions).toEqual([]);
  });
  it('el truco pendiente lo cantó el bot y se puede subir', () => {
    const v = FIXTURES.trucoPendiente;
    expect(v.truco.pending).toEqual({ call: 'truco', by: 'bot' });
    expect(v.actions).toContain('retruco');
  });
});

describe('validateTableView detecta incoherencias', () => {
  const base = FIXTURES.inicioDeMano;
  const withChange = (patch: Partial<TableView>): TableView => ({ ...base, ...patch });

  it('jugar una carta ya jugada', () => {
    const hand = base.hand.map((h, i) => (i === 0 ? { ...h, played: true } : h));
    expect(validateTableView(withChange({ hand }))).toContain('jugar0 está habilitada pero esa carta ya se jugó');
  });
  it('puntaje fuera de 0..30', () => {
    expect(validateTableView(withChange({ score: [31, 0] })).length).toBeGreaterThan(0);
    expect(validateTableView(withChange({ score: [-1, 0] })).length).toBeGreaterThan(0);
  });
  it('acciones repetidas', () => {
    expect(validateTableView(withChange({ actions: ['truco', 'truco'] })).length).toBeGreaterThan(0);
  });
  it('probabilidades de rayos X que no suman 1', () => {
    const xray = [{ action: 'truco' as const, prob: 0.2 }, { action: 'mazo' as const, prob: 0.2 }];
    expect(validateTableView(withChange({ xray })).length).toBeGreaterThan(0);
  });
  it('canto pendiente incoherente con el nivel aceptado', () => {
    const truco = { acceptedLevel: 1 as const, pending: { call: 'retruco' as const, by: 'bot' as const } };
    expect(validateTableView(withChange({ truco })).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/table`
Expected: FAIL (imports no resueltos).

- [ ] **Step 3: Implementar `types.ts`**

`src/table/types.ts`:
```ts
export const SUITS = ['espada', 'basto', 'oro', 'copa'] as const;
export type Suit = (typeof SUITS)[number];

export const CARD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type CardNumber = (typeof CARD_NUMBERS)[number];

export interface Card {
  suit: Suit;
  number: CardNumber;
}

export const cardKey = (c: Card): string => `${c.suit}-${c.number}`;

export function allCards(): Card[] {
  return SUITS.flatMap((suit) => CARD_NUMBERS.map((number) => ({ suit, number })));
}

/** Mismo orden que los índices 0..11 del motor Rust. NO reordenar. */
export const ACTION_IDS = [
  'jugar0', 'jugar1', 'jugar2',
  'envido', 'realEnvido', 'faltaEnvido',
  'truco', 'retruco', 'valeCuatro',
  'quiero', 'noQuiero', 'mazo',
] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export const PLAY_ACTIONS = ['jugar0', 'jugar1', 'jugar2'] as const;

export function actionIndex(id: ActionId): number {
  return ACTION_IDS.indexOf(id);
}

export function actionFromIndex(i: number): ActionId {
  const id = ACTION_IDS[i];
  if (id === undefined) throw new RangeError(`Índice de acción fuera de rango: ${i}`);
  return id;
}

export type Seat = 'yo' | 'bot';

export const MOODS = ['neutral', 'farol', 'descubierto', 'gana', 'pierde'] as const;
export type Mood = (typeof MOODS)[number];

/** 1 = truco sin cantar (la mano vale 1). */
export type TrucoLevel = 1 | 2 | 3 | 4;
export type TrucoCall = 'truco' | 'retruco' | 'valeCuatro';
export type EnvidoCall = 'envido' | 'realEnvido' | 'faltaEnvido';
export const TRUCO_CALL_LEVEL: Record<TrucoCall, TrucoLevel> = { truco: 2, retruco: 3, valeCuatro: 4 };

/** `HandCard[i]` corresponde a la acción `jugar{i}` (mano original ordenada por jerarquía). */
export interface HandCard {
  card: Card;
  played: boolean;
}

export type TrickWinner = Seat | 'parda' | null;

export interface TrickView {
  mine: Card | null;
  bot: Card | null;
  winner: TrickWinner;
}

export interface TrucoView {
  acceptedLevel: TrucoLevel;
  pending: { call: TrucoCall; by: Seat } | null;
}

export interface EnvidoView {
  calls: { call: EnvidoCall; by: Seat }[];
  pending: { by: Seat } | null;
  /** Tantos revelados. `null` en un jugador = no reveló ("son buenas"). `reveal: null` = no hubo reveal. */
  reveal: { yo: number | null; bot: number | null } | null;
}

export interface XRayEntry {
  action: ActionId;
  prob: number;
}

export type Phase = 'jugando' | 'finDeMano';

export interface TableView {
  hand: HandCard[];
  tricks: TrickView[];
  /** [yo, bot], de 0 a 30. */
  score: readonly [number, number];
  mano: Seat;
  truco: TrucoView;
  envido: EnvidoView;
  actions: ActionId[];
  /** Probabilidades del bot por acción (modo rayos X). */
  xray?: XRayEntry[];
  /** Cartas del bot reveladas (típicamente al terminar la mano). */
  botHand?: Card[];
  mood: Mood;
  phase: Phase;
}
```

- [ ] **Step 4: Implementar el validador**

`src/table/validate.ts`:
```ts
import { ACTION_IDS, PLAY_ACTIONS, TRUCO_CALL_LEVEL } from './types';
import type { TableView } from './types';

/** Devuelve la lista de problemas; vacía si el TableView es coherente. */
export function validateTableView(v: TableView): string[] {
  const errors: string[] = [];

  if (v.hand.length !== 3) errors.push(`La mano debe tener 3 cartas (tiene ${v.hand.length})`);
  if (v.tricks.length > 3) errors.push('No puede haber más de 3 bazas');

  v.score.forEach((p, i) => {
    if (!Number.isInteger(p) || p < 0 || p > 30) {
      errors.push(`Puntaje fuera de 0..30 (${i === 0 ? 'yo' : 'bot'}: ${p})`);
    }
  });

  if (new Set(v.actions).size !== v.actions.length) errors.push('Hay acciones repetidas');
  for (const a of v.actions) {
    if (!(ACTION_IDS as readonly string[]).includes(a)) errors.push(`Acción desconocida: ${a}`);
  }

  PLAY_ACTIONS.forEach((id, n) => {
    if (!v.actions.includes(id)) return;
    const slot = v.hand[n];
    if (!slot) errors.push(`${id} está habilitada pero no existe esa carta`);
    else if (slot.played) errors.push(`${id} está habilitada pero esa carta ya se jugó`);
  });

  if (v.phase === 'finDeMano' && v.actions.length > 0) {
    errors.push('En finDeMano no puede haber acciones habilitadas');
  }

  const p = v.truco.pending;
  if (p && TRUCO_CALL_LEVEL[p.call] !== v.truco.acceptedLevel + 1) {
    errors.push(`Canto pendiente "${p.call}" incoherente con el nivel aceptado ${v.truco.acceptedLevel}`);
  }

  if (v.xray) {
    const sum = v.xray.reduce((acc, e) => acc + e.prob, 0);
    if (v.xray.some((e) => e.prob < 0 || e.prob > 1)) errors.push('Probabilidad de rayos X fuera de 0..1');
    if (Math.abs(sum - 1) > 0.01) errors.push(`Las probabilidades de rayos X suman ${sum.toFixed(3)}, no 1`);
    if (new Set(v.xray.map((e) => e.action)).size !== v.xray.length) errors.push('Rayos X con acciones repetidas');
  }

  if (v.botHand && v.botHand.length > 3) errors.push('botHand tiene más de 3 cartas');

  return errors;
}
```

- [ ] **Step 5: Implementar los fixtures**

`src/table/fixtures.ts`:
```ts
import type { Card, CardNumber, Suit, TableView } from './types';

const c = (suit: Suit, number: CardNumber): Card => ({ suit, number });

export const FIXTURE_NAMES = [
  'inicioDeMano', 'envidoPendiente', 'trucoPendiente', 'finDeManoRayosX',
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const inicioDeMano: TableView = {
  hand: [
    { card: c('espada', 1), played: false },
    { card: c('oro', 7), played: false },
    { card: c('basto', 4), played: false },
  ],
  tricks: [],
  score: [3, 5],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [], pending: null, reveal: null },
  actions: ['jugar0', 'jugar1', 'jugar2', 'envido', 'realEnvido', 'faltaEnvido', 'truco', 'mazo'],
  mood: 'neutral',
  phase: 'jugando',
};

// Soy mano, jugué el 3 de bastos y el bot (pie) cantó envido antes de jugar.
const envidoPendiente: TableView = {
  hand: [
    { card: c('basto', 3), played: true },
    { card: c('basto', 6), played: false },
    { card: c('oro', 5), played: false },
  ],
  tricks: [{ mine: c('basto', 3), bot: null, winner: null }],
  score: [12, 14],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [{ call: 'envido', by: 'bot' }], pending: { by: 'bot' }, reveal: null },
  actions: ['quiero', 'noQuiero', 'envido', 'realEnvido', 'faltaEnvido'],
  mood: 'neutral',
  phase: 'jugando',
};

// El bot es mano, perdió la primera baza y en la segunda canta truco.
const trucoPendiente: TableView = {
  hand: [
    { card: c('espada', 1), played: true },
    { card: c('oro', 7), played: true },
    { card: c('basto', 4), played: false },
  ],
  tricks: [
    { mine: c('oro', 7), bot: c('basto', 3), winner: 'yo' },
    { mine: c('espada', 1), bot: null, winner: null },
  ],
  score: [10, 7],
  mano: 'bot',
  truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'bot' } },
  envido: { calls: [], pending: null, reveal: null },
  actions: ['quiero', 'noQuiero', 'retruco'],
  mood: 'farol',
  phase: 'jugando',
};

// Fin de mano: el bot cantó truco con la peor mano y yo me fui al mazo. Rayos X y cartas reveladas.
const finDeManoRayosX: TableView = {
  hand: [
    { card: c('copa', 3), played: false },
    { card: c('basto', 6), played: false },
    { card: c('oro', 5), played: true },
  ],
  tricks: [{ mine: c('oro', 5), bot: c('oro', 6), winner: 'bot' }],
  score: [9, 9],
  mano: 'yo',
  truco: { acceptedLevel: 1, pending: null },
  envido: { calls: [], pending: null, reveal: null },
  actions: [],
  xray: [
    { action: 'truco', prob: 0.34 },
    { action: 'jugar1', prob: 0.58 },
    { action: 'mazo', prob: 0.08 },
  ],
  botHand: [c('oro', 6), c('copa', 5), c('basto', 4)],
  mood: 'gana',
  phase: 'finDeMano',
};

export const FIXTURES: Record<FixtureName, TableView> = {
  inicioDeMano,
  envidoPendiente,
  trucoPendiente,
  finDeManoRayosX,
};
```

- [ ] **Step 6: Correr y ver que pasan**

Run: `npx vitest run src/table && npx tsc`
Expected: PASS (todos los tests de `src/table`), `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/table
git commit -m "feat(web): view model TableView, ActionId ordenado, fixtures y validador"
```

---

### Task 3: Mascota original (5 estados) y dorso de carta en pixel art

**En criollo:** el bot necesita cara. Diseñamos una mascota propia: "Fosfo", un robotito ámbar con antena (nada que ver con la mascota de Claude ni con marcas de terceros), dibujada como una grilla de 16×16 píxeles. La grilla es una matriz de letras donde cada letra es un color de la paleta; un conversor la transforma en `<rect>` de SVG (uniendo píxeles contiguos del mismo color para que pese poco). Tiene 5 estados que cambian solo la cara: neutral, farol (sonrisa de lado), descubierto (ojos grandes y sudor), gana (ojos felices y destellos), pierde (lágrimas y antena gris). El dorso de carta se genera con un algoritmo determinista de 73×113 (mismo tamaño que las cartas reales): marco crema, rombos violetas y un medallón ámbar con ojos, un guiño a la mascota. Los tests garantizan que ninguna matriz tenga una fila de largo distinto o una letra sin color.

**Files:**
- Create: `src/art/pixels.ts`, `src/art/mascot.ts`, `src/art/Mascot.tsx`, `src/art/cardBack.ts`
- Test: `src/art/pixels.test.ts`, `src/art/mascot.test.ts`, `src/art/cardBack.test.ts`

**Interfaces:**
- Consumes: `Mood`, `MOODS` de `src/table/types.ts`.
- Produces:
  - `src/art/pixels.ts`: `interface PixelRect { x: number; y: number; w: number; fill: string }` (alto siempre 1), `matrixToRects(matrix: string[], palette: Record<string, string>): PixelRect[]` (el carácter `.` es transparente; carácter sin color tira `Error`).
  - `src/art/mascot.ts`: `MASCOT_SIZE = 16`, `MASCOT_PALETTE`, `mascotMatrix(mood: Mood): string[]`, `mascotRects(mood: Mood): PixelRect[]`.
  - `src/art/Mascot.tsx`: `Mascot({ mood, scale? })` (scale entero, default 6).
  - `src/art/cardBack.ts`: `CARD_W = 73`, `CARD_H = 113`, `CARD_BACK_PALETTE`, `cardBackMatrix(): string[]`, `cardBackSvg(): string`, `cardBackDataUrl(): string`.

**Grilla de la mascota (decisión de diseño cerrada).** Paleta: `k` contorno `#1b1033`, `b` cuerpo `#f2b134`, `d` sombra `#c47a1c`, `h` brillo `#ffe08a`, `w` blanco `#fff6e0`, `r` rojo `#e0453a`, `c` antena `#38d6c8`, `s` agua `#7ed6ff`, `y` amarillo `#ffd23f`, `g` gris `#8a86a0`. Filas 0–4 y 11–15 son el cuerpo (antena, tapa, brillo, sombra, pies); las filas 5–10 son la cara de 12 columnas, que enmarcamos con `.k` + cara + `k.`. Cada estado además pisa algunos píxeles sueltos ("extras").

- [ ] **Step 1: Escribir los tests que fallan**

`src/art/pixels.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matrixToRects } from './pixels';

describe('matrixToRects', () => {
  const palette = { a: '#111', b: '#222' };
  it('une píxeles contiguos del mismo color en una fila', () => {
    expect(matrixToRects(['aab'], palette)).toEqual([
      { x: 0, y: 0, w: 2, fill: '#111' },
      { x: 2, y: 0, w: 1, fill: '#222' },
    ]);
  });
  it('ignora los transparentes', () => {
    expect(matrixToRects(['.a.'], palette)).toEqual([{ x: 1, y: 0, w: 1, fill: '#111' }]);
  });
  it('falla con un mensaje claro si falta un color', () => {
    expect(() => matrixToRects(['az'], palette)).toThrow(/"z".*fila 0.*col 1/);
  });
});
```

`src/art/mascot.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MOODS } from '../table/types';
import { MASCOT_PALETTE, MASCOT_SIZE, mascotMatrix, mascotRects } from './mascot';
import { Mascot } from './Mascot';

describe('mascota', () => {
  it.each(MOODS)('%s es una grilla cuadrada de 16x16 con solo colores de la paleta', (mood) => {
    const m = mascotMatrix(mood);
    expect(m).toHaveLength(MASCOT_SIZE);
    for (const row of m) {
      expect(row).toHaveLength(MASCOT_SIZE);
      for (const ch of row) expect(ch === '.' || ch in MASCOT_PALETTE).toBe(true);
    }
  });
  it('los 5 estados son visualmente distintos', () => {
    const joined = MOODS.map((m) => mascotMatrix(m).join('|'));
    expect(new Set(joined).size).toBe(5);
  });
  it('genera rects (no vacío) y todos dentro de la grilla', () => {
    for (const mood of MOODS) {
      const rects = mascotRects(mood);
      expect(rects.length).toBeGreaterThan(20);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(MASCOT_SIZE);
        expect(r.y).toBeLessThan(MASCOT_SIZE);
      }
    }
  });
  it('el componente es un SVG accesible con tamaño entero', () => {
    render(<Mascot mood="farol" scale={4} />);
    const svg = screen.getByRole('img', { name: /mascota.*farol/i });
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
  });
});
```

`src/art/cardBack.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CARD_BACK_PALETTE, CARD_H, CARD_W, cardBackDataUrl, cardBackMatrix, cardBackSvg } from './cardBack';

describe('dorso de carta', () => {
  const m = cardBackMatrix();
  it('mide 73x113 como las caras', () => {
    expect(CARD_W).toBe(73);
    expect(CARD_H).toBe(113);
    expect(m).toHaveLength(113);
    expect(m.every((row) => row.length === 73)).toBe(true);
  });
  it('usa solo colores de la paleta', () => {
    for (const row of m) for (const ch of row) expect(ch in CARD_BACK_PALETTE).toBe(true);
  });
  it('es determinista', () => {
    expect(cardBackMatrix()).toEqual(m);
  });
  it('tiene contorno, medallón ámbar y ojos blancos', () => {
    expect(m[0]![0]).toBe('k');
    expect(m[56]![36]).toBe('a');
    expect(m[50]![28]).toBe('w');
  });
  it('el SVG y la data URL son válidos', () => {
    expect(cardBackSvg()).toContain('viewBox="0 0 73 113"');
    expect(cardBackDataUrl().startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/art`
Expected: FAIL (imports no resueltos).

- [ ] **Step 3: Implementar el conversor de matrices**

`src/art/pixels.ts`:
```ts
export interface PixelRect {
  x: number;
  y: number;
  /** Ancho en píxeles de la grilla; el alto siempre es 1. */
  w: number;
  fill: string;
}

/** Convierte una matriz de letras en rects, uniendo corridas horizontales del mismo color. '.' = transparente. */
export function matrixToRects(matrix: string[], palette: Record<string, string>): PixelRect[] {
  const rects: PixelRect[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = palette[ch];
      if (!fill) throw new Error(`Carácter sin color en la paleta: "${ch}" (fila ${y}, col ${x})`);
      rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return rects;
}
```

- [ ] **Step 4: Implementar la mascota**

`src/art/mascot.ts`:
```ts
import type { Mood } from '../table/types';
import { matrixToRects } from './pixels';
import type { PixelRect } from './pixels';

export const MASCOT_SIZE = 16;

export const MASCOT_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  b: '#f2b134', // cuerpo
  d: '#c47a1c', // sombra
  h: '#ffe08a', // brillo
  w: '#fff6e0', // blanco
  r: '#e0453a', // rojo
  c: '#38d6c8', // antena
  s: '#7ed6ff', // sudor / lágrima
  y: '#ffd23f', // destello
  g: '#8a86a0', // gris
};

const frame = (inner: string): string => `.k${inner}k.`;

/** Filas 5..10: 12 columnas de cara por estado. */
const FACES: Record<Mood, string[]> = {
  neutral: [
    'bbbbbbbbbbbb',
    'bwwwbbbbwwwb',
    'bwkwbbbbwkwb',
    'bbbbbbbbbbbb',
    'bbbbkkkkbbbb',
    'bbbbbbbbbbbb',
  ],
  farol: [
    'bkkkbbbbbkkb',
    'bwwwbbbbwwwb',
    'bwkwbbbbkkkb',
    'bbbbbbbbbbbb',
    'bkbbbbbbbbkb',
    'bbkkkkkkkkbb',
  ],
  descubierto: [
    'bwwwbbbbwwwb',
    'bwkwbbbbwkwb',
    'bwwwbbbbwwwb',
    'bbbbkkkkbbbb',
    'bbbbkrrkbbbb',
    'bbbbkkkkbbbb',
  ],
  gana: [
    'bbbbbbbbbbbb',
    'bbkbbbbbbkbb',
    'bkbkbbbbkbkb',
    'brrbbbbbbrrb',
    'bbkkkkkkkkbb',
    'bbbkrrrrkbbb',
  ],
  pierde: [
    'bbbbbbbbbbbb',
    'bkkkbbbbkkkb',
    'bbsbbbbbbbsb',
    'bbsbbbbbbbsb',
    'bbbbkkkkbbbb',
    'bbbkbbbbkbbb',
  ],
};

interface Extra {
  x: number;
  y: number;
  ch: string;
}

const EXTRAS: Record<Mood, Extra[]> = {
  neutral: [],
  farol: [],
  descubierto: [
    { x: 15, y: 3, ch: 's' },
    { x: 15, y: 4, ch: 's' },
    { x: 15, y: 5, ch: 's' },
  ],
  gana: [
    { x: 7, y: 0, ch: 'y' }, { x: 8, y: 0, ch: 'y' },
    { x: 1, y: 0, ch: 'y' },
    { x: 0, y: 1, ch: 'y' }, { x: 1, y: 1, ch: 'y' }, { x: 2, y: 1, ch: 'y' },
    { x: 1, y: 2, ch: 'y' },
  ],
  pierde: [
    { x: 7, y: 0, ch: 'g' }, { x: 8, y: 0, ch: 'g' },
  ],
};

export function mascotMatrix(mood: Mood): string[] {
  const rows: string[] = [
    '.......cc.......',
    '.......kk.......',
    '.......kk.......',
    `..${'k'.repeat(12)}..`,
    frame('bhhhbbbbbbbb'),
    ...FACES[mood].map(frame),
    frame('d'.repeat(12)),
    `..${'k'.repeat(12)}..`,
    '...kbk....kbk...',
    '...kkk....kkk...',
    '.'.repeat(16),
  ];
  const grid = rows.map((r) => r.split(''));
  for (const e of EXTRAS[mood]) grid[e.y]![e.x] = e.ch;
  return grid.map((r) => r.join(''));
}

export function mascotRects(mood: Mood): PixelRect[] {
  return matrixToRects(mascotMatrix(mood), MASCOT_PALETTE);
}
```

`src/art/Mascot.tsx`:
```tsx
import { useMemo } from 'react';
import type { Mood } from '../table/types';
import { MASCOT_SIZE, mascotRects } from './mascot';

const MOOD_LABEL: Record<Mood, string> = {
  neutral: 'neutral',
  farol: 'haciendo farol',
  descubierto: 'descubierto',
  gana: 'ganando',
  pierde: 'perdiendo',
};

/** `scale` debe ser entero para conservar el pixel perfecto. */
export function Mascot({ mood, scale = 6 }: { mood: Mood; scale?: number }) {
  const rects = useMemo(() => mascotRects(mood), [mood]);
  const size = MASCOT_SIZE * scale;
  return (
    <svg
      className="mascot"
      data-mood={mood}
      role="img"
      aria-label={`Mascota del bot, ${MOOD_LABEL[mood]}`}
      viewBox={`0 0 ${MASCOT_SIZE} ${MASCOT_SIZE}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 5: Implementar el dorso de carta**

`src/art/cardBack.ts`:
```ts
import { matrixToRects } from './pixels';

export const CARD_W = 73;
export const CARD_H = 113;

export const CARD_BACK_PALETTE: Record<string, string> = {
  k: '#1b1033', // contorno
  c: '#f2e6c9', // marco crema
  f: '#3b1e6e', // campo violeta
  l: '#5b34a8', // rombos
  a: '#f2b134', // medallón
  d: '#c47a1c', // borde del medallón (sombra)
  w: '#fff6e0', // ojos
};

function pixelAt(x: number, y: number): string {
  const edge = Math.min(x, y, CARD_W - 1 - x, CARD_H - 1 - y);
  if (edge === 0) return 'k';
  if (edge <= 3) return 'c';
  if (edge === 4) return 'k';

  // ojos de la mascota (cajas de 5x5 con pupila de 2x2)
  const inEye = (x0: number) => x >= x0 && x < x0 + 5 && y >= 49 && y < 54;
  const inPupil = (x0: number) => x >= x0 + 1 && x < x0 + 3 && y >= 51 && y < 53;

  const dx = (x - 36) / 17;
  const dy = (y - 56) / 25;
  const e = dx * dx + dy * dy;
  if (e <= 1.0) {
    if (e > 0.82) return 'k'; // anillo
    if (inPupil(28) || inPupil(40)) return 'k';
    if (inEye(28) || inEye(40)) return 'w';
    if (y === 62 && x >= 31 && x <= 41) return 'k'; // boca
    return e > 0.62 ? 'd' : 'a';
  }
  return (x + y) % 8 === 0 || (x - y + 1024) % 8 === 0 ? 'l' : 'f';
}

let cached: string[] | null = null;

export function cardBackMatrix(): string[] {
  if (cached) return cached;
  const rows: string[] = [];
  for (let y = 0; y < CARD_H; y++) {
    let row = '';
    for (let x = 0; x < CARD_W; x++) row += pixelAt(x, y);
    rows.push(row);
  }
  cached = rows;
  return rows;
}

export function cardBackSvg(): string {
  const rects = matrixToRects(cardBackMatrix(), CARD_BACK_PALETTE)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" ` +
    `width="${CARD_W}" height="${CARD_H}" shape-rendering="crispEdges">${rects}</svg>`
  );
}

export function cardBackDataUrl(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(cardBackSvg())}`;
}
```
Nota para el implementador: pixel (28,50) cae en la caja del ojo izquierdo (x 28..32, y 49..53) pero fuera de la pupila (x 29..30, y 51..52) y dentro del medallón (`e ≈ 0,28`), por eso el test espera `'w'`.

- [ ] **Step 6: Correr y ver que pasan**

Run: `npx vitest run src/art && npx tsc`
Expected: PASS, `tsc` sin errores. Si el test de "estados distintos" falla, revisar que no se haya copiado dos veces la misma cara.

- [ ] **Step 7: Commit**

```bash
git add src/art
git commit -m "feat(web): mascota Fosfo (5 estados) y dorso de carta en pixel art"
```

---

### Task 4: `CardSkin`, skin `jcanabal`, escala pixel-perfect y script de importación del arte

**En criollo:** las cartas se dibujan siempre a través de una interfaz `CardSkin` (dame la URL de la cara de esta carta, la del dorso y el tamaño nativo), así mañana se puede sumar otro mazo sin tocar nada más. La skin `jcanabal` usa los PNG gratis de jcanabal; no los podemos bajar nosotros (hay que apretar un botón en itch.io), así que esta tarea tiene un **paso para vos** (bajar el zip) y después un script que inspecciona el zip, copia y renombra las 40 cartas a `public/cards/jcanabal/<palo>-<numero>.png`, y falla con un mensaje clarísimo si falta alguna. También dejamos escrito el aviso de licencia del arte y la función que elige la escala entera (1x, 2x, 3x) para que los píxeles nunca queden borrosos ni desborde el ancho de un celular de 360 px.

**Files:**
- Create: `src/skins/types.ts`, `src/skins/jcanabal.ts`, `src/skins/index.ts`, `src/skins/scale.ts`
- Create: `scripts/cards-lib.ts`, `scripts/cards-map.ts`, `scripts/import-cards.ts`
- Create: `public/cards/LICENSE-ART.md`, `public/cards/jcanabal/*.png` (generados)
- Test: `src/skins/skin.test.ts`, `src/skins/scale.test.ts`, `src/skins/import-plan.test.ts`

**Interfaces:**
- Consumes: `Card`, `cardKey`, `allCards`, `SUITS`, `CARD_NUMBERS`, `Suit`, `CardNumber` (Task 2); `cardBackDataUrl`, `CARD_W`, `CARD_H` (Task 3).
- Produces:
  - `interface CardSkin { id: string; name: string; credit: string; native: { w: number; h: number }; faceUrl(card: Card): string; backUrl(): string }`
  - `jcanabalSkin: CardSkin`, `SKINS: Record<string, CardSkin>`, `DEFAULT_SKIN: CardSkin`, `getSkin(id: string): CardSkin` (desconocido → `DEFAULT_SKIN`).
  - `pickScale(availableWidth: number, nativeWidth: number, cardsAcross: number, gap: number, maxScale?: number): number` (entero ≥ 1), `handWidth(nativeWidth: number, scale: number, cardsAcross: number, gap: number): number`.
  - `scripts/cards-lib.ts`: `NATIVE_W = 73`, `NATIVE_H = 113`, `type SourceNamer = (suit: Suit, number: CardNumber) => string`, `interface ImportPlan { copies: {from: string; to: string}[]; missing: string[]; ambiguous: string[] }`, `destName(suit, number): string`, `normalize(p: string): string`, `planImport(files: string[], namer: SourceNamer): ImportPlan`, `formatProblems(plan: ImportPlan): string[]`, `pngSize(buf: Uint8Array): { w: number; h: number } | null`.

- [ ] **Step 1: Escribir los tests de skin y escala (fallan)**

`src/skins/scale.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { handWidth, pickScale } from './scale';

describe('pickScale (3 cartas de 73 px, gap 8)', () => {
  it('a 360 px de pantalla (328 útiles) usa 1x y entra', () => {
    const s = pickScale(328, 73, 3, 8);
    expect(s).toBe(1);
    expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(328);
  });
  it('a 520 px usa 2x y entra', () => {
    const s = pickScale(488, 73, 3, 8);
    expect(s).toBe(2);
    expect(handWidth(73, s, 3, 8)).toBeLessThanOrEqual(488);
  });
  it('nunca baja de 1x aunque el ancho sea ridículo', () => {
    expect(pickScale(100, 73, 3, 8)).toBe(1);
    expect(pickScale(0, 73, 3, 8)).toBe(1);
    expect(pickScale(Number.NaN, 73, 3, 8)).toBe(1);
  });
  it('respeta el máximo y devuelve siempre enteros', () => {
    expect(pickScale(5000, 73, 3, 8)).toBe(3);
    expect(pickScale(5000, 73, 3, 8, 2)).toBe(2);
    for (const w of [320, 360, 414, 480, 600, 768, 1024]) {
      expect(Number.isInteger(pickScale(w - 32, 73, 3, 8))).toBe(true);
    }
  });
});
```

`src/skins/skin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { allCards } from '../table/types';
import { DEFAULT_SKIN, getSkin, jcanabalSkin } from './index';

describe('skin jcanabal', () => {
  it('mapea las 40 cartas a 40 URLs distintas con el formato palo-número.png', () => {
    const urls = allCards().map((c) => jcanabalSkin.faceUrl(c));
    expect(new Set(urls).size).toBe(40);
    for (const u of urls) {
      expect(u).toMatch(/cards\/jcanabal\/(espada|basto|oro|copa)-(1|2|3|4|5|6|7|10|11|12)\.png$/);
    }
  });
  it('un caso concreto', () => {
    expect(jcanabalSkin.faceUrl({ suit: 'oro', number: 7 }).endsWith('cards/jcanabal/oro-7.png')).toBe(true);
  });
  it('tamaño nativo 73x113 y crédito obligatorio', () => {
    expect(jcanabalSkin.native).toEqual({ w: 73, h: 113 });
    expect(jcanabalSkin.credit).toBe('Card art by Jose Angel Canabal');
  });
  it('el dorso es el propio (data URL SVG)', () => {
    expect(jcanabalSkin.backUrl().startsWith('data:image/svg+xml')).toBe(true);
  });
  it('getSkin con id desconocido cae en la skin por defecto', () => {
    expect(getSkin('inexistente')).toBe(DEFAULT_SKIN);
    expect(getSkin('jcanabal')).toBe(jcanabalSkin);
  });
});
```

`src/skins/import-plan.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SUITS, CARD_NUMBERS } from '../table/types';
import { destName, formatProblems, normalize, planImport, pngSize } from '../../scripts/cards-lib';
import type { SourceNamer } from '../../scripts/cards-lib';

const namer: SourceNamer = (suit, n) => `${suit}s/${String(n).padStart(2, '0')}.png`;
const allFiles = SUITS.flatMap((s) => CARD_NUMBERS.map((n) => `Deck/${namer(s, n)}`));

describe('planImport', () => {
  it('con las 40 cartas presentes (aun dentro de una carpeta raíz) arma 40 copias', () => {
    const plan = planImport(allFiles, namer);
    expect(plan.copies).toHaveLength(40);
    expect(plan.missing).toEqual([]);
    expect(plan.copies[0]).toEqual({ from: 'Deck/espadas/01.png', to: 'espada-1.png' });
  });
  it('es insensible a mayúsculas y separadores de Windows', () => {
    const files = allFiles.map((f) => f.toUpperCase().replace(/\//g, '\\'));
    expect(planImport(files, namer).copies).toHaveLength(40);
  });
  it('informa exactamente qué carta falta', () => {
    const plan = planImport(allFiles.filter((f) => !f.endsWith('oros/07.png')), namer);
    expect(plan.copies).toHaveLength(39);
    expect(plan.missing).toEqual(['oro-7.png (esperaba "oros/07.png")']);
    const lines = formatProblems(plan);
    expect(lines.join('\n')).toContain('Faltan 1 de las 40 cartas');
    expect(lines.join('\n')).toContain('oro-7.png');
  });
  it('detecta archivos ambiguos', () => {
    const plan = planImport([...allFiles, 'Otra/espadas/01.png'], namer);
    expect(plan.ambiguous).toHaveLength(1);
    expect(formatProblems(plan).join('\n')).toContain('espada-1.png');
  });
  it('destName y normalize', () => {
    expect(destName('copa', 12)).toBe('copa-12.png');
    expect(normalize('.\\a\\b.png')).toBe('a/b.png');
  });
});

describe('pngSize', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(b.buffer);
    dv.setUint32(16, w);
    dv.setUint32(20, h);
    return b;
  };
  it('lee el ancho y alto del encabezado', () => {
    expect(pngSize(png(73, 113))).toEqual({ w: 73, h: 113 });
  });
  it('devuelve null si no es PNG', () => {
    expect(pngSize(new Uint8Array(30))).toBeNull();
    expect(pngSize(new Uint8Array(3))).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/skins`
Expected: FAIL (imports no resueltos).

- [ ] **Step 3: Implementar skin y escala**

`src/skins/types.ts`:
```ts
import type { Card } from '../table/types';

export interface CardSkin {
  id: string;
  name: string;
  /** Texto de crédito que debe mostrarse en la web. */
  credit: string;
  /** Tamaño nativo en píxeles; el escalado es siempre por múltiplos enteros. */
  native: { w: number; h: number };
  faceUrl(card: Card): string;
  backUrl(): string;
}
```

`src/skins/jcanabal.ts`:
```ts
import { cardBackDataUrl, CARD_H, CARD_W } from '../art/cardBack';
import { cardKey } from '../table/types';
import type { CardSkin } from './types';

export const jcanabalSkin: CardSkin = {
  id: 'jcanabal',
  name: 'Baraja española, pixel art',
  credit: 'Card art by Jose Angel Canabal',
  native: { w: CARD_W, h: CARD_H },
  faceUrl: (card) => `${import.meta.env.BASE_URL}cards/jcanabal/${cardKey(card)}.png`,
  backUrl: () => cardBackDataUrl(),
};
```

`src/skins/index.ts`:
```ts
import { jcanabalSkin } from './jcanabal';
import type { CardSkin } from './types';

export type { CardSkin } from './types';
export { jcanabalSkin } from './jcanabal';

export const SKINS: Record<string, CardSkin> = { [jcanabalSkin.id]: jcanabalSkin };
export const DEFAULT_SKIN: CardSkin = jcanabalSkin;

export function getSkin(id: string): CardSkin {
  return SKINS[id] ?? DEFAULT_SKIN;
}
```

`src/skins/scale.ts`:
```ts
/** Escala entera (>= 1) para que `cardsAcross` cartas entren en `availableWidth`. */
export function pickScale(
  availableWidth: number,
  nativeWidth: number,
  cardsAcross: number,
  gap: number,
  maxScale = 3,
): number {
  if (!Number.isFinite(availableWidth)) return 1;
  const perCard = (availableWidth - gap * (cardsAcross - 1)) / cardsAcross;
  return Math.max(1, Math.min(maxScale, Math.floor(perCard / nativeWidth)));
}

export function handWidth(nativeWidth: number, scale: number, cardsAcross: number, gap: number): number {
  return cardsAcross * nativeWidth * scale + gap * (cardsAcross - 1);
}
```

- [ ] **Step 4: Implementar la librería pura del importador**

`scripts/cards-lib.ts`:
```ts
import { CARD_NUMBERS, SUITS } from '../src/table/types.ts';
import type { CardNumber, Suit } from '../src/table/types.ts';

export const NATIVE_W = 73;
export const NATIVE_H = 113;

export type SourceNamer = (suit: Suit, number: CardNumber) => string;

export interface ImportPlan {
  copies: { from: string; to: string }[];
  missing: string[];
  ambiguous: string[];
}

export const destName = (suit: Suit, number: CardNumber): string => `${suit}-${number}.png`;

export const normalize = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '');

/** Busca, para cada una de las 40 cartas, el archivo del zip que le corresponde (por sufijo de ruta, sin distinguir mayúsculas). */
export function planImport(files: string[], namer: SourceNamer): ImportPlan {
  const norm = files.map((raw) => ({ raw, key: normalize(raw).toLowerCase() }));
  const plan: ImportPlan = { copies: [], missing: [], ambiguous: [] };
  for (const suit of SUITS) {
    for (const number of CARD_NUMBERS) {
      const expected = namer(suit, number);
      const wanted = normalize(expected).toLowerCase();
      const hits = norm.filter((f) => f.key === wanted || f.key.endsWith('/' + wanted));
      const to = destName(suit, number);
      if (hits.length === 0) plan.missing.push(`${to} (esperaba "${expected}")`);
      else if (hits.length > 1) plan.ambiguous.push(`${to}: ${hits.map((h) => h.raw).join(', ')}`);
      else plan.copies.push({ from: hits[0]!.raw, to });
    }
  }
  return plan;
}

export function formatProblems(plan: ImportPlan): string[] {
  const lines: string[] = [];
  if (plan.missing.length > 0) {
    lines.push(`Faltan ${plan.missing.length} de las 40 cartas:`);
    for (const m of plan.missing) lines.push(`  - ${m}`);
    lines.push('Corré `npm run cards:list`, mirá cómo se llaman los archivos y corregí scripts/cards-map.ts.');
  }
  if (plan.ambiguous.length > 0) {
    lines.push(`Hay ${plan.ambiguous.length} cartas con más de un archivo posible:`);
    for (const a of plan.ambiguous) lines.push(`  - ${a}`);
    lines.push('Hacé el patrón de scripts/cards-map.ts más específico (incluí la carpeta).');
  }
  return lines;
}

export function pngSize(buf: Uint8Array): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}
```

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `npx vitest run src/skins && npx tsc`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 6: Escribir el aviso de licencia del arte**

`public/cards/LICENSE-ART.md`:
```markdown
# Licencia del arte de las cartas / Card art license

**Card art by Jose Angel Canabal** — "Spanish Deck – Pixel Art" (edición gratuita, 73×113 px).
Fuente / Source: https://jcanabal.itch.io/spanish-deck-pixel-art

**ES.** Los PNG de `cards/jcanabal/` **no están bajo la licencia MIT** de este repositorio. Se usan según los términos del autor en itch.io: se pueden usar y modificar en cualquier proyecto digital, pero **no se pueden redistribuir como un pack de assets independiente**. Por favor no los extraigas ni los publiques como pack. Si hacés un fork, mantené este crédito, o bajá tu propia copia desde la página del autor.

**EN.** The PNG files in `cards/jcanabal/` are **NOT covered by this repository's MIT license**. They are used under the author's itch.io terms: free to use and modify in any digital project, but **may not be redistributed as a standalone asset pack**. Do not extract or republish them as a pack. If you fork this project, keep this credit, or download your own copy from the author's page.

El dorso de las cartas, la mascota y el fondo son obra original de este proyecto (MIT).
```

- [ ] **Step 7: PASO PARA EL USUARIO — bajar el zip (el agente se detiene acá y le pide esto a Tomás)**

> **Tomás, esto lo tenés que hacer vos (1 minuto, gratis):**
> 1. Abrí https://jcanabal.itch.io/spanish-deck-pixel-art en el navegador.
> 2. Tocá **Download Now**. Cuando te pida plata o donación, tocá el link chiquito **"No thanks, just take me to the downloads"**.
> 3. Bajá el archivo de la **edición gratuita (free)** de 73×113 (un `.zip`).
> 4. Dejalo exactamente en esta ruta (creá la carpeta `art-src` si no existe):
>    - En WSL: `~/projects/truco-cfr/web/art-src/jcanabal-spanish-deck.zip`
>    - Desde Windows: `\\wsl.localhost\Ubuntu\home\tomzv\projects\truco-cfr\web\art-src\jcanabal-spanish-deck.zip`
> 5. Avisale al agente "listo el zip".
>
> La carpeta `art-src/` está en `.gitignore`: el zip no se sube al repo.

Verificar que esté (el agente no sigue si falta):
```bash
ls -l art-src/jcanabal-spanish-deck.zip && (unzip -v >/dev/null || echo "Falta unzip: sudo apt install -y unzip")
```
Expected: lista el archivo, sin mensaje de "Falta unzip".

- [ ] **Step 8: Inspeccionar el zip**

Primero el script CLI (necesita la tabla, pero el modo `--list` no la usa). Crear `scripts/cards-map.ts` provisorio con el esquema por defecto (se ajusta en el Step 10):

`scripts/cards-map.ts`:
```ts
import type { CardNumber, Suit } from '../src/table/types.ts';
import type { SourceNamer } from './cards-lib.ts';

/**
 * TABLA DE MAPEO palo+número -> archivo dentro del zip de jcanabal.
 * Se completa DESPUÉS de inspeccionar el zip con `npm run cards:list`.
 * La ruta se busca por sufijo, así que no hace falta incluir la carpeta raíz del zip.
 */

/** Carpeta (o prefijo) de cada palo en el zip. */
export const SUIT_DIR: Record<Suit, string> = {
  espada: 'Espadas',
  basto: 'Bastos',
  oro: 'Oros',
  copa: 'Copas',
};

/** Nombre de archivo de cada número, SIN la extensión. */
export const NUMBER_FILE: Record<CardNumber, string> = {
  1: '01', 2: '02', 3: '03', 4: '04', 5: '05', 6: '06', 7: '07', 10: '10', 11: '11', 12: '12',
};

export const sourceNamer: SourceNamer = (suit, number) => `${SUIT_DIR[suit]}/${NUMBER_FILE[number]}.png`;
```

`scripts/import-cards.ts`:
```ts
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NATIVE_H, NATIVE_W, formatProblems, planImport, pngSize } from './cards-lib.ts';
import { sourceNamer } from './cards-map.ts';

const ZIP = 'art-src/jcanabal-spanish-deck.zip';
const OUT = 'public/cards/jcanabal';

let tmp: string | undefined;

function fail(msg: string): never {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function main(): void {
  if (!existsSync(ZIP)) {
    fail(`No encuentro ${ZIP}. Bajá el zip gratis de https://jcanabal.itch.io/spanish-deck-pixel-art y dejalo en esa ruta.`);
  }
  tmp = mkdtempSync(join(tmpdir(), 'jcanabal-'));
  try {
    execFileSync('unzip', ['-q', '-o', ZIP, '-d', tmp]);
  } catch {
    fail('Falló `unzip`. ¿Está instalado? Probá: sudo apt install -y unzip');
  }
  const dir = tmp;
  const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile());

  if (process.argv.includes('--list')) {
    for (const f of [...files].sort()) {
      const size = f.toLowerCase().endsWith('.png') ? pngSize(readFileSync(join(dir, f))) : null;
      console.log(`${f}${size ? `   ${size.w}x${size.h}` : ''}`);
    }
    console.log(`\n${files.length} archivos en el zip`);
    rmSync(dir, { recursive: true, force: true });
    return;
  }

  const plan = planImport(files, sourceNamer);
  const problems = formatProblems(plan);
  if (problems.length > 0) fail(problems.join('\n'));

  mkdirSync(OUT, { recursive: true });
  for (const { from, to } of plan.copies) {
    const size = pngSize(readFileSync(join(dir, from)));
    if (!size || size.w !== NATIVE_W || size.h !== NATIVE_H) {
      fail(`${from} mide ${size ? `${size.w}x${size.h}` : 'algo que no es un PNG'}; esperaba ${NATIVE_W}x${NATIVE_H} (¿bajaste la edición gratuita?).`);
    }
    copyFileSync(join(dir, from), join(OUT, to));
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`OK: ${plan.copies.length} cartas copiadas a ${OUT}`);
}

main();
```

Listar el contenido del zip:
```bash
npm run cards:list
```
Expected: una lista de archivos con sus medidas (por ejemplo `... 73x113`). Mirar con atención: carpetas por palo, cómo se numeran (`01.png`, `1.png`, `1_of_swords.png`, secuencial 1..40) y si hay archivos extra (dorso, comodines, hojas de sprites).

- [ ] **Step 9: Armar la tabla de mapeo con lo que se ve**

Compará la salida del Step 8 con `scripts/cards-map.ts` y ajustá **solo** `SUIT_DIR`, `NUMBER_FILE` y, si hace falta, `sourceNamer`:

| Lo que muestra `cards:list` | Qué cambiar en `cards-map.ts` |
|---|---|
| `Espadas/01.png … Oros/12.png` (carpeta por palo, 2 dígitos) | Nada (es el valor por defecto) |
| Carpetas con otro nombre (`swords/`, `Spades/`) | Cambiar los 4 valores de `SUIT_DIR` |
| Números sin cero (`1.png`) | `NUMBER_FILE`: `1: '1', 2: '2', …` |
| Archivos planos con el palo en el nombre (`espadas_01.png`) | `sourceNamer = (suit, n) => \`${SUIT_FILE[suit]}_${NUMBER_FILE[n]}.png\`` con `SUIT_FILE` en lugar de `SUIT_DIR` |
| Numeración corrida 1..40 en orden de palos (`card_01.png` = 1 de espadas…) | `sourceNamer` calcula el índice: `const order = [1,2,3,4,5,6,7,10,11,12]; const i = SUITS_ORDER.indexOf(suit)*10 + order.indexOf(number) + 1;` y devuelve `card_${String(i).padStart(2,'0')}.png` |
| Solo una hoja de sprites (un PNG enorme) | **Parar**: avisarle a Tomás; hace falta un paso extra de recorte que no está en este plan |

Cuando el mapeo esté listo, imprimir la tabla resultante y pegarla como comentario al final de `scripts/cards-map.ts` (40 líneas `espada-1.png <- <archivo del zip>`) para que quede documentado:
```bash
node -e "import('./scripts/cards-map.ts').then(async m => { const {SUITS, CARD_NUMBERS} = await import('./src/table/types.ts'); for (const s of SUITS) for (const n of CARD_NUMBERS) console.log(s+'-'+n+'.png <- '+m.sourceNamer(s,n)); })"
```

- [ ] **Step 10: Importar las cartas**

```bash
npm run cards:import && ls public/cards/jcanabal | wc -l
```
Expected: `OK: 40 cartas copiadas a public/cards/jcanabal` y `40`. Si falla, el mensaje dice exactamente qué carta falta; corregir `cards-map.ts` y repetir. (El fallo por tamaño distinto de 73×113 significa que se bajó otra edición.)

- [ ] **Step 11: Verificar todo y commitear**

Run: `npx vitest run && npx tsc`
Expected: PASS.

```bash
git add src/skins scripts public/cards
git commit -m "feat(web): CardSkin jcanabal, escala pixel-perfect e importador del arte con licencia"
```

---

### Task 5: Lógica pura — fosforitos, movimiento, tilt, partículas, formato, rayos X y textos

**En criollo:** acá van las "cuentas" de la interfaz, escritas como funciones sin React para poder testearlas fácil: cuántos fosforitos dibujar para un puntaje (grupos de 5, 15 malas y 15 buenas, con puntajes raros que no rompen nada), cuándo hay que apagar las animaciones (preferencia del sistema o del usuario), cuánto inclinar una carta según dónde está el dedo, cómo salen disparadas las partículas cuando suman puntos (con un generador pseudoaleatorio fijo para que sea predecible), cómo mostrar porcentajes en criollo (`56,3%`) y cómo ordenar las probabilidades del modo rayos X. También los textos en español de cartas, acciones y estados de ánimo de la mascota. Todo esto es lo más fácil de romper sin darse cuenta, por eso va con tests antes que con pantalla.

**Files:**
- Create: `src/logic/fosforitos.ts`, `src/logic/motion.ts`, `src/logic/format.ts`, `src/logic/xray.ts`, `src/table/labels.ts`
- Test: `src/logic/fosforitos.test.ts`, `src/logic/motion.test.ts`, `src/logic/format.test.ts`, `src/logic/xray.test.ts`, `src/table/labels.test.ts`

**Interfaces:**
- Consumes: `ActionId`, `ACTION_IDS`, `Card`, `Mood`, `MOODS`, `EnvidoCall`, `TrucoCall`, `XRayEntry`, `FIXTURES` (Task 2).
- Produces:
  - `logic/fosforitos.ts`: `MAX_POINTS = 30`, `HALF = 15`, `GROUP_SIZE = 5`, `GROUPS_PER_HALF = 3`, `type GroupFill = 0|1|2|3|4|5`, `interface FosforitoBoard { points: number; malas: GroupFill[]; buenas: GroupFill[] }`, `clampPoints(p: number): number`, `fosforitos(points: number): FosforitoBoard`, `zone(points: number): 'malas'|'buenas'`, `interface StickRect { x: number; y: number; w: number; h: number; kind: 'palo'|'cruz' }`, `groupRects(fill: GroupFill): StickRect[]` (grilla de 12×12).
  - `logic/motion.ts`: `type MotionSetting = 'auto'|'reduced'|'full'`, `resolveMotion(setting: MotionSetting, systemPrefersReduced: boolean): boolean` (true = reducido), `interface MotionPolicy { idle: boolean; tilt: boolean; pop: boolean; burst: boolean; shake: boolean; swirlAnimated: boolean }`, `motionPolicy(reduced: boolean): MotionPolicy`, `interface Rect { left: number; top: number; width: number; height: number }`, `tiltFromPointer(rect: Rect, x: number, y: number, maxDeg?: number): { rx: number; ry: number }`, `mulberry32(seed: number): () => number`, `interface Particle { dx: number; dy: number; rot: number; delay: number; size: number; color: number }`, `burstCount(delta: number): number`, `burstParticles(count: number, seed: number): Particle[]`.
  - `logic/format.ts`: `formatPct(p: number): string` (`58%`, `<1%`), `formatPct1(p: number): string` (`56,3%`), `formatSigned(n: number, digits?: number): string` (`+1,50`).
  - `logic/xray.ts`: `interface XRayRow { action: ActionId; label: string; prob: number; text: string; widthPct: number }`, `xrayRows(entries: readonly XRayEntry[] | undefined): XRayRow[]`.
  - `table/labels.ts`: `cardLabel(c: Card): string`, `ACTION_LABEL: Record<ActionId, string>`, `actionLabel(id: ActionId): string`, `CALL_LABEL: Record<EnvidoCall | TrucoCall, string>`, `MOOD_LINE: Record<Mood, string>`, `moodLine(m: Mood): string`.

- [ ] **Step 1: Tests de fosforitos (fallan)**

`src/logic/fosforitos.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { clampPoints, fosforitos, groupRects, zone } from './fosforitos';

describe('fosforitos (grupos de 5, 15 malas + 15 buenas)', () => {
  const cases: [number, number[], number[]][] = [
    [0, [0, 0, 0], [0, 0, 0]],
    [1, [1, 0, 0], [0, 0, 0]],
    [4, [4, 0, 0], [0, 0, 0]],
    [5, [5, 0, 0], [0, 0, 0]],
    [7, [5, 2, 0], [0, 0, 0]],
    [15, [5, 5, 5], [0, 0, 0]],
    [16, [5, 5, 5], [1, 0, 0]],
    [22, [5, 5, 5], [5, 2, 0]],
    [29, [5, 5, 5], [5, 5, 4]],
    [30, [5, 5, 5], [5, 5, 5]],
  ];
  it.each(cases)('%i puntos', (p, malas, buenas) => {
    const b = fosforitos(p);
    expect(b.malas).toEqual(malas);
    expect(b.buenas).toEqual(buenas);
    expect(b.points).toBe(p);
  });
  it('puntajes raros no rompen nada', () => {
    expect(fosforitos(31).points).toBe(30);
    expect(fosforitos(1000).buenas).toEqual([5, 5, 5]);
    expect(fosforitos(-3).points).toBe(0);
    expect(fosforitos(Number.NaN).points).toBe(0);
    expect(fosforitos(7.9).points).toBe(7);
    expect(clampPoints(Number.POSITIVE_INFINITY)).toBe(30);
  });
  it('la cantidad de palitos dibujados coincide con el puntaje', () => {
    for (let p = 0; p <= 30; p++) {
      const b = fosforitos(p);
      const total = [...b.malas, ...b.buenas].reduce<number>((a, f) => a + f, 0);
      expect(total).toBe(p);
    }
  });
  it('zone: 15 todavía es malas, 16 ya es buenas', () => {
    expect(zone(0)).toBe('malas');
    expect(zone(15)).toBe('malas');
    expect(zone(16)).toBe('buenas');
    expect(zone(30)).toBe('buenas');
  });
});

describe('groupRects', () => {
  it('dibuja un palito por cada fosforito y la cruz solo con el quinto', () => {
    expect(groupRects(0)).toHaveLength(0);
    expect(groupRects(1)).toHaveLength(1);
    expect(groupRects(4)).toHaveLength(4);
    expect(groupRects(4).every((r) => r.kind === 'palo')).toBe(true);
    const five = groupRects(5);
    expect(five.some((r) => r.kind === 'cruz')).toBe(true);
    expect(five).toHaveLength(14);
  });
  it('todo cae dentro de la grilla de 12x12', () => {
    for (const r of groupRects(5)) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(12);
      expect(r.y + r.h).toBeLessThanOrEqual(12);
    }
  });
});
```

- [ ] **Step 2: Tests de movimiento, tilt y partículas (fallan)**

`src/logic/motion.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  burstCount, burstParticles, motionPolicy, mulberry32, resolveMotion, tiltFromPointer,
} from './motion';

describe('resolveMotion (reducción de animaciones)', () => {
  it('auto sigue a la preferencia del sistema', () => {
    expect(resolveMotion('auto', true)).toBe(true);
    expect(resolveMotion('auto', false)).toBe(false);
  });
  it('el usuario puede forzar reducido o completo', () => {
    expect(resolveMotion('reduced', false)).toBe(true);
    expect(resolveMotion('full', true)).toBe(false);
  });
});

describe('motionPolicy', () => {
  it('reducido apaga todo lo que se mueve solo', () => {
    expect(motionPolicy(true)).toEqual({
      idle: false, tilt: false, pop: false, burst: false, shake: false, swirlAnimated: false,
    });
  });
  it('completo enciende todo', () => {
    expect(Object.values(motionPolicy(false)).every(Boolean)).toBe(true);
  });
});

describe('tiltFromPointer', () => {
  const rect = { left: 100, top: 200, width: 73, height: 113 };
  it('en el centro no inclina', () => {
    const t = tiltFromPointer(rect, 100 + 36.5, 200 + 56.5, 12);
    expect(t.rx).toBeCloseTo(0, 5);
    expect(t.ry).toBeCloseTo(0, 5);
  });
  it('en la esquina superior derecha inclina al máximo', () => {
    const t = tiltFromPointer(rect, 173, 200, 12);
    expect(t.ry).toBeCloseTo(12, 5);
    expect(t.rx).toBeCloseTo(12, 5);
  });
  it('fuera del rectángulo se satura y un rect de ancho 0 no da NaN', () => {
    expect(tiltFromPointer(rect, 10_000, 200, 12).ry).toBeCloseTo(12, 5);
    expect(tiltFromPointer({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ rx: 0, ry: 0 });
  });
});

describe('partículas', () => {
  it('burstCount crece con los puntos y se acota', () => {
    expect(burstCount(0)).toBe(0);
    expect(burstCount(-2)).toBe(0);
    expect(burstCount(1)).toBe(10);
    expect(burstCount(2)).toBe(14);
    expect(burstCount(30)).toBe(24);
  });
  it('es determinista por semilla y distinta entre semillas', () => {
    expect(burstParticles(12, 7)).toEqual(burstParticles(12, 7));
    expect(burstParticles(12, 7)).not.toEqual(burstParticles(12, 8));
  });
  it('respeta la cantidad pedida y el radio máximo', () => {
    expect(burstParticles(0, 1)).toEqual([]);
    for (const p of burstParticles(24, 3)) {
      expect(Math.hypot(p.dx, p.dy)).toBeLessThanOrEqual(74);
      expect([4, 6, 8]).toContain(p.size);
      expect(p.color).toBeGreaterThanOrEqual(0);
      expect(p.color).toBeLessThan(4);
    }
  });
  it('mulberry32 devuelve valores en [0,1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 3: Tests de formato, rayos X y textos (fallan)**

`src/logic/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatPct, formatPct1, formatSigned } from './format';

describe('formato en español', () => {
  it('formatPct', () => {
    expect(formatPct(0.58)).toBe('58%');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(1)).toBe('100%');
    expect(formatPct(0.004)).toBe('<1%');
    expect(formatPct(Number.NaN)).toBe('–');
  });
  it('formatPct1 usa coma decimal', () => {
    expect(formatPct1(0.563)).toBe('56,3%');
    expect(formatPct1(0.5)).toBe('50,0%');
  });
  it('formatSigned muestra el signo', () => {
    expect(formatSigned(1.5)).toBe('+1,50');
    expect(formatSigned(-0.4)).toBe('-0,40');
    expect(formatSigned(0)).toBe('0,00');
  });
});
```

`src/logic/xray.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { FIXTURES } from '../table/fixtures';
import { xrayRows } from './xray';

describe('xrayRows', () => {
  it('ordena de mayor a menor probabilidad con etiquetas y porcentajes', () => {
    const rows = xrayRows(FIXTURES.finDeManoRayosX.xray);
    expect(rows.map((r) => r.action)).toEqual(['jugar1', 'truco', 'mazo']);
    expect(rows[0]).toMatchObject({ label: 'Jugar carta 2', text: '58%', widthPct: 58 });
  });
  it('sin datos devuelve lista vacía', () => {
    expect(xrayRows(undefined)).toEqual([]);
    expect(xrayRows([])).toEqual([]);
  });
  it('descarta probabilidad cero y marca <1% con barra mínima visible', () => {
    const rows = xrayRows([
      { action: 'truco', prob: 0.996 },
      { action: 'mazo', prob: 0.004 },
      { action: 'quiero', prob: 0 },
    ]);
    expect(rows.map((r) => r.action)).toEqual(['truco', 'mazo']);
    expect(rows[1]).toMatchObject({ text: '<1%', widthPct: 2 });
  });
  it('desempata por el orden de las acciones del motor y no muta la entrada', () => {
    const input = [
      { action: 'mazo' as const, prob: 0.5 },
      { action: 'envido' as const, prob: 0.5 },
    ];
    expect(xrayRows(input).map((r) => r.action)).toEqual(['envido', 'mazo']);
    expect(input[0]!.action).toBe('mazo');
  });
});
```

`src/table/labels.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ACTION_IDS, MOODS } from './types';
import { ACTION_LABEL, CALL_LABEL, cardLabel, moodLine } from './labels';

describe('textos', () => {
  it('cardLabel', () => {
    expect(cardLabel({ suit: 'espada', number: 1 })).toBe('1 de espadas');
    expect(cardLabel({ suit: 'oro', number: 10 })).toBe('Sota de oros');
    expect(cardLabel({ suit: 'copa', number: 11 })).toBe('Caballo de copas');
    expect(cardLabel({ suit: 'basto', number: 12 })).toBe('Rey de bastos');
  });
  it('todas las acciones tienen etiqueta distinta y no vacía', () => {
    const labels = ACTION_IDS.map((id) => ACTION_LABEL[id]);
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(12);
  });
  it('todos los cantos tienen nombre', () => {
    expect(CALL_LABEL.valeCuatro).toBe('vale cuatro');
    expect(CALL_LABEL.realEnvido).toBe('real envido');
  });
  it('todos los ánimos tienen frase', () => {
    for (const m of MOODS) expect(moodLine(m).length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 4: Correr y ver que fallan**

Run: `npx vitest run src/logic src/table/labels.test.ts`
Expected: FAIL (imports no resueltos).

- [ ] **Step 5: Implementar fosforitos**

`src/logic/fosforitos.ts`:
```ts
export const MAX_POINTS = 30;
export const HALF = 15;
export const GROUP_SIZE = 5;
export const GROUPS_PER_HALF = 3;

export type GroupFill = 0 | 1 | 2 | 3 | 4 | 5;

export interface FosforitoBoard {
  points: number;
  malas: GroupFill[];
  buenas: GroupFill[];
}

/** Entero entre 0 y 30. NaN cuenta como 0. */
export function clampPoints(points: number): number {
  if (Number.isNaN(points)) return 0;
  return Math.max(0, Math.min(MAX_POINTS, Math.trunc(points)));
}

function groups(n: number): GroupFill[] {
  return Array.from({ length: GROUPS_PER_HALF }, (_, i) =>
    Math.max(0, Math.min(GROUP_SIZE, n - i * GROUP_SIZE)) as GroupFill,
  );
}

export function fosforitos(points: number): FosforitoBoard {
  const p = clampPoints(points);
  return { points: p, malas: groups(Math.min(p, HALF)), buenas: groups(Math.max(0, p - HALF)) };
}

export function zone(points: number): 'malas' | 'buenas' {
  return clampPoints(points) > HALF ? 'buenas' : 'malas';
}

export interface StickRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'palo' | 'cruz';
}

/** Rects (grilla 12x12) de un grupo de hasta 5 fosforitos: 4 palos formando un cuadrado y la cruz diagonal. */
export function groupRects(fill: GroupFill): StickRect[] {
  const sticks: StickRect[][] = [
    [{ x: 1, y: 1, w: 10, h: 1, kind: 'palo' }],
    [{ x: 10, y: 1, w: 1, h: 10, kind: 'palo' }],
    [{ x: 1, y: 10, w: 10, h: 1, kind: 'palo' }],
    [{ x: 1, y: 1, w: 1, h: 10, kind: 'palo' }],
    Array.from({ length: 10 }, (_, k): StickRect => ({ x: 1 + k, y: 10 - k, w: 1, h: 1, kind: 'cruz' })),
  ];
  return sticks.slice(0, fill).flat();
}
```

- [ ] **Step 6: Implementar movimiento, tilt y partículas**

`src/logic/motion.ts`:
```ts
export type MotionSetting = 'auto' | 'reduced' | 'full';

/** true = hay que reducir animaciones. */
export function resolveMotion(setting: MotionSetting, systemPrefersReduced: boolean): boolean {
  if (setting === 'reduced') return true;
  if (setting === 'full') return false;
  return systemPrefersReduced;
}

export interface MotionPolicy {
  idle: boolean;
  tilt: boolean;
  pop: boolean;
  burst: boolean;
  shake: boolean;
  swirlAnimated: boolean;
}

export function motionPolicy(reduced: boolean): MotionPolicy {
  const on = !reduced;
  return { idle: on, tilt: on, pop: on, burst: on, shake: on, swirlAnimated: on };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/** Inclinación (grados) de una carta según la posición del puntero dentro de su rectángulo. */
export function tiltFromPointer(rect: Rect, x: number, y: number, maxDeg = 12): { rx: number; ry: number } {
  if (rect.width <= 0 || rect.height <= 0) return { rx: 0, ry: 0 };
  const nx = clamp1(((x - rect.left) / rect.width) * 2 - 1);
  const ny = clamp1(((y - rect.top) / rect.height) * 2 - 1);
  return { rx: -ny * maxDeg + 0, ry: nx * maxDeg + 0 };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Particle {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  size: number;
  color: number;
}

export function burstCount(delta: number): number {
  return delta <= 0 ? 0 : Math.min(24, 6 + 4 * delta);
}

export function burstParticles(count: number, seed: number): Particle[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + rnd() * 0.6;
    const dist = 28 + rnd() * 44;
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      rot: Math.round(rnd() * 360),
      delay: Math.round(rnd() * 80),
      size: 4 + Math.floor(rnd() * 3) * 2,
      color: i % 4,
    };
  });
}
```

- [ ] **Step 7: Implementar formato, rayos X y textos**

`src/logic/format.ts`:
```ts
export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '–';
  if (p > 0 && p < 0.01) return '<1%';
  return `${Math.round(p * 100)}%`;
}

export function formatPct1(p: number): string {
  return `${(p * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatSigned(n: number, digits = 2): string {
  const s = Math.abs(n).toFixed(digits).replace('.', ',');
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}
```

`src/table/labels.ts`:
```ts
import type { ActionId, Card, EnvidoCall, Mood, Suit, TrucoCall } from './types';

const SUIT_PLURAL: Record<Suit, string> = { espada: 'espadas', basto: 'bastos', oro: 'oros', copa: 'copas' };

export function cardLabel(c: Card): string {
  const rank = c.number === 10 ? 'Sota' : c.number === 11 ? 'Caballo' : c.number === 12 ? 'Rey' : String(c.number);
  return `${rank} de ${SUIT_PLURAL[c.suit]}`;
}

export const ACTION_LABEL: Record<ActionId, string> = {
  jugar0: 'Jugar carta 1',
  jugar1: 'Jugar carta 2',
  jugar2: 'Jugar carta 3',
  envido: 'Envido',
  realEnvido: 'Real envido',
  faltaEnvido: 'Falta envido',
  truco: 'Truco',
  retruco: 'Retruco',
  valeCuatro: 'Vale cuatro',
  quiero: 'Quiero',
  noQuiero: 'No quiero',
  mazo: 'Al mazo',
};

export const actionLabel = (id: ActionId): string => ACTION_LABEL[id];

export const CALL_LABEL: Record<EnvidoCall | TrucoCall, string> = {
  envido: 'envido',
  realEnvido: 'real envido',
  faltaEnvido: 'falta envido',
  truco: 'truco',
  retruco: 'retruco',
  valeCuatro: 'vale cuatro',
};

export const MOOD_LINE: Record<Mood, string> = {
  neutral: 'Dale, jugá.',
  farol: 'Tengo una mano bárbara. Seguro.',
  descubierto: 'Uy… me vieron las cartas.',
  gana: '¡Esta mano es mía!',
  pierde: 'Bien jugado. Revancha.',
};

export const moodLine = (m: Mood): string => MOOD_LINE[m];
```

`src/logic/xray.ts`:
```ts
import { ACTION_IDS } from '../table/types';
import type { ActionId, XRayEntry } from '../table/types';
import { actionLabel } from '../table/labels';
import { formatPct } from './format';

export interface XRayRow {
  action: ActionId;
  label: string;
  prob: number;
  text: string;
  widthPct: number;
}

export function xrayRows(entries: readonly XRayEntry[] | undefined): XRayRow[] {
  if (!entries) return [];
  return entries
    .filter((e) => e.prob > 0)
    .slice()
    .sort((a, b) => b.prob - a.prob || ACTION_IDS.indexOf(a.action) - ACTION_IDS.indexOf(b.action))
    .map((e) => ({
      action: e.action,
      label: actionLabel(e.action),
      prob: e.prob,
      text: formatPct(e.prob),
      widthPct: Math.max(2, Math.round(e.prob * 100)),
    }));
}
```

- [ ] **Step 8: Correr y ver que pasan**

Run: `npx vitest run src/logic src/table && npx tsc`
Expected: PASS y `tsc` limpio.

- [ ] **Step 9: Commit**

```bash
git add src/logic src/table/labels.ts src/table/labels.test.ts
git commit -m "feat(web): lógica pura de fosforitos, movimiento, tilt, partículas, formato y rayos X"
```

---

### Task 6: Fondo con shader, filtro CRT, preferencias y estilos base

**En criollo:** el fondo es un remolino animado dibujado por la placa de video del navegador con un programita (fragment shader) de unas 25 líneas, escrito por nosotros. Para que sea liviano lo dibujamos en una imagen chiquita (un cuarto del tamaño de la pantalla) y el navegador la estira sin suavizar, lo que además le da el look pixelado. Si el navegador no soporta WebGL, o se pierde el contexto gráfico, la página no se rompe: cae a un degradé cónico de CSS que gira lento. Sumamos el filtro CRT (líneas de barrido y viñeta) con interruptor, y las preferencias del usuario (CRT y animaciones) guardadas en `localStorage`, pero si el navegador no deja usar `localStorage` (modo privado) todo sigue andando en memoria. También queda el CSS base: paleta, tipografía, botones con esquinas "mordidas" y las reglas que apagan animaciones cuando el usuario lo pide.

**Files:**
- Create: `src/settings.ts`, `src/test/helpers.ts`, `src/fx/useMotionPolicy.ts`, `src/fx/swirl.ts`, `src/fx/SwirlBackground.tsx`, `src/fx/CrtOverlay.tsx`, `src/fx/SettingsToggles.tsx`, `src/styles/base.css`
- Modify: `src/test/setup.ts` (reset entre tests), `src/main.tsx` (importar `base.css`)
- Test: `src/settings.test.ts`, `src/fx/useMotionPolicy.test.tsx`, `src/fx/swirl.test.tsx`, `src/fx/SettingsToggles.test.tsx`

**Interfaces:**
- Consumes: `MotionSetting`, `resolveMotion`, `motionPolicy`, `MotionPolicy` (Task 5).
- Produces:
  - `settings.ts`: `interface Settings { crt: boolean; motion: MotionSetting }`, `parseSettings(raw: string | null): Settings`, `getSettings(): Settings`, `updateSettings(patch: Partial<Settings>): void`, `resetSettings(): void` (solo tests), `useSettings(): Settings`.
  - `fx/useMotionPolicy.ts`: `useMotionPolicy(): MotionPolicy`.
  - `fx/swirl.ts`: `VERT`, `FRAG`, `RENDER_SCALE = 0.25`, `interface SwirlHandle { start(): void; stop(): void; draw(time: number): void; destroy(): void }`, `createSwirl(canvas: HTMLCanvasElement, onLost: () => void): SwirlHandle | null`.
  - Componentes: `SwirlBackground()`, `CrtOverlay({ on }: { on: boolean })`, `SettingsToggles()`.
  - `test/helpers.ts`: `mockMatchMedia(reduced: boolean): void`.
  - Clases CSS globales que usan las tareas siguientes: `.btn` (`--brasa`, `--menta`, `--ghost`), `.panel`, `.sr-only`, variable `--notch`, tokens de color.

- [ ] **Step 1: Tests de preferencias (fallan)**

`src/test/helpers.ts`:
```ts
/** jsdom no trae matchMedia. `reduced` simula prefers-reduced-motion: reduce. */
export function mockMatchMedia(reduced: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
```

`src/settings.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSettings, parseSettings, updateSettings } from './settings';

const DEFAULTS = { crt: false, motion: 'auto' };

describe('parseSettings', () => {
  it('ante basura devuelve los valores por defecto', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{"crt":"si","motion":42}']) {
      expect(parseSettings(raw)).toEqual(DEFAULTS);
    }
  });
  it('lee valores válidos', () => {
    expect(parseSettings('{"crt":true,"motion":"reduced"}')).toEqual({ crt: true, motion: 'reduced' });
  });
});

describe('persistencia', () => {
  afterEach(() => vi.restoreAllMocks());

  it('guarda en localStorage y notifica', () => {
    updateSettings({ crt: true });
    expect(getSettings().crt).toBe(true);
    expect(JSON.parse(localStorage.getItem('truco-cfr.settings.v1')!)).toMatchObject({ crt: true });
  });
  it('si localStorage tira excepción, sigue funcionando en memoria', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => updateSettings({ motion: 'full' })).not.toThrow();
    expect(getSettings().motion).toBe('full');
  });
});
```

`src/fx/useMotionPolicy.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { updateSettings } from '../settings';
import { useMotionPolicy } from './useMotionPolicy';

function Probe() {
  const p = useMotionPolicy();
  return <p data-testid="p">{JSON.stringify(p)}</p>;
}
const policy = () => JSON.parse(screen.getByTestId('p').textContent!);

describe('useMotionPolicy', () => {
  it('sin preferencia del sistema todo se mueve', () => {
    render(<Probe />);
    expect(policy().idle).toBe(true);
  });
  it('con prefers-reduced-motion en auto se apaga todo', () => {
    mockMatchMedia(true);
    render(<Probe />);
    expect(policy()).toMatchObject({ idle: false, shake: false, swirlAnimated: false });
  });
  it('el usuario puede forzar completo o reducido y se actualiza en vivo', () => {
    mockMatchMedia(true);
    render(<Probe />);
    act(() => updateSettings({ motion: 'full' }));
    expect(policy().idle).toBe(true);
    mockMatchMedia(false);
    act(() => updateSettings({ motion: 'reduced' }));
    expect(policy().idle).toBe(false);
  });
});
```

- [ ] **Step 2: Tests del fondo y de los toggles (fallan)**

`src/fx/swirl.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FRAG, createSwirl } from './swirl';
import { SwirlBackground } from './SwirlBackground';

function fakeGl() {
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
    createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, useProgram() {},
    createBuffer: () => ({}), bindBuffer() {}, bufferData() {}, getAttribLocation: () => 0,
    enableVertexAttribArray() {}, vertexAttribPointer() {}, getUniformLocation: () => ({}),
    uniform1f() {}, uniform2f() {}, uniform3f() {}, viewport() {}, drawArrays: vi.fn(),
  };
  return gl as unknown as WebGLRenderingContext & { drawArrays: ReturnType<typeof vi.fn> };
}

describe('shader', () => {
  it('es liviano y no usa texturas', () => {
    expect(FRAG.length).toBeLessThan(2000);
    expect(FRAG).toContain('gl_FragColor');
    expect(FRAG).not.toMatch(/texture2D|sampler2D/);
  });
});

describe('createSwirl', () => {
  it('devuelve null si no hay WebGL', () => {
    expect(createSwirl(document.createElement('canvas'), vi.fn())).toBeNull();
  });
  it('devuelve null si el shader no compila', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => ({
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, createShader: () => null, createProgram: () => ({}),
    })) as never;
    expect(createSwirl(canvas, vi.fn())).toBeNull();
  });
  it('dibuja y avisa cuando se pierde el contexto', () => {
    const canvas = document.createElement('canvas');
    const gl = fakeGl();
    canvas.getContext = (() => gl) as never;
    const onLost = vi.fn();
    const handle = createSwirl(canvas, onLost)!;
    expect(handle).not.toBeNull();
    handle.draw(1);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).toHaveBeenCalledTimes(1);
    handle.destroy();
  });
});

describe('SwirlBackground', () => {
  it('sin WebGL cae al fallback CSS (sin canvas)', () => {
    const { container } = render(<SwirlBackground />);
    const root = container.querySelector('.swirl')!;
    expect(root).toHaveAttribute('data-fallback', 'true');
    expect(root.querySelector('canvas')).toBeNull();
  });
});
```

`src/fx/SettingsToggles.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSettings } from '../settings';
import { CrtOverlay } from './CrtOverlay';
import { SettingsToggles } from './SettingsToggles';

describe('SettingsToggles', () => {
  it('el checkbox CRT actualiza y persiste la preferencia', async () => {
    render(<SettingsToggles />);
    await userEvent.click(screen.getByLabelText('Filtro CRT'));
    expect(getSettings().crt).toBe(true);
    expect(localStorage.getItem('truco-cfr.settings.v1')).toContain('"crt":true');
  });
  it('el selector de animaciones ofrece las tres opciones', async () => {
    render(<SettingsToggles />);
    await userEvent.selectOptions(screen.getByLabelText('Animaciones'), 'reduced');
    expect(getSettings().motion).toBe('reduced');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});

describe('CrtOverlay', () => {
  it('solo se dibuja si está encendido y no captura clicks', () => {
    const { container, rerender } = render(<CrtOverlay on={false} />);
    expect(container.firstChild).toBeNull();
    rerender(<CrtOverlay on />);
    expect(container.firstChild).toHaveClass('crt');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/settings.test.ts src/fx`
Expected: FAIL (imports no resueltos).

- [ ] **Step 4: Implementar preferencias y política de movimiento**

`src/settings.ts`:
```ts
import { useSyncExternalStore } from 'react';
import type { MotionSetting } from './logic/motion';

export interface Settings {
  crt: boolean;
  motion: MotionSetting;
}

const KEY = 'truco-cfr.settings.v1';
const DEFAULTS: Settings = { crt: false, motion: 'auto' };

export function parseSettings(raw: string | null): Settings {
  try {
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw);
    return {
      crt: o.crt === true,
      motion: o.motion === 'reduced' || o.motion === 'full' ? o.motion : 'auto',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

let state: Settings = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getSettings = (): Settings => state;

export function updateSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // modo privado o almacenamiento bloqueado: seguimos en memoria
  }
  emit();
}

/** Solo para tests. */
export function resetSettings(): void {
  state = { ...DEFAULTS };
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
```

`src/fx/useMotionPolicy.ts`:
```ts
import { useSyncExternalStore } from 'react';
import { motionPolicy, resolveMotion } from '../logic/motion';
import type { MotionPolicy } from '../logic/motion';
import { useSettings } from '../settings';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.('change', cb);
  return () => mq.removeEventListener?.('change', cb);
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

export function useMotionPolicy(): MotionPolicy {
  const { motion } = useSettings();
  const system = useSystemReducedMotion();
  return motionPolicy(resolveMotion(motion, system));
}
```

Reemplazar `src/test/setup.ts` por:
```ts
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetSettings } from '../settings';
import { mockMatchMedia } from './helpers';

// jsdom no implementa WebGL: getContext devuelve null limpio, sin ruido en consola.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  mockMatchMedia(false);
  window.localStorage.clear();
  resetSettings();
});
```

- [ ] **Step 5: Implementar el shader y el fondo**

`src/fx/swirl.ts`:
```ts
export const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float r = length(uv);
  float ang = atan(uv.y, uv.x) + 2.4 * r - uTime * 0.22;
  vec2 p = r * 3.0 * vec2(cos(ang), sin(ang));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    p += 0.55 * vec2(sin(p.y * 1.3 + uTime * 0.35 + fi * 1.7), cos(p.x * 1.1 - uTime * 0.30 + fi * 2.3));
  }
  float v = 0.5 + 0.5 * sin(p.x + p.y);
  float w = 0.5 + 0.5 * sin(p.x * 0.8 - p.y * 1.2);
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.75, v));
  col = mix(col, uC, smoothstep(0.55, 0.95, w) * 0.85);
  col = floor(col * 7.0 + 0.5) / 7.0;
  col *= 1.0 - 0.45 * smoothstep(0.3, 1.1, r);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Se dibuja a 1/4 de resolución y el CSS lo estira con image-rendering: pixelated. */
export const RENDER_SCALE = 0.25;

export interface SwirlHandle {
  start(): void;
  stop(): void;
  draw(time: number): void;
  destroy(): void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Devuelve null si WebGL no está disponible o el shader no compila (el llamador usa el fallback CSS). */
export function createSwirl(canvas: HTMLCanvasElement, onLost: () => void): SwirlHandle | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  gl.uniform3f(gl.getUniformLocation(prog, 'uA'), 0.35, 0.07, 0.19); // bordó
  gl.uniform3f(gl.getUniformLocation(prog, 'uB'), 0.11, 0.1, 0.31); // índigo
  gl.uniform3f(gl.getUniformLocation(prog, 'uC'), 0.06, 0.44, 0.42); // verde azulado

  const t0 = performance.now();
  let raf = 0;
  let running = false;

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * RENDER_SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const draw = (t: number) => {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const frame = () => {
    if (!running) return;
    draw((performance.now() - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && running) raf = requestAnimationFrame(frame);
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    handle.stop();
    onLost();
  };

  const handle: SwirlHandle = {
    start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    draw,
    destroy() {
      handle.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
    },
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  return handle;
}
```

`src/fx/SwirlBackground.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { createSwirl } from './swirl';
import { useMotionPolicy } from './useMotionPolicy';

/** Fondo remolino. El CSS (.swirl) ya pinta un degradé cónico: es el fallback y lo que se ve antes del primer frame. */
export function SwirlBackground() {
  const policy = useMotionPolicy();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createSwirl(canvas, () => setFallback(true));
    if (!handle) {
      setFallback(true);
      return;
    }
    const still = () => handle.draw(12);
    if (policy.swirlAnimated) handle.start();
    else {
      still();
      window.addEventListener('resize', still);
    }
    return () => {
      window.removeEventListener('resize', still);
      handle.destroy();
    };
  }, [policy.swirlAnimated]);

  return (
    <div className="swirl" aria-hidden="true" data-fallback={String(fallback)}>
      {fallback ? null : <canvas ref={canvasRef} className="swirl__canvas" />}
    </div>
  );
}
```

`src/fx/CrtOverlay.tsx`:
```tsx
export function CrtOverlay({ on }: { on: boolean }) {
  if (!on) return null;
  return <div className="crt" aria-hidden="true" />;
}
```

`src/fx/SettingsToggles.tsx`:
```tsx
import { updateSettings, useSettings } from '../settings';
import type { MotionSetting } from '../logic/motion';

export function SettingsToggles() {
  const s = useSettings();
  return (
    <div className="settings" role="group" aria-label="Preferencias visuales">
      <label className="settings__item" htmlFor="set-crt">
        <input
          id="set-crt"
          type="checkbox"
          checked={s.crt}
          onChange={(e) => updateSettings({ crt: e.target.checked })}
        />
        <span>Filtro CRT</span>
      </label>
      <div className="settings__item">
        <label htmlFor="set-motion">Animaciones</label>
        <select
          id="set-motion"
          value={s.motion}
          onChange={(e) => updateSettings({ motion: e.target.value as MotionSetting })}
        >
          <option value="auto">Según el sistema</option>
          <option value="reduced">Reducidas</option>
          <option value="full">Completas</option>
        </select>
      </div>
    </div>
  );
}
```
Nota: `<label htmlFor="set-crt">` envuelve el `<input>` y un `<span>`; `getByLabelText('Filtro CRT')` encuentra el checkbox.

- [ ] **Step 6: Estilos base**

`src/styles/base.css`:
```css
:root {
  --tinta: #1b1033;
  --noche: #2b1b52;
  --tiza: #fff6e0;
  --tiza-dim: #cfc4a8;
  --pano: #14573d;
  --pano-oscuro: #0d3d2b;
  --ambar: #f2b134;
  --ambar-oscuro: #c47a1c;
  --brasa: #e0453a;
  --brasa-oscuro: #9c2a22;
  --menta: #38d6c8;
  --violeta: #5b34a8;
  --font-display: 'Pixelify Sans', ui-monospace, monospace;
  --font-body: 'Atkinson Hyperlegible', system-ui, sans-serif;
  /* esquinas "mordidas" de pixel: contorno de 3 px sin las esquinas */
  --notch: 0 -3px 0 0 var(--tinta), 0 3px 0 0 var(--tinta), -3px 0 0 0 var(--tinta), 3px 0 0 0 var(--tinta);
  color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--tinta);
  color: var(--tiza);
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.55;
  overflow-x: clip;
  -webkit-tap-highlight-color: transparent;
}
h1, h2, h3 { font-family: var(--font-display); font-weight: 700; line-height: 1.15; margin: 0 0 0.5em; }
h1 { font-size: 28px; }
h2 { font-size: 22px; }
h3 { font-size: 18px; }
p { margin: 0 0 1em; }
a { color: var(--menta); }
img, svg { image-rendering: pixelated; }
:focus-visible { outline: 3px solid var(--menta); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* botones */
.btn {
  --fondo: var(--ambar);
  --sombra: var(--ambar-oscuro);
  font: 700 18px/1 var(--font-display);
  min-height: 48px;
  min-width: 48px;
  padding: 0 16px;
  margin: 3px;
  border: 0;
  color: var(--tinta);
  background: var(--fondo);
  box-shadow: var(--notch), inset 0 -5px 0 0 var(--sombra);
  cursor: pointer;
  transition: transform 60ms steps(2);
}
.btn:active:not(:disabled) { transform: translateY(2px); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--brasa { --fondo: var(--brasa); --sombra: var(--brasa-oscuro); color: var(--tiza); }
.btn--menta { --fondo: var(--menta); --sombra: #1f9c92; }
.btn--ghost { --fondo: var(--noche); --sombra: var(--tinta); color: var(--tiza); }

.panel {
  background: var(--noche);
  box-shadow: var(--notch);
  margin: 3px;
  padding: 16px;
}

/* fondo remolino: el degradé cónico es el fallback y lo que se ve antes del primer frame */
.swirl { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: #2a0f3d; }
.swirl::before {
  content: '';
  position: absolute;
  inset: -50%;
  background: conic-gradient(from 0deg, #5a1230, #1d1a4f, #0f6f6a, #5a1230);
  animation: swirl-spin 40s linear infinite;
}
.swirl__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
@keyframes swirl-spin { to { transform: rotate(1turn); } }

/* filtro CRT */
.crt {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  background:
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0 2px, rgba(0, 0, 0, 0.22) 2px 3px),
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.45) 100%);
  animation: crt-flicker 6s steps(60) infinite;
}
@keyframes crt-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.94; } }

/* preferencias */
.settings { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; font-size: 15px; }
.settings__item { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.settings select {
  font: inherit;
  color: var(--tiza);
  background: var(--noche);
  border: 2px solid var(--tiza-dim);
  min-height: 44px;
  padding: 0 8px;
}
.settings input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--ambar); }

/* reducción de animaciones: preferencia del sistema (salvo que el usuario fuerce "completas") o elección propia */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion='full']) *,
  :root:not([data-motion='full']) *::before,
  :root:not([data-motion='full']) *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0s !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
:root[data-motion='reduced'] *,
:root[data-motion='reduced'] *::before,
:root[data-motion='reduced'] *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  animation-delay: 0s !important;
  transition-duration: 0.001ms !important;
  scroll-behavior: auto !important;
}
```

Agregar en `src/main.tsx`, después de los imports de fuentes: `import './styles/base.css';`

- [ ] **Step 7: Correr todo**

Run: `npx vitest run && npx tsc`
Expected: PASS y `tsc` limpio.

- [ ] **Step 8: Commit**

```bash
git add src/settings.ts src/settings.test.ts src/fx src/styles src/test src/main.tsx
git commit -m "feat(web): fondo remolino WebGL con fallback CSS, filtro CRT, preferencias y estilos base"
```

---

### Task 7: Cartas vivas, explosión de puntos y temblor

**En criollo:** acá nacen los efectos que le dan vida a las cartas: el componente `PixelCard` dibuja una carta (cara o dorso) siempre a escala entera, la balancea suavecito cuando está en tu mano, la inclina siguiendo el dedo o el mouse, y hace un "pop" cuando aparece en la mesa. `PointsBurst` hace que los puntos "exploten" en partículas cuadradas cuando sumás, y `ShakeRoot` hace temblar toda la pantalla un ratito (se usa en vale cuatro). Todo respeta la política de movimiento de la tarea anterior: con animaciones reducidas la carta queda quieta, no hay partículas (solo el "+2") y no hay temblor. Y si la imagen de una carta no carga (PNG faltante), se muestra su nombre en texto y se sigue pudiendo jugar.

**Files:**
- Create: `src/components/PixelCard.tsx`, `src/components/PixelCard.css`, `src/components/PointsBurst.tsx`, `src/components/ShakeRoot.tsx`, `src/components/fx.css`
- Test: `src/components/PixelCard.test.tsx`, `src/components/PointsBurst.test.tsx`, `src/components/ShakeRoot.test.tsx`

**Interfaces:**
- Consumes: `CardSkin`, `jcanabalSkin` (Task 4); `Card`, `cardLabel` (Tasks 2, 5); `tiltFromPointer`, `burstCount`, `burstParticles` (Task 5); `useMotionPolicy` (Task 6).
- Produces:
  - `PixelCard({ card: Card | null; skin: CardSkin; scale: number; variant: 'hand' | 'table'; index?: number; onPlay?: () => void; disabled?: boolean })` — `card: null` = dorso; con `onPlay` se renderiza como `<button aria-label="Jugar {nombre}">`; sin `onPlay`, como `<div>`.
  - `PointsBurst({ delta: number; burstKey: number })`.
  - `ShakeRoot({ trigger: number; children: ReactNode })` — cuando `trigger` sube, tiembla 450 ms (si la política lo permite); expone `data-shaking="true|false"`.

- [ ] **Step 1: Tests (fallan)**

`src/components/PixelCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jcanabalSkin } from '../skins';
import { mockMatchMedia } from '../test/helpers';
import { PixelCard } from './PixelCard';

const card = { suit: 'espada', number: 1 } as const;

describe('PixelCard', () => {
  it('muestra la cara con alt en español y tamaño entero (escala 2)', () => {
    render(<PixelCard card={card} skin={jcanabalSkin} scale={2} variant="hand" />);
    const img = screen.getByAltText('1 de espadas');
    expect(img).toHaveAttribute('width', '146');
    expect(img).toHaveAttribute('height', '226');
    expect(img.getAttribute('src')).toMatch(/cards\/jcanabal\/espada-1\.png$/);
  });
  it('card null dibuja el dorso', () => {
    render(<PixelCard card={null} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(screen.getByAltText('Carta boca abajo').getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
  it('si la imagen falla, muestra el nombre de la carta y sigue siendo jugable', async () => {
    const onPlay = vi.fn();
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" onPlay={onPlay} />);
    fireEvent.error(screen.getByAltText('1 de espadas'));
    expect(screen.getByText('1 de espadas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Jugar 1 de espadas' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
  it('deshabilitada no dispara onPlay', async () => {
    const onPlay = vi.fn();
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" onPlay={onPlay} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(onPlay).not.toHaveBeenCalled();
  });
  it('sin onPlay no es un botón', () => {
    render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('con animaciones reducidas no se balancea ni hace pop', () => {
    mockMatchMedia(true);
    const { container, rerender } = render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" />);
    expect(container.firstElementChild).toHaveAttribute('data-idle', 'false');
    rerender(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="table" />);
    expect(container.firstElementChild).toHaveAttribute('data-enter', 'false');
  });
  it('con animaciones completas la carta de la mano se balancea', () => {
    const { container } = render(<PixelCard card={card} skin={jcanabalSkin} scale={1} variant="hand" />);
    expect(container.firstElementChild).toHaveAttribute('data-idle', 'true');
  });
});
```

`src/components/PointsBurst.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { PointsBurst } from './PointsBurst';

describe('PointsBurst', () => {
  it('con delta 0 no dibuja nada', () => {
    const { container } = render(<PointsBurst delta={0} burstKey={0} />);
    expect(container.firstChild).toBeNull();
  });
  it('con delta 3 muestra +3 y 18 partículas', () => {
    const { container } = render(<PointsBurst delta={3} burstKey={1} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(container.querySelectorAll('.burst__p')).toHaveLength(18);
  });
  it('con animaciones reducidas queda el +3 pero sin partículas', () => {
    mockMatchMedia(true);
    const { container } = render(<PointsBurst delta={3} burstKey={1} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(container.querySelectorAll('.burst__p')).toHaveLength(0);
  });
});
```

`src/components/ShakeRoot.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { ShakeRoot } from './ShakeRoot';

afterEach(() => vi.useRealTimers());

describe('ShakeRoot', () => {
  it('tiembla 450 ms cuando sube el trigger', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ShakeRoot trigger={0}>x</ShakeRoot>);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute('data-shaking', 'false');
    rerender(<ShakeRoot trigger={1}>x</ShakeRoot>);
    expect(root).toHaveAttribute('data-shaking', 'true');
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(root).toHaveAttribute('data-shaking', 'false');
  });
  it('con animaciones reducidas nunca tiembla', () => {
    mockMatchMedia(true);
    const { container, rerender } = render(<ShakeRoot trigger={0}>x</ShakeRoot>);
    rerender(<ShakeRoot trigger={1}>x</ShakeRoot>);
    expect(container.firstElementChild).toHaveAttribute('data-shaking', 'false');
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/components`
Expected: FAIL (imports no resueltos).

- [ ] **Step 3: Implementar `PixelCard`**

`src/components/PixelCard.tsx`:
```tsx
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import { tiltFromPointer } from '../logic/motion';
import type { CardSkin } from '../skins/types';
import { cardLabel } from '../table/labels';
import type { Card } from '../table/types';
import './PixelCard.css';

interface Props {
  card: Card | null;
  skin: CardSkin;
  /** Entero: 1, 2 o 3. Mantiene el pixel perfecto. */
  scale: number;
  variant: 'hand' | 'table';
  /** Desfasa el balanceo para que las cartas no se muevan al unísono. */
  index?: number;
  onPlay?: () => void;
  disabled?: boolean;
}

export function PixelCard({ card, skin, scale, variant, index = 0, onPlay, disabled }: Props) {
  const policy = useMotionPolicy();
  const faceRef = useRef<HTMLSpanElement>(null);
  const [broken, setBroken] = useState(false);

  const name = card ? cardLabel(card) : 'Carta boca abajo';
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;
  const style = { '--w': `${w}px`, '--h': `${h}px`, '--i': index } as CSSProperties;

  const tilt = (e: PointerEvent) => {
    const el = faceRef.current;
    if (!el || !policy.tilt) return;
    const { rx, ry } = tiltFromPointer(el.getBoundingClientRect(), e.clientX, e.clientY);
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
  };
  const reset = () => {
    faceRef.current?.style.setProperty('--rx', '0deg');
    faceRef.current?.style.setProperty('--ry', '0deg');
  };

  const attrs = {
    className: 'pcard',
    style,
    'data-variant': variant,
    'data-idle': String(policy.idle && variant === 'hand'),
    'data-enter': String(policy.pop && variant === 'table'),
    onPointerDown: tilt,
    onPointerMove: tilt,
    onPointerLeave: reset,
    onPointerUp: reset,
  };

  const face = (
    <span className="pcard__face" ref={faceRef}>
      {broken && card ? (
        <span className="pcard__fallback">{name}</span>
      ) : (
        <img
          src={card ? skin.faceUrl(card) : skin.backUrl()}
          alt={name}
          width={w}
          height={h}
          draggable={false}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );

  if (onPlay) {
    return (
      <button type="button" {...attrs} aria-label={`Jugar ${name}`} disabled={disabled} onClick={onPlay}>
        {face}
      </button>
    );
  }
  return <div {...attrs}>{face}</div>;
}
```

`src/components/PixelCard.css`:
```css
.pcard {
  position: relative;
  display: block;
  flex: none;
  width: var(--w);
  height: var(--h);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  touch-action: manipulation;
}
button.pcard { cursor: pointer; }
button.pcard:disabled { cursor: not-allowed; filter: brightness(0.7) saturate(0.6); }
.pcard__face {
  display: block;
  width: 100%;
  height: 100%;
  transform: perspective(500px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 80ms linear;
  filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
}
.pcard img { display: block; image-rendering: pixelated; user-select: none; }
.pcard__fallback {
  display: grid;
  place-items: center;
  width: var(--w);
  height: var(--h);
  padding: 4px;
  background: var(--tiza);
  color: var(--tinta);
  font: 700 14px/1.1 var(--font-display);
  text-align: center;
  box-shadow: var(--notch);
}

.pcard[data-variant='hand'][data-idle='true'] {
  animation: pcard-sway 4.2s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * -1.1s);
}
.pcard[data-variant='table'][data-enter='true'] {
  animation: pcard-pop 0.36s steps(6, end) both;
}
@keyframes pcard-sway {
  0%, 100% { transform: translateY(0) rotate(-1.2deg); }
  50% { transform: translateY(-4px) rotate(1.2deg); }
}
@keyframes pcard-pop {
  0% { transform: translateY(40px) scale(0.8); }
  60% { transform: translateY(-6px) scale(1.08); }
  100% { transform: none; }
}
```

- [ ] **Step 4: Implementar `PointsBurst` y `ShakeRoot`**

`src/components/PointsBurst.tsx`:
```tsx
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import { burstCount, burstParticles } from '../logic/motion';
import './fx.css';

const COLORS = ['var(--ambar)', 'var(--brasa)', 'var(--menta)', 'var(--tiza)'];

/** `burstKey` cambia en cada suma para reiniciar la animación y la semilla. */
export function PointsBurst({ delta, burstKey }: { delta: number; burstKey: number }) {
  const policy = useMotionPolicy();
  const particles = useMemo(
    () => (policy.burst ? burstParticles(burstCount(delta), burstKey + 1) : []),
    [delta, burstKey, policy.burst],
  );
  if (delta <= 0) return null;
  return (
    <span className="burst" key={burstKey} role="status">
      <span className="burst__label">+{delta}</span>
      {particles.map((p, i) => (
        <span
          key={i}
          className="burst__p"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--d': `${p.delay}ms`,
              '--s': `${p.size}px`,
              '--c': COLORS[p.color],
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
```

`src/components/ShakeRoot.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import './fx.css';

export function ShakeRoot({ trigger, children }: { trigger: number; children: ReactNode }) {
  const policy = useMotionPolicy();
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (trigger <= 0 || !policy.shake) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [trigger, policy.shake]);

  return (
    <div className="shake-root" data-shaking={String(shaking)}>
      {children}
    </div>
  );
}
```

`src/components/fx.css`:
```css
.burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; z-index: 5; }
.burst__label {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translateX(-50%);
  font: 700 22px/1 var(--font-display);
  color: var(--ambar);
  text-shadow: 2px 2px 0 var(--tinta);
  white-space: nowrap;
  animation: burst-label 0.9s steps(9, end) forwards;
}
.burst__p {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--s);
  height: var(--s);
  background: var(--c);
  animation: burst-fly 0.7s steps(8, end) forwards;
  animation-delay: var(--d);
}
@keyframes burst-fly {
  from { transform: translate(0, 0) rotate(0); opacity: 1; }
  to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
}
@keyframes burst-label {
  from { transform: translate(-50%, 0); opacity: 1; }
  to { transform: translate(-50%, -28px); opacity: 0; }
}

.shake-root[data-shaking='true'] { animation: shake 0.45s steps(9, end); }
@keyframes shake {
  0% { transform: translate(0, 0); }
  11% { transform: translate(-6px, 3px); }
  22% { transform: translate(5px, -4px); }
  33% { transform: translate(-5px, -3px); }
  44% { transform: translate(6px, 4px); }
  55% { transform: translate(-4px, 2px); }
  66% { transform: translate(3px, -2px); }
  77% { transform: translate(-2px, 2px); }
  100% { transform: translate(0, 0); }
}
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run src/components && npx tsc`
Expected: PASS y `tsc` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/components
git commit -m "feat(web): PixelCard con balanceo/tilt/pop, PointsBurst y ShakeRoot"
```

---

### Task 8: La mesa — marcador, botonera contextual, rayos X y layout mobile-first

**En criollo:** ahora armamos la mesa completa a partir de un `TableView`. Las piezas: el **marcador** a 30 con fosforitos dibujados en pixel (grupos de 5; se ve cuántas malas y buenas llevás) y números que explotan cuando sumás; la **botonera contextual**, que solo ofrece lo que se puede hacer (si el bot cantó truco aparecen "Quiero / No quiero / Quiero retruco"; si el bot está pensando no aparece nada y se avisa); el **panel de rayos X** con las probabilidades del bot ordenadas; y la **mesa** (paño verde) con la mascota arriba, las bazas en el medio, tus cartas abajo y los botones al alcance del pulgar. Es mobile-first: a 360 px las cartas van a escala 1x y todo entra sin scroll horizontal; en pantallas más anchas las cartas crecen a 2x. Si le pasás `readOnly` (sin `onAction`) la mesa sirve para repeticiones.

**Files:**
- Create: `src/table/status.ts`, `src/table/actions.ts`, `src/hooks/useElementWidth.ts`
- Create: `src/components/Scoreboard.tsx`, `src/components/ActionBar.tsx`, `src/components/XRayPanel.tsx`, `src/components/Mesa.tsx`, `src/components/Mesa.css`
- Test: `src/table/status.test.ts`, `src/table/actions.test.ts`, `src/components/Scoreboard.test.tsx`, `src/components/ActionBar.test.tsx`, `src/components/XRayPanel.test.tsx`, `src/components/Mesa.test.tsx`

**Interfaces:**
- Consumes: todo lo de Tasks 2–7 (`TableView`, `FIXTURES`, `fosforitos`, `groupRects`, `xrayRows`, `labels`, `PixelCard`, `PointsBurst`, `ShakeRoot`, `Mascot`, `pickScale`, `CardSkin`).
- Produces:
  - `table/status.ts`: `interface StatusLine { key: string; text: string }`, `describeStatus(v: TableView): StatusLine[]`, `isValeCuatroMoment(v: TableView): boolean`.
  - `table/actions.ts`: `interface ActionButton { id: ActionId; label: string; tone: 'respuesta'|'envido'|'truco'|'mazo' }`, `interface ActionLayout { cartas: ActionId[]; respuesta: ActionButton[]; envido: ActionButton[]; truco: ActionButton[]; mazo: ActionButton[] }`, `layoutActions(actions: readonly ActionId[], pendingTruco: boolean): ActionLayout`.
  - `hooks/useElementWidth.ts`: `useElementWidth<T extends HTMLElement>(fallback?: number): [number, RefObject<T | null>]`.
  - `Scoreboard({ score: readonly [number, number]; mano: Seat })`, `ActionBar({ view: TableView; onAction: (a: ActionId) => void })`, `XRayPanel({ entries?: XRayEntry[] })`, `Mesa({ view: TableView; skin: CardSkin; onAction?: (a: ActionId) => void; xrayOn?: boolean })`.

- [ ] **Step 1: Tests de estado y layout de acciones (fallan)**

`src/table/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures';
import { describeStatus, isValeCuatroMoment } from './status';
import type { TableView } from './types';

const texts = (v: TableView) => describeStatus(v).map((l) => l.text);

describe('describeStatus', () => {
  it('inicio de mano', () => {
    expect(texts(FIXTURES.inicioDeMano)).toEqual(['Sos mano', 'Truco sin cantar: la mano vale 1']);
  });
  it('envido pendiente cantado por el bot', () => {
    expect(texts(FIXTURES.envidoPendiente)).toContain('El bot cantó envido. Respondé.');
  });
  it('truco pendiente cantado por el bot', () => {
    const t = texts(FIXTURES.trucoPendiente);
    expect(t).toContain('El bot es mano');
    expect(t).toContain('El bot cantó truco. Respondé.');
  });
  it('canto propio pendiente', () => {
    const v: TableView = {
      ...FIXTURES.inicioDeMano,
      truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'yo' } },
    };
    expect(texts(v)).toContain('Cantaste truco. El bot está pensando.');
  });
  it('truco aceptado y tantos revelados (uno dijo "son buenas")', () => {
    const v: TableView = {
      ...FIXTURES.inicioDeMano,
      truco: { acceptedLevel: 3, pending: null },
      envido: {
        calls: [{ call: 'envido', by: 'yo' }, { call: 'realEnvido', by: 'bot' }],
        pending: null,
        reveal: { yo: 29, bot: null },
      },
    };
    const t = texts(v);
    expect(t).toContain('Truco aceptado: la mano vale 3');
    expect(t).toContain('Envido cantado: envido y real envido');
    expect(t).toContain('Tantos. Vos: 29. Bot: son buenas.');
  });
});

describe('isValeCuatroMoment', () => {
  it('es verdadero con vale cuatro pendiente o aceptado', () => {
    const base = FIXTURES.trucoPendiente;
    expect(isValeCuatroMoment(base)).toBe(false);
    expect(isValeCuatroMoment({ ...base, truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } } })).toBe(true);
    expect(isValeCuatroMoment({ ...base, truco: { acceptedLevel: 4, pending: null } })).toBe(true);
  });
});
```

`src/table/actions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { layoutActions } from './actions';
import { FIXTURES } from './fixtures';

const ids = (l: { id: string }[]) => l.map((b) => b.id);

describe('layoutActions', () => {
  it('inicio de mano: cartas, envidos, truco y mazo; ninguna respuesta', () => {
    const l = layoutActions(FIXTURES.inicioDeMano.actions, false);
    expect(l.cartas).toEqual(['jugar0', 'jugar1', 'jugar2']);
    expect(l.respuesta).toEqual([]);
    expect(ids(l.envido)).toEqual(['envido', 'realEnvido', 'faltaEnvido']);
    expect(ids(l.truco)).toEqual(['truco']);
    expect(ids(l.mazo)).toEqual(['mazo']);
  });
  it('truco pendiente: responder y subir con la etiqueta "Quiero retruco"', () => {
    const l = layoutActions(FIXTURES.trucoPendiente.actions, true);
    expect(ids(l.respuesta)).toEqual(['quiero', 'noQuiero']);
    expect(l.truco).toEqual([{ id: 'retruco', label: 'Quiero retruco', tone: 'truco' }]);
  });
  it('sin canto pendiente el retruco se llama simplemente Retruco', () => {
    expect(layoutActions(['retruco', 'valeCuatro'], false).truco.map((b) => b.label)).toEqual(['Retruco', 'Vale cuatro']);
    expect(layoutActions(['valeCuatro'], true).truco.map((b) => b.label)).toEqual(['Quiero vale cuatro']);
  });
  it('turno del bot: todo vacío', () => {
    const l = layoutActions([], false);
    expect(l).toEqual({ cartas: [], respuesta: [], envido: [], truco: [], mazo: [] });
  });
});
```

- [ ] **Step 2: Tests de componentes (fallan)**

`src/components/Scoreboard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Scoreboard } from './Scoreboard';

const fills = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('[data-fill]')).map((n) => n.getAttribute('data-fill'));

describe('Scoreboard', () => {
  it('dibuja 12 grupos (2 jugadores x 2 mitades x 3) y expone el puntaje accesible', () => {
    const { container } = render(<Scoreboard score={[16, 3]} mano="yo" />);
    expect(container.querySelectorAll('[data-fill]')).toHaveLength(12);
    const yo = screen.getByRole('group', { name: 'Vos: 16 puntos' });
    expect(fills(yo)).toEqual(['5', '5', '5', '1', '0', '0']);
    const bot = screen.getByRole('group', { name: 'Bot: 3 puntos' });
    expect(fills(bot)).toEqual(['3', '0', '0', '0', '0', '0']);
  });
  it('marca quién es mano', () => {
    render(<Scoreboard score={[0, 0]} mano="bot" />);
    expect(within(screen.getByRole('group', { name: 'Bot: 0 puntos' })).getByText('(mano)')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Vos: 0 puntos' })).queryByText('(mano)')).toBeNull();
  });
  it('puntajes fuera de rango se acotan en pantalla', () => {
    render(<Scoreboard score={[99, -4]} mano="yo" />);
    expect(screen.getByRole('group', { name: 'Vos: 30 puntos' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bot: 0 puntos' })).toBeInTheDocument();
  });
  it('explota con +N cuando sube el puntaje, pero no al montar', () => {
    const { rerender } = render(<Scoreboard score={[1, 0]} mano="yo" />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
    rerender(<Scoreboard score={[3, 0]} mano="yo" />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
```

`src/components/ActionBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('inicio de mano: ofrece cantos y dispara la acción', async () => {
    const onAction = vi.fn();
    render(<ActionBar view={FIXTURES.inicioDeMano} onAction={onAction} />);
    for (const name of ['Envido', 'Real envido', 'Falta envido', 'Truco', 'Al mazo']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Quiero' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Truco' }));
    expect(onAction).toHaveBeenCalledWith('truco');
  });
  it('truco pendiente: Quiero, No quiero y Quiero retruco', () => {
    render(<ActionBar view={FIXTURES.trucoPendiente} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quiero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No quiero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quiero retruco' })).toBeInTheDocument();
  });
  it('turno del bot (sin acciones): avisa y no ofrece botones', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, actions: [] };
    render(<ActionBar view={v} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('El bot está pensando…');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('solo cartas disponibles: pide tocar una carta', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, actions: ['jugar0', 'jugar1'] };
    render(<ActionBar view={v} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu turno: tocá una carta para jugarla.');
  });
  it('fin de mano', () => {
    render(<ActionBar view={FIXTURES.finDeManoRayosX} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Terminó la mano.');
  });
});
```

`src/components/XRayPanel.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FIXTURES } from '../table/fixtures';
import { XRayPanel } from './XRayPanel';

describe('XRayPanel', () => {
  it('lista las probabilidades ordenadas', () => {
    render(<XRayPanel entries={FIXTURES.finDeManoRayosX.xray} />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Jugar carta 2');
    expect(items[0]).toContain('58%');
    expect(items[1]).toContain('Truco');
    expect(items).toHaveLength(3);
  });
  it('sin datos explica por qué está vacío', () => {
    render(<XRayPanel entries={undefined} />);
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
```

`src/components/Mesa.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jcanabalSkin } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { Mesa } from './Mesa';

describe('Mesa', () => {
  it.each(FIXTURE_NAMES)('renderiza el fixture %s sin romperse', (name) => {
    render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /mascota del bot/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /^Vos: \d+ puntos$/ })).toBeInTheDocument();
  });
  it('tocar una carta de la mano juega esa carta', async () => {
    const onAction = vi.fn();
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(onAction).toHaveBeenCalledWith('jugar1');
  });
  it('si no es mi turno las cartas están deshabilitadas', () => {
    render(<Mesa view={{ ...FIXTURES.inicioDeMano, actions: [] }} skin={jcanabalSkin} onAction={() => {}} />);
    for (const b of screen.getAllByRole('button', { name: /^Jugar / })) expect(b).toBeDisabled();
    expect(screen.getByRole('status', { name: '' })).toBeDefined();
  });
  it('las cartas ya jugadas no se ofrecen y se muestran en la baza', () => {
    render(<Mesa view={FIXTURES.trucoPendiente} skin={jcanabalSkin} onAction={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Jugar 1 de espadas' })).toBeNull();
    expect(screen.getAllByAltText('1 de espadas').length).toBeGreaterThan(0);
  });
  it('sin onAction es solo lectura: no hay botonera', () => {
    render(<Mesa view={FIXTURES.inicioDeMano} skin={jcanabalSkin} />);
    expect(screen.queryByRole('group', { name: 'Acciones' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('fin de mano con rayos X: muestra las cartas del bot y las probabilidades', () => {
    render(<Mesa view={FIXTURES.finDeManoRayosX} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getAllByAltText('6 de oros').length).toBeGreaterThan(1); // en la baza y en la mano revelada
    expect(screen.getByText('58%')).toBeInTheDocument();
  });
  it('tiembla cuando aparece vale cuatro (no al montar)', () => {
    const retruco: TableView = {
      ...FIXTURES.trucoPendiente,
      truco: { acceptedLevel: 2, pending: { call: 'retruco', by: 'bot' } },
    };
    const vale: TableView = {
      ...FIXTURES.trucoPendiente,
      truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } },
    };
    const { container, rerender } = render(<Mesa view={retruco} skin={jcanabalSkin} onAction={() => {}} />);
    const root = container.querySelector('.shake-root')!;
    expect(root).toHaveAttribute('data-shaking', 'false');
    rerender(<Mesa view={vale} skin={jcanabalSkin} onAction={() => {}} />);
    expect(root).toHaveAttribute('data-shaking', 'true');
  });
});
```
Nota: en el test "si no es mi turno" la última línea `getByRole('status', { name: '' })` es tolerante; si hay más de un `role=status` (burbuja de la mascota y botonera) usar `getAllByRole('status').length >= 1`. Reemplazarla por `expect(screen.getAllByRole('status').length).toBeGreaterThan(0);` al implementar.

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/table src/components`
Expected: FAIL (imports no resueltos).

- [ ] **Step 4: Implementar estado y layout de acciones**

`src/table/status.ts`:
```ts
import { CALL_LABEL } from './labels';
import type { TableView } from './types';

export interface StatusLine {
  key: string;
  text: string;
}

const tantos = (n: number | null): string => (n === null ? 'son buenas' : String(n));

export function describeStatus(v: TableView): StatusLine[] {
  const lines: StatusLine[] = [{ key: 'mano', text: v.mano === 'yo' ? 'Sos mano' : 'El bot es mano' }];

  const tp = v.truco.pending;
  if (tp) {
    lines.push({
      key: 'truco',
      text: tp.by === 'bot'
        ? `El bot cantó ${CALL_LABEL[tp.call]}. Respondé.`
        : `Cantaste ${CALL_LABEL[tp.call]}. El bot está pensando.`,
    });
  } else if (v.truco.acceptedLevel > 1) {
    lines.push({ key: 'truco', text: `Truco aceptado: la mano vale ${v.truco.acceptedLevel}` });
  } else {
    lines.push({ key: 'truco', text: 'Truco sin cantar: la mano vale 1' });
  }

  const e = v.envido;
  if (e.pending) {
    const last = e.calls[e.calls.length - 1];
    if (!last) lines.push({ key: 'envido', text: 'Hay un envido pendiente.' });
    else {
      lines.push({
        key: 'envido',
        text: e.pending.by === 'bot'
          ? `El bot cantó ${CALL_LABEL[last.call]}. Respondé.`
          : `Cantaste ${CALL_LABEL[last.call]}. El bot está pensando.`,
      });
    }
  } else if (e.calls.length > 0) {
    lines.push({ key: 'envido', text: `Envido cantado: ${e.calls.map((c) => CALL_LABEL[c.call]).join(' y ')}` });
  }

  if (e.reveal && (e.reveal.yo !== null || e.reveal.bot !== null)) {
    lines.push({ key: 'tantos', text: `Tantos. Vos: ${tantos(e.reveal.yo)}. Bot: ${tantos(e.reveal.bot)}.` });
  }
  return lines;
}

export function isValeCuatroMoment(v: TableView): boolean {
  return v.truco.pending?.call === 'valeCuatro' || v.truco.acceptedLevel === 4;
}
```

`src/table/actions.ts`:
```ts
import { ACTION_IDS, PLAY_ACTIONS } from './types';
import type { ActionId } from './types';
import { actionLabel } from './labels';

export interface ActionButton {
  id: ActionId;
  label: string;
  tone: 'respuesta' | 'envido' | 'truco' | 'mazo';
}

export interface ActionLayout {
  cartas: ActionId[];
  respuesta: ActionButton[];
  envido: ActionButton[];
  truco: ActionButton[];
  mazo: ActionButton[];
}

const TONE: Partial<Record<ActionId, ActionButton['tone']>> = {
  envido: 'envido', realEnvido: 'envido', faltaEnvido: 'envido',
  truco: 'truco', retruco: 'truco', valeCuatro: 'truco',
  quiero: 'respuesta', noQuiero: 'respuesta',
  mazo: 'mazo',
};

/** Con un truco pendiente, subir el canto es "aceptar y subir": "Quiero retruco". */
function labelFor(id: ActionId, pendingTruco: boolean): string {
  if (pendingTruco && id === 'retruco') return 'Quiero retruco';
  if (pendingTruco && id === 'valeCuatro') return 'Quiero vale cuatro';
  return actionLabel(id);
}

export function layoutActions(actions: readonly ActionId[], pendingTruco: boolean): ActionLayout {
  const layout: ActionLayout = { cartas: [], respuesta: [], envido: [], truco: [], mazo: [] };
  for (const id of ACTION_IDS) {
    if (!actions.includes(id)) continue;
    if ((PLAY_ACTIONS as readonly string[]).includes(id)) {
      layout.cartas.push(id);
      continue;
    }
    const tone = TONE[id]!;
    layout[tone].push({ id, label: labelFor(id, pendingTruco), tone });
  }
  return layout;
}
```

`src/hooks/useElementWidth.ts`:
```ts
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Ancho en px del elemento (actualizado con ResizeObserver). `fallback` se usa en SSR/jsdom. */
export function useElementWidth<T extends HTMLElement>(fallback = 360): [number, RefObject<T | null>] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [width, ref];
}
```

- [ ] **Step 5: Implementar Scoreboard, ActionBar y XRayPanel**

`src/components/Scoreboard.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { groupRects, fosforitos } from '../logic/fosforitos';
import type { GroupFill } from '../logic/fosforitos';
import type { Seat } from '../table/types';
import { PointsBurst } from './PointsBurst';

interface Fx {
  delta: number;
  key: number;
}

function useScoreFx(score: readonly [number, number]): { yo: Fx; bot: Fx } {
  const prev = useRef(score);
  const [fx, setFx] = useState({ yo: { delta: 0, key: 0 }, bot: { delta: 0, key: 0 } });
  useEffect(() => {
    const [py, pb] = prev.current;
    const [y, b] = score;
    if (y > py) setFx((f) => ({ ...f, yo: { delta: y - py, key: f.yo.key + 1 } }));
    if (b > pb) setFx((f) => ({ ...f, bot: { delta: b - pb, key: f.bot.key + 1 } }));
    prev.current = score;
  }, [score[0], score[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return fx;
}

function Group({ fill }: { fill: GroupFill }) {
  return (
    <svg className="fosforito" data-fill={fill} viewBox="0 0 12 12" width="24" height="24" shapeRendering="crispEdges" aria-hidden="true">
      {groupRects(fill).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.kind === 'cruz' ? 'var(--ambar)' : 'var(--tiza)'} />
      ))}
    </svg>
  );
}

function Row({ who, points, isMano, fx }: { who: string; points: number; isMano: boolean; fx: Fx }) {
  const b = fosforitos(points);
  return (
    <div className="score__row" role="group" aria-label={`${who}: ${b.points} puntos`}>
      <span className="score__name">
        {who}
        {isMano ? <small> (mano)</small> : null}
      </span>
      <span className="score__half">{b.malas.map((f, i) => <Group key={i} fill={f} />)}</span>
      <span className="score__half">{b.buenas.map((f, i) => <Group key={i} fill={f} />)}</span>
      <span className="score__num">
        {b.points}
        <PointsBurst delta={fx.delta} burstKey={fx.key} />
      </span>
    </div>
  );
}

export function Scoreboard({ score, mano }: { score: readonly [number, number]; mano: Seat }) {
  const fx = useScoreFx(score);
  return (
    <section className="score panel" aria-label="Marcador">
      <div className="score__legend" aria-hidden="true">
        <span />
        <span>Malas</span>
        <span>Buenas</span>
        <span />
      </div>
      <Row who="Vos" points={score[0]} isMano={mano === 'yo'} fx={fx.yo} />
      <Row who="Bot" points={score[1]} isMano={mano === 'bot'} fx={fx.bot} />
    </section>
  );
}
```
El test busca `getByText('(mano)')`: el `<small> (mano)</small>` tiene un espacio inicial; Testing Library normaliza espacios, así que coincide.

`src/components/ActionBar.tsx`:
```tsx
import { layoutActions } from '../table/actions';
import type { ActionButton } from '../table/actions';
import type { ActionId, TableView } from '../table/types';

function Row({ buttons, onAction }: { buttons: ActionButton[]; onAction: (a: ActionId) => void }) {
  if (buttons.length === 0) return null;
  return (
    <div className="actionbar__row">
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`btn${b.tone === 'respuesta' ? ' btn--menta' : b.tone === 'mazo' ? ' btn--ghost' : b.id === 'valeCuatro' ? ' btn--brasa' : ''}`}
          onClick={() => onAction(b.id)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function ActionBar({ view, onAction }: { view: TableView; onAction: (a: ActionId) => void }) {
  const l = layoutActions(view.actions, view.truco.pending !== null);
  const hasButtons = l.respuesta.length + l.envido.length + l.truco.length + l.mazo.length > 0;

  if (!hasButtons) {
    const text =
      view.phase === 'finDeMano'
        ? 'Terminó la mano.'
        : l.cartas.length > 0
          ? 'Tu turno: tocá una carta para jugarla.'
          : 'El bot está pensando…';
    return (
      <p className="actionbar actionbar--wait" role="status">
        {text}
      </p>
    );
  }
  return (
    <div className="actionbar" role="group" aria-label="Acciones">
      <Row buttons={l.respuesta} onAction={onAction} />
      <Row buttons={l.envido} onAction={onAction} />
      <Row buttons={l.truco} onAction={onAction} />
      <Row buttons={l.mazo} onAction={onAction} />
    </div>
  );
}
```

`src/components/XRayPanel.tsx`:
```tsx
import { xrayRows } from '../logic/xray';
import type { XRayEntry } from '../table/types';

export function XRayPanel({ entries }: { entries?: XRayEntry[] }) {
  const rows = xrayRows(entries);
  return (
    <section className="xray panel" aria-label="Rayos X del bot">
      <h2>Rayos X</h2>
      {rows.length === 0 ? (
        <p>Todavía no hay datos: el bot no decidió nada en esta mano.</p>
      ) : (
        <>
          <p className="xray__hint">Así de probable era cada jugada del bot en su última decisión.</p>
          <ul className="xray__list">
            {rows.map((r) => (
              <li key={r.action}>
                <span className="xray__label">{r.label}</span>
                <span className="xray__bar" aria-hidden="true">
                  <span style={{ width: `${r.widthPct}%` }} />
                </span>
                <span className="xray__pct">{r.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Implementar la Mesa y sus estilos**

`src/components/Mesa.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Mascot } from '../art/Mascot';
import { useElementWidth } from '../hooks/useElementWidth';
import { pickScale } from '../skins/scale';
import type { CardSkin } from '../skins/types';
import { moodLine } from '../table/labels';
import { describeStatus, isValeCuatroMoment } from '../table/status';
import { PLAY_ACTIONS } from '../table/types';
import type { ActionId, TableView, TrickView } from '../table/types';
import { ActionBar } from './ActionBar';
import { PixelCard } from './PixelCard';
import { Scoreboard } from './Scoreboard';
import { ShakeRoot } from './ShakeRoot';
import { XRayPanel } from './XRayPanel';
import './Mesa.css';

interface MesaProps {
  view: TableView;
  skin: CardSkin;
  /** Sin `onAction` la mesa es de solo lectura (repeticiones). */
  onAction?: (a: ActionId) => void;
  xrayOn?: boolean;
}

function useShakeTrigger(view: TableView): number {
  const active = isValeCuatroMoment(view);
  const prev = useRef(active);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (active && !prev.current) setN((x) => x + 1);
    prev.current = active;
  }, [active]);
  return n;
}

const WINNER_TEXT = { yo: 'Ganaste la baza', bot: 'Ganó el bot', parda: 'Parda' } as const;

function Slot({ w, h }: { w: number; h: number }) {
  return <div className="slot" style={{ width: w, height: h }} aria-hidden="true" />;
}

function Baza({ n, trick, skin, scale }: { n: number; trick: TrickView | undefined; skin: CardSkin; scale: number }) {
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;
  return (
    <div className="baza" role="group" aria-label={`Baza ${n}`} data-winner={trick?.winner ?? 'none'}>
      {trick?.bot ? <PixelCard card={trick.bot} skin={skin} scale={scale} variant="table" /> : <Slot w={w} h={h} />}
      {trick?.mine ? <PixelCard card={trick.mine} skin={skin} scale={scale} variant="table" /> : <Slot w={w} h={h} />}
      <span className="baza__tag">{trick?.winner ? WINNER_TEXT[trick.winner] : ''}</span>
    </div>
  );
}

export function Mesa({ view, skin, onAction, xrayOn = false }: MesaProps) {
  const [width, ref] = useElementWidth<HTMLElement>();
  const scale = pickScale(width - 32, skin.native.w, 3, 8);
  const botLeft = Math.max(0, 3 - view.tricks.filter((t) => t.bot).length);
  const shake = useShakeTrigger(view);
  const status = describeStatus(view);
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;

  return (
    <ShakeRoot trigger={shake}>
      <section className="mesa" ref={ref} aria-label="Mesa" style={{ '--scale': scale } as CSSProperties}>
        <header className="mesa__bot">
          <div className="mesa__botcards">
            {view.botHand
              ? view.botHand.map((c, i) => <PixelCard key={i} card={c} skin={skin} scale={scale} variant="table" />)
              : Array.from({ length: botLeft }, (_, i) => (
                  <PixelCard key={i} card={null} skin={skin} scale={scale} variant="table" />
                ))}
          </div>
          <div className="mesa__mascot">
            <Mascot mood={view.mood} scale={4} />
            <p className="bubble" role="status">{moodLine(view.mood)}</p>
          </div>
        </header>

        <Scoreboard score={view.score} mano={view.mano} />

        <ul className="mesa__status" aria-label="Estado de la mano">
          {status.map((l) => (
            <li key={l.key}>{l.text}</li>
          ))}
        </ul>

        <div className="mesa__bazas">
          {[0, 1, 2].map((i) => (
            <Baza key={i} n={i + 1} trick={view.tricks[i]} skin={skin} scale={scale} />
          ))}
        </div>

        <div className="mesa__hand" role="group" aria-label="Tus cartas">
          {view.hand.map((slot, i) => {
            const id = PLAY_ACTIONS[i]!;
            return slot.played ? (
              <Slot key={i} w={w} h={h} />
            ) : (
              <PixelCard
                key={i}
                card={slot.card}
                skin={skin}
                scale={scale}
                variant="hand"
                index={i}
                onPlay={onAction ? () => onAction(id) : undefined}
                disabled={!view.actions.includes(id)}
              />
            );
          })}
        </div>

        {onAction ? <ActionBar view={view} onAction={onAction} /> : null}
        {xrayOn ? <XRayPanel entries={view.xray} /> : null}
      </section>
    </ShakeRoot>
  );
}
```
Nota: `Slot` es un `div` con el mismo tamaño que una carta para que el layout no salte cuando se juega una carta.

`src/components/Mesa.css`:
```css
.mesa {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(var(--pano), var(--pano-oscuro));
  box-shadow: var(--notch);
}

/* el bot asoma desde el borde superior: sus cartas se ven cortadas */
.mesa__bot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  margin: 0 -16px;
  padding: 0 16px;
  background: var(--pano-oscuro);
}
.mesa__botcards {
  display: flex;
  gap: 8px;
  align-self: flex-start;
  height: 56px;
  overflow: hidden;
}
.mesa__mascot { display: flex; align-items: flex-end; gap: 10px; padding-bottom: 6px; }
.bubble {
  margin: 0 0 8px;
  padding: 6px 10px;
  max-width: 150px;
  font-size: 15px;
  line-height: 1.25;
  color: var(--tinta);
  background: var(--tiza);
  box-shadow: var(--notch);
}

.score { display: grid; gap: 6px; padding: 10px 12px; }
.score__legend, .score__row { display: grid; grid-template-columns: 64px 1fr 1fr 40px; align-items: center; gap: 8px; }
.score__legend { font-size: 13px; color: var(--tiza-dim); }
.score__name { font: 700 16px/1 var(--font-display); }
.score__name small { font: 400 12px var(--font-body); color: var(--ambar); }
.score__half { display: flex; gap: 2px; }
.score__num { position: relative; text-align: right; font: 700 22px/1 var(--font-display); }
.fosforito { display: block; }

.mesa__status {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 14px;
}
.mesa__status li { padding: 4px 8px; color: var(--tiza); background: rgba(27, 16, 51, 0.7); }

.mesa__bazas { display: grid; grid-template-columns: repeat(3, 1fr); justify-items: center; gap: 8px; }
.baza { display: grid; justify-items: center; }
.baza > :nth-child(2) { margin-top: calc(var(--scale) * -56px); position: relative; z-index: 1; }
.baza__tag { min-height: 22px; margin-top: 4px; font-size: 13px; color: var(--tiza); }
.baza[data-winner='yo'] .baza__tag { color: var(--menta); }
.baza[data-winner='bot'] .baza__tag { color: var(--brasa); }
.slot { border: 2px dashed rgba(255, 246, 224, 0.25); }

.mesa__hand { display: flex; justify-content: center; gap: 8px; padding-top: 8px; }

.actionbar { display: grid; gap: 6px; }
.actionbar__row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
.actionbar__row .btn { font-size: 16px; padding: 0 8px; }
.actionbar--wait { margin: 0; padding: 14px 0; text-align: center; color: var(--tiza-dim); }

.xray h2 { font-size: 18px; }
.xray__hint { font-size: 14px; color: var(--tiza-dim); }
.xray__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.xray__list li { display: grid; grid-template-columns: 112px 1fr 44px; align-items: center; gap: 8px; font-size: 15px; }
.xray__bar { height: 14px; background: var(--tinta); }
.xray__bar > span { display: block; height: 100%; background: var(--menta); }
.xray__pct { text-align: right; font: 700 16px var(--font-display); }

@media (min-width: 520px) {
  .mesa { gap: 16px; padding: 0 24px 32px; }
  .mesa__bot { margin: 0 -24px; padding: 0 24px; }
  .mesa__botcards { height: 112px; }
}
```

- [ ] **Step 7: Ajustar la línea tolerante del test de Mesa y correr todo**

En `src/components/Mesa.test.tsx`, reemplazar `expect(screen.getByRole('status', { name: '' })).toBeDefined();` por `expect(screen.getAllByRole('status').length).toBeGreaterThan(0);`.

Run: `npx vitest run && npx tsc`
Expected: PASS y `tsc` limpio. (El comentario `eslint-disable` en `Scoreboard.tsx` es inofensivo: el proyecto no usa ESLint.)

- [ ] **Step 8: Commit**

```bash
git add src/table src/hooks src/components
git commit -m "feat(web): mesa con marcador de fosforitos, botonera contextual, rayos X y layout mobile-first"
```

---

### Task 9: Página "Cómo funciona" con la curva del envido interactiva

**En criollo:** esta es la página que explica, en español simple y sin fórmulas, cómo aprendió el bot: qué es CFR (el "arrepentimiento contrafáctico", con una analogía de sobremesa), qué es un equilibrio de Nash (con piedra, papel o tijera), por qué aparece el faroleo (si solo cantara con buenos tantos lo leerías), por qué esto NO es un LLM ni un fine-tuning, y qué hacen Rust, la GPU y WASM. Arriba de todo está el texto real, guardado como datos tipados para poder testear que no falte ningún concepto. En el medio de la explicación del farol va una curva interactiva: elegís si el bot es mano o pie, movés un slider con tus tantos y la curva te dice con qué frecuencia el bot canta envido. Los datos son de ejemplo (mock) hasta que exista el modelo entrenado, y la página lo dice a la vista. La curva se dibuja a mano en SVG, sin librerías de gráficos.

**Files:**
- Create: `src/logic/curve.ts`, `src/data/envidoCurve.ts`, `src/content/howItWorks.ts`
- Create: `src/components/EnvidoCurve.tsx`, `src/components/EnvidoCurve.css`, `src/pages/ComoFunciona.tsx`, `src/pages/ComoFunciona.css`
- Test: `src/logic/curve.test.ts`, `src/content/howItWorks.test.ts`, `src/components/EnvidoCurve.test.tsx`, `src/pages/ComoFunciona.test.tsx`

**Interfaces:**
- Consumes: `formatPct` (Task 5), `.panel` y tokens CSS (Task 6).
- Produces:
  - `logic/curve.ts`: `TANTOS` (los 22 tantos posibles: 0..7 y 20..33), `type CurveSeat = 'mano' | 'pie'`, `interface CurvePoint { tantos: number; mano: number; pie: number }`, `BLUFF_MAX_TANTOS = 7`, `probAt(data, seat, tantos): number | null`, `bluffMass(data, seat): number`, `curveSummary(data, seat, tantos): string | null`, `barSlot(index: number): number`.
  - `data/envidoCurve.ts`: `ENVIDO_CURVE_MOCK: CurvePoint[]`.
  - `content/howItWorks.ts`: `interface HowSection { id: string; title: string; paragraphs: string[] }`, `HOW_LEAD: string`, `HOW_SECTIONS: HowSection[]`.
  - `EnvidoCurve({ data: CurvePoint[]; note?: string; initialSeat?: CurveSeat; initialTantos?: number })`, `ComoFunciona()`.

- [ ] **Step 1: Tests de la lógica de la curva (fallan)**

`src/logic/curve.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ENVIDO_CURVE_MOCK } from '../data/envidoCurve';
import { TANTOS, barSlot, bluffMass, curveSummary, probAt } from './curve';

describe('datos mock de la curva', () => {
  it('cubren exactamente los 22 tantos posibles', () => {
    expect(ENVIDO_CURVE_MOCK.map((p) => p.tantos)).toEqual([...TANTOS]);
    expect(TANTOS).toHaveLength(22);
  });
  it('todas las probabilidades están en [0,1]', () => {
    for (const p of ENVIDO_CURVE_MOCK) {
      for (const v of [p.mano, p.pie]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
  it('hay farol: con 7 de tanto o menos la probabilidad es mayor que cero', () => {
    for (const p of ENVIDO_CURVE_MOCK.filter((q) => q.tantos <= 7)) {
      expect(p.mano).toBeGreaterThan(0);
      expect(p.pie).toBeGreaterThan(0);
    }
  });
});

describe('probAt / bluffMass', () => {
  it('probAt busca por tantos y asiento', () => {
    expect(probAt(ENVIDO_CURVE_MOCK, 'mano', 27)).toBeCloseTo(0.88, 5);
    expect(probAt(ENVIDO_CURVE_MOCK, 'pie', 27)).toBeCloseTo(0.83, 5);
  });
  it('probAt devuelve null para tantos imposibles', () => {
    expect(probAt(ENVIDO_CURVE_MOCK, 'mano', 15)).toBeNull();
    expect(probAt([], 'pie', 3)).toBeNull();
  });
  it('bluffMass es el promedio con tantos <= 7', () => {
    expect(bluffMass(ENVIDO_CURVE_MOCK, 'mano')).toBeCloseTo(0.04375, 5);
    expect(bluffMass(ENVIDO_CURVE_MOCK, 'pie')).toBeCloseTo(0.03, 5);
    expect(bluffMass([], 'mano')).toBe(0);
  });
});

describe('curveSummary', () => {
  it('con tantos bajos nombra el farol', () => {
    const s = curveSummary(ENVIDO_CURVE_MOCK, 'mano', 6)!;
    expect(s).toContain('Con 6 de tanto');
    expect(s).toContain('7%');
    expect(s).toContain('farol');
  });
  it('con tantos normales da solo el dato', () => {
    const s = curveSummary(ENVIDO_CURVE_MOCK, 'mano', 27)!;
    expect(s).toContain('88%');
    expect(s).not.toContain('farol');
  });
  it('con 31 o más explica la contención', () => {
    expect(curveSummary(ENVIDO_CURVE_MOCK, 'pie', 32)).toContain('se guarda');
  });
  it('null si no hay dato', () => {
    expect(curveSummary(ENVIDO_CURVE_MOCK, 'mano', 15)).toBeNull();
  });
});

describe('barSlot', () => {
  it('deja un hueco entre el 7 y el 20', () => {
    expect(barSlot(0)).toBe(0);
    expect(barSlot(7)).toBe(7);
    expect(barSlot(8)).toBe(9);
    expect(barSlot(21)).toBe(22);
  });
});
```

- [ ] **Step 2: Tests del texto y de los componentes (fallan)**

`src/content/howItWorks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HOW_LEAD, HOW_SECTIONS } from './howItWorks';

const all = [HOW_LEAD, ...HOW_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs])].join('\n');

describe('texto de "Cómo funciona"', () => {
  it('tiene las 6 secciones con texto real', () => {
    expect(HOW_SECTIONS.map((s) => s.id)).toEqual(['que-es', 'arrepentimiento', 'nash', 'farol', 'rust-wasm-gpu', 'limites']);
    for (const s of HOW_SECTIONS) {
      expect(s.paragraphs.length).toBeGreaterThanOrEqual(2);
      for (const p of s.paragraphs) expect(p.length).toBeGreaterThan(60);
    }
  });
  it('explica todos los conceptos pedidos', () => {
    for (const re of [
      /arrepentimiento contrafáctico/i, /Nash/, /piedra, papel o tijera/i, /No es un LLM/, /fine-tuning/,
      /desde cero/, /farol/i, /Rust/, /GPU/, /WASM/,
    ]) {
      expect(all).toMatch(re);
    }
  });
  it('no quedan marcas de texto pendiente', () => {
    expect(all).not.toMatch(/TODO|TBD|lorem|completar/i);
  });
});
```

`src/components/EnvidoCurve.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENVIDO_CURVE_MOCK } from '../data/envidoCurve';
import { EnvidoCurve } from './EnvidoCurve';

describe('EnvidoCurve', () => {
  it('dibuja 22 barras y marca las 8 de la zona de farol', () => {
    const { container } = render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    expect(container.querySelectorAll('rect[data-tantos]')).toHaveLength(22);
    expect(container.querySelectorAll('.curve__bar--farol')).toHaveLength(8);
  });
  it('arranca con 27 de tanto y el bot de mano', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    expect(screen.getByRole('status')).toHaveTextContent('Con 27 de tanto, como mano');
    expect(screen.getByRole('status')).toHaveTextContent('88%');
  });
  it('cambiar a pie actualiza el dato', async () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    await userEvent.click(screen.getByLabelText('El bot es pie'));
    expect(screen.getByRole('status')).toHaveTextContent('83%');
  });
  it('el slider recorre los tantos posibles (índice 6 = 6 de tanto = farol)', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });
    expect(screen.getByRole('status')).toHaveTextContent('Con 6 de tanto');
    expect(screen.getByRole('status')).toHaveTextContent('farol');
  });
  it('trae una tabla accesible con los mismos datos y la nota de datos de ejemplo', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} note="Datos de ejemplo" />);
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(23);
    expect(screen.getByText('Datos de ejemplo')).toBeInTheDocument();
  });
});
```

`src/pages/ComoFunciona.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComoFunciona } from './ComoFunciona';

describe('ComoFunciona', () => {
  it('muestra el título, las 6 secciones y la curva interactiva', () => {
    render(<ComoFunciona />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cómo funciona' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText(/no es un LLM/i)).toBeInTheDocument();
  });
  it('avisa que la curva usa datos de ejemplo', () => {
    render(<ComoFunciona />);
    expect(screen.getByText(/datos de ejemplo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/logic/curve.test.ts src/content src/components/EnvidoCurve.test.tsx src/pages/ComoFunciona.test.tsx`
Expected: FAIL (imports no resueltos).

- [ ] **Step 4: Implementar la lógica de la curva y los datos mock**

`src/logic/curve.ts`:
```ts
import { formatPct } from './format';

/** Tantos posibles en el envido sin flor: una sola carta (0..7) o dos del mismo palo (20..33). */
export const TANTOS = [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33] as const;

export type CurveSeat = 'mano' | 'pie';

/** Probabilidad (0..1) de que el bot cante envido, real envido o falta envido como primer canto. */
export interface CurvePoint {
  tantos: number;
  mano: number;
  pie: number;
}

/** Hasta este tanto, cantar es un farol. */
export const BLUFF_MAX_TANTOS = 7;

export function probAt(data: readonly CurvePoint[], seat: CurveSeat, tantos: number): number | null {
  const p = data.find((d) => d.tantos === tantos);
  return p ? p[seat] : null;
}

export function bluffMass(data: readonly CurvePoint[], seat: CurveSeat): number {
  const low = data.filter((d) => d.tantos <= BLUFF_MAX_TANTOS);
  if (low.length === 0) return 0;
  return low.reduce((acc, d) => acc + d[seat], 0) / low.length;
}

export function curveSummary(data: readonly CurvePoint[], seat: CurveSeat, tantos: number): string | null {
  const p = probAt(data, seat, tantos);
  if (p === null) return null;
  const base = `Con ${tantos} de tanto, ${seat === 'mano' ? 'como mano' : 'como pie'}, el bot canta envido el ${formatPct(p)} de las veces.`;
  if (tantos <= BLUFF_MAX_TANTOS) return `${base} Con eso no tiene nada: es un farol.`;
  if (tantos >= 31) return `${base} Con tantos tan buenos a veces se guarda el canto para no delatarse.`;
  return base;
}

/** Posición horizontal de la barra: deja un hueco entre el 7 y el 20 (índice 7 y 8). */
export function barSlot(index: number): number {
  return index > 7 ? index + 1 : index;
}
```

`src/data/envidoCurve.ts`:
```ts
import { TANTOS } from '../logic/curve';
import type { CurvePoint } from '../logic/curve';

// DATOS DE EJEMPLO. Los reales salen del análisis de faroleo de eval/ cuando termine el entrenamiento.
const MANO = [
  0.02, 0.02, 0.03, 0.03, 0.04, 0.05, 0.07, 0.09,
  0.1, 0.14, 0.22, 0.35, 0.52, 0.66, 0.78, 0.88, 0.93, 0.96, 0.97, 0.86, 0.82, 0.8,
];
const PIE = [
  0.01, 0.01, 0.02, 0.02, 0.03, 0.04, 0.05, 0.06,
  0.06, 0.09, 0.15, 0.27, 0.43, 0.58, 0.71, 0.83, 0.9, 0.94, 0.95, 0.82, 0.78, 0.75,
];

export const ENVIDO_CURVE_MOCK: CurvePoint[] = TANTOS.map((tantos, i) => ({
  tantos,
  mano: MANO[i]!,
  pie: PIE[i]!,
}));
```

- [ ] **Step 5: Escribir el texto real de la página**

`src/content/howItWorks.ts`:
```ts
export interface HowSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const HOW_LEAD =
  "Un bot de truco que se entrenó solo y que aprendió a mentir. Acá te explicamos cómo, sin vueltas y sin fórmulas.";

export const HOW_SECTIONS: HowSection[] = [
  {
    id: "que-es",
    title: "Qué es este bot (y qué no es)",
    paragraphs: [
      "Este bot juega al truco uno contra uno, a 30 puntos. Nadie le explicó estrategias ni le mostró partidas de personas: aprendió solo, jugando millones de manos contra sí mismo.",
      "No es un LLM. No lee ni escribe texto, no hay ningún prompt y no pasó por un fine-tuning de un modelo grande. Es una red neuronal chica, entrenada desde cero, que recibe un montón de números (tus cartas, lo que se jugó, el marcador, los cantos) y devuelve un puñado de probabilidades: cuánto le conviene jugar cada carta, cantar o irse al mazo.",
      "Como es tan chica (unos cientos de miles de números ajustables, en un archivo de uno o dos megas), corre entera en tu navegador. No hay un servidor pensando por él: una vez que carga la página, juega sin conexión.",
    ],
  },
  {
    id: "arrepentimiento",
    title: "Cómo aprende: arrepentimiento contrafáctico",
    paragraphs: [
      "El método se llama CFR, por Counterfactual Regret Minimization. En criollo: minimizar el arrepentimiento contrafáctico. Suena a filosofía, pero la idea es de sobremesa.",
      "Pensá en alguien que, después de cada mano, se repasa: «si en vez de irme al mazo hubiera cantado truco, ¿cuántos puntos más habría sacado?». Esa diferencia es el arrepentimiento. Y «contrafáctico» quiere decir justamente eso: de lo que no hice. El bot compara lo que hizo con lo que podría haber hecho en la misma situación.",
      "Ese arrepentimiento se va sumando mano tras mano, situación por situación. Y la regla para decidir es simple: elegí cada jugada en proporción a cuánto te arrepentís de no haberla elegido. Si cantar envido con 29 de tanto te rindió más que callarte, el arrepentimiento por callarte crece, y la próxima vez cantás más seguido.",
      "El truco tiene demasiadas situaciones posibles para anotarlas todas en una libreta. Ahí entra la red neuronal: en vez de memorizar cada situación, aprende a estimar el arrepentimiento para situaciones parecidas. Esa versión se llama Deep CFR.",
    ],
  },
  {
    id: "nash",
    title: "Equilibrio de Nash: la estrategia que no se puede explotar",
    paragraphs: [
      "Si repetís ese proceso muchísimas veces, el promedio de las estrategias del bot se acerca a un equilibrio de Nash: una forma de jugar tal que, aunque el rival sepa exactamente cómo jugás, no tiene ninguna contra-estrategia que le gane de manera sostenida.",
      "Pensalo con piedra, papel o tijera. Si jugás siempre piedra, el otro te gana siempre con papel. El equilibrio es elegir cada una un tercio de las veces, al azar. No es la mejor jugada contra cada rival en particular: es la que no deja ganar a ninguno a la larga.",
      "En juegos con información oculta, como el truco, el equilibrio casi siempre es mezclado: ante la misma situación, el bot a veces hace una cosa y a veces otra, con ciertas probabilidades. Con el botón de Rayos X de la mesa ves esas probabilidades.",
      "Una aclaración honesta: en el truco completo no podemos calcular exactamente qué tan cerca del equilibrio quedó el bot. En versiones chiquitas del juego sí, y ahí se mide y se publica (mirá la sección Resultados).",
    ],
  },
  {
    id: "farol",
    title: "Por qué aprende a farolear",
    paragraphs: [
      "Nadie le enseñó a mentir. Pensá qué pasaría si el bot cantara envido solo con tantos buenos, digamos 27 para arriba. Lo leerías al toque: «canta, entonces tiene». Cuando cantara, vos no aceptarías sin buenos tantos; cuando no cantara, sabrías que está flojo. Una jugada predecible es una jugada explotable.",
      "El equilibrio lo resuelve mezclando: con algunas manos flojas el bot también canta, de vez en cuando. Así su «envido» casi no te dice nada de lo que tiene. Y con tantos muy buenos a veces se queda callado, por el mismo motivo. Farolear, acá, es la forma matemática de no regalar información.",
      "Probalo en la curva de abajo. Muestra qué tan seguido el bot canta envido según sus tantos. Si fuera un bot de reglas fijas, la curva sería cero hasta cierto número y uno de ahí en adelante. La del bot tiene un piso con tantos bajos (las barras rojas): ese piso es el farol.",
    ],
  },
  {
    id: "rust-wasm-gpu",
    title: "Qué hacen Rust, la GPU y WASM",
    paragraphs: [
      "Rust es el lenguaje del motor: las reglas del truco, el simulador de manos y el árbitro. Es muy rápido, así que puede jugar millones de manos por hora, y es estricto, así que cuesta que se cuelen errores. Si alguien intenta una jugada ilegal, el motor la rechaza.",
      "La GPU (la placa de video) hace la parte pesada del aprendizaje: ajustar los números de la red. Es un trabajo de multiplicar matrices enormes en paralelo, y las placas de video están hechas justo para eso. El entrenamiento corrió en una sola placa de una PC de escritorio.",
      "WASM (WebAssembly) es una forma de correr código escrito en lenguajes como Rust dentro del navegador, casi a la velocidad de una app instalada. Gracias a eso el mismo motor que entrenó al bot corre en tu celular, y no hace falta un servidor (ni pagarlo).",
    ],
  },
  {
    id: "limites",
    title: "Lo que no sabemos",
    paragraphs: [
      "El bot no es invencible. Aprendió contra copias de sí mismo, y una persona con mañas raras puede encontrarle debilidades que nunca vio. En el torneo lo medimos contra otros bots, con intervalos de confianza para que la suerte no nos engañe.",
      "El bot no ve tus cartas: decide solo con lo que apareció en la mesa, igual que vos. Y juega una variante puntual: uno contra uno, a 30 puntos y sin flor.",
      "Las probabilidades del modo Rayos X son las que el bot usa de verdad para elegir su jugada. No son «lo que piensa» de tu mano ni una opinión sobre si la suya es buena o mala.",
    ],
  },
];
```

- [ ] **Step 6: Implementar el componente de la curva y la página**

`src/components/EnvidoCurve.tsx`:
```tsx
import { useState } from 'react';
import { BLUFF_MAX_TANTOS, TANTOS, barSlot, curveSummary } from '../logic/curve';
import type { CurvePoint, CurveSeat } from '../logic/curve';
import { formatPct } from '../logic/format';
import './EnvidoCurve.css';

interface Props {
  data: CurvePoint[];
  /** Aclaración que se muestra debajo del gráfico (por ejemplo, "Datos de ejemplo"). */
  note?: string;
  initialSeat?: CurveSeat;
  initialTantos?: number;
}

const W = 440;
const H = 190;
const PAD = { l: 38, r: 8, t: 8, b: 24 };
const LABELED = new Set([0, 7, 20, 25, 30, 33]);

export function EnvidoCurve({ data, note, initialSeat = 'mano', initialTantos = 27 }: Props) {
  const [seat, setSeat] = useState<CurveSeat>(initialSeat);
  const [idx, setIdx] = useState(Math.max(0, (TANTOS as readonly number[]).indexOf(initialTantos)));
  const tantos = TANTOS[idx]!;

  const chartH = H - PAD.t - PAD.b;
  const slotW = (W - PAD.l - PAD.r) / (TANTOS.length + 1);
  const yOf = (p: number) => PAD.t + (1 - p) * chartH;

  return (
    <figure className="curve panel">
      <div className="curve__controls">
        <fieldset>
          <legend>Posición del bot</legend>
          <label>
            <input type="radio" name="curve-seat" checked={seat === 'mano'} onChange={() => setSeat('mano')} />
            <span>El bot es mano</span>
          </label>
          <label>
            <input type="radio" name="curve-seat" checked={seat === 'pie'} onChange={() => setSeat('pie')} />
            <span>El bot es pie</span>
          </label>
        </fieldset>
        <div className="curve__slider">
          <label htmlFor="curve-tantos">
            Tantos del bot: <span className="curve__value">{tantos}</span>
          </label>
          <input
            id="curve-tantos"
            type="range"
            min={0}
            max={TANTOS.length - 1}
            step={1}
            value={idx}
            aria-valuetext={`${tantos} de tanto`}
            onChange={(e) => setIdx(Number(e.target.value))}
          />
        </div>
      </div>

      <svg
        className="curve__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Probabilidad de que el bot cante envido según sus tantos"
        shapeRendering="crispEdges"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(g)} y2={yOf(g)} stroke="var(--tiza)" strokeOpacity={0.18} />
            <text x={PAD.l - 4} y={yOf(g) + 4} textAnchor="end" className="curve__tick">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {data.map((d, i) => {
          const p = seat === 'mano' ? d.mano : d.pie;
          const x = PAD.l + barSlot(i) * slotW + 1;
          const farol = d.tantos <= BLUFF_MAX_TANTOS;
          return (
            <g key={d.tantos}>
              <rect
                data-tantos={d.tantos}
                className={`curve__bar${farol ? ' curve__bar--farol' : ''}${i === idx ? ' curve__bar--sel' : ''}`}
                x={x}
                y={yOf(p)}
                width={slotW - 2}
                height={Math.max(1, p * chartH)}
                onClick={() => setIdx(i)}
              />
              {LABELED.has(d.tantos) || i === idx ? (
                <text x={x + (slotW - 2) / 2} y={H - 8} textAnchor="middle" className="curve__tick">{d.tantos}</text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <p className="curve__summary" role="status" aria-live="polite">
        {curveSummary(data, seat, tantos)}
      </p>

      <details className="curve__details">
        <summary>Ver los datos en una tabla</summary>
        <table>
          <thead>
            <tr><th scope="col">Tantos</th><th scope="col">Bot mano</th><th scope="col">Bot pie</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.tantos}>
                <th scope="row">{d.tantos}</th>
                <td>{formatPct(d.mano)}</td>
                <td>{formatPct(d.pie)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {note ? <figcaption className="curve__note">{note}</figcaption> : null}
    </figure>
  );
}
```
Nota: en el test de la tabla se usa `hidden: true` porque el `<details>` cerrado oculta su contenido del árbol de accesibilidad.

`src/components/EnvidoCurve.css`:
```css
.curve { margin: 24px 0; }
.curve__controls { display: grid; gap: 12px; margin-bottom: 8px; }
.curve fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 20px; }
.curve legend { padding: 0; margin-bottom: 4px; color: var(--tiza-dim); font-size: 15px; }
.curve label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
.curve input[type='radio'] { width: 22px; height: 22px; accent-color: var(--ambar); }
.curve__slider { display: grid; gap: 4px; }
.curve__value { font: 700 20px var(--font-display); color: var(--ambar); }
.curve input[type='range'] { width: 100%; height: 44px; accent-color: var(--ambar); }
.curve__svg { display: block; width: 100%; height: auto; }
.curve__tick { fill: var(--tiza-dim); font: 10px var(--font-body); }
.curve__bar { fill: var(--ambar); cursor: pointer; }
.curve__bar--farol { fill: var(--brasa); }
.curve__bar--sel { stroke: var(--tiza); stroke-width: 2; }
.curve__summary { min-height: 3.2em; margin: 8px 0; font-size: 17px; }
.curve__details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--menta); }
.curve__details table { width: 100%; border-collapse: collapse; font-size: 14px; }
.curve__details th, .curve__details td { padding: 4px 8px; text-align: right; border-bottom: 1px solid rgba(255, 246, 224, 0.15); }
.curve__details th:first-child { text-align: left; }
.curve__note { margin-top: 8px; font-size: 14px; color: var(--ambar); }
```

`src/pages/ComoFunciona.tsx`:
```tsx
import { EnvidoCurve } from '../components/EnvidoCurve';
import { HOW_LEAD, HOW_SECTIONS } from '../content/howItWorks';
import { ENVIDO_CURVE_MOCK } from '../data/envidoCurve';
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
              data={ENVIDO_CURVE_MOCK}
              note="Datos de ejemplo: se reemplazan por la curva real del bot cuando termine el entrenamiento."
            />
          ) : null}
        </section>
      ))}
    </article>
  );
}
```

`src/pages/ComoFunciona.css`:
```css
.how { max-width: 62ch; font-size: 18px; line-height: 1.6; }
.how__lead { font-size: 20px; color: var(--tiza); }
.how section { margin: 36px 0; }
.how h2 { margin-bottom: 12px; }
```

- [ ] **Step 7: Correr y ver que pasan**

Run: `npx vitest run && npx tsc`
Expected: PASS y `tsc` limpio.

- [ ] **Step 8: Commit**

```bash
git add src/logic/curve.ts src/logic/curve.test.ts src/data src/content src/components/EnvidoCurve.tsx src/components/EnvidoCurve.css src/components/EnvidoCurve.test.tsx src/pages
git commit -m "feat(web): pagina Como funciona con texto real y curva del envido interactiva (datos mock)"
```

---

### Task 10: Resultados y Manos destacadas con datos mock tipados

**En criollo:** dos páginas reales que hoy muestran datos de ejemplo con el formato exacto que va a producir la evaluación (`eval/results/*.json`), así cuando haya resultados de verdad solo se cambia el origen de los datos. **Resultados:** tabla del torneo (partidos ganados con su intervalo de confianza de Wilson al 95% y un veredicto honesto: "le gana" solo si todo el intervalo queda por encima de 50%), curva de aprendizaje y explotabilidad del MiniTruco, con gráficos de línea hechos a mano en SVG. **Manos destacadas:** repeticiones paso a paso de faroles exitosos; cada paso es un `TableView`, así que reusamos la misma mesa en modo solo lectura. Todo lo mock está rotulado como "datos de ejemplo" en pantalla.

**Files:**
- Create: `src/logic/verdict.ts`, `src/logic/scale.ts`, `src/data/types.ts`, `src/data/mock.ts`
- Create: `src/components/LineChart.tsx`, `src/components/LineChart.css`, `src/components/ReplayViewer.tsx`
- Create: `src/pages/Resultados.tsx`, `src/pages/Manos.tsx`, `src/pages/Resultados.css`
- Test: `src/logic/verdict.test.ts`, `src/logic/scale.test.ts`, `src/data/mock.test.ts`, `src/components/LineChart.test.tsx`, `src/components/ReplayViewer.test.tsx`, `src/pages/Resultados.test.tsx`, `src/pages/Manos.test.tsx`

**Interfaces:**
- Consumes: `FIXTURES`, `validateTableView`, `TableView` (Task 2); `Mesa` (Task 8); `DEFAULT_SKIN` (Task 4); `formatPct1`, `formatSigned` (Task 5).
- Produces:
  - `logic/verdict.ts`: `wilson(k: number, n: number, z?: number): { low: number; high: number }`, `type Verdict = 'gana'|'sin-diferencia'|'pierde'`, `verdictOf(ciLow: number, ciHigh: number): Verdict`, `VERDICT_TEXT: Record<Verdict, string>`.
  - `logic/scale.ts`: `linear(d0, d1, r0, r1): (v: number) => number`, `log(d0, d1, r0, r1): (v: number) => number` (satura en `d0`).
  - `data/types.ts`: `TournamentRow`, `LearningPoint`, `ExploitPoint`, `ReplayStep`, `Highlight`, `ResultsData`.
  - `data/mock.ts`: `MOCK_RESULTS: ResultsData`, `MOCK_HIGHLIGHTS: Highlight[]`.
  - `LineChart(props)`, `ReplayViewer({ highlight: Highlight })`, `Resultados()`, `Manos()`.

- [ ] **Step 1: Tests de lógica y datos (fallan)**

`src/logic/verdict.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { verdictOf, wilson } from './verdict';

describe('wilson', () => {
  it('50 de 100 da aproximadamente [0,404 ; 0,596]', () => {
    const { low, high } = wilson(50, 100);
    expect(low).toBeCloseTo(0.404, 2);
    expect(high).toBeCloseTo(0.596, 2);
  });
  it('n = 0 no explota: intervalo completo', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
  it('extremos quedan dentro de [0,1]', () => {
    const all = wilson(100, 100);
    expect(all.high).toBeLessThanOrEqual(1);
    expect(all.low).toBeLessThan(1);
    expect(wilson(0, 100).low).toBeGreaterThanOrEqual(0);
  });
});

describe('verdictOf', () => {
  it('gana solo si TODO el intervalo está por encima de 50%', () => {
    expect(verdictOf(0.51, 0.58)).toBe('gana');
    expect(verdictOf(0.49, 0.56)).toBe('sin-diferencia');
    expect(verdictOf(0.4, 0.49)).toBe('pierde');
    expect(verdictOf(0.5, 0.6)).toBe('sin-diferencia');
  });
});
```

`src/logic/scale.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { linear, log } from './scale';

describe('escalas', () => {
  it('linear mapea el dominio al rango (también invertido)', () => {
    expect(linear(0, 10, 0, 100)(5)).toBe(50);
    expect(linear(0, 1, 200, 0)(0.25)).toBe(150);
  });
  it('linear con dominio degenerado no da NaN', () => {
    expect(linear(3, 3, 7, 9)(3)).toBe(7);
  });
  it('log mapea decenas a distancias iguales', () => {
    const f = log(0.01, 1, 0, 100);
    expect(f(0.1)).toBeCloseTo(50, 5);
    expect(f(1)).toBeCloseTo(100, 5);
  });
  it('log satura por debajo del dominio (no -Infinity)', () => {
    expect(log(0.01, 1, 0, 100)(0)).toBeCloseTo(0, 5);
  });
});
```

`src/data/mock.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateTableView } from '../table/validate';
import { MOCK_HIGHLIGHTS, MOCK_RESULTS } from './mock';

describe('datos mock de resultados', () => {
  it('están rotulados como mock', () => {
    expect(MOCK_RESULTS.isMock).toBe(true);
  });
  it('la tabla del torneo es coherente', () => {
    expect(MOCK_RESULTS.tournament.length).toBeGreaterThanOrEqual(4);
    for (const r of MOCK_RESULTS.tournament) {
      expect(r.ganados).toBeLessThanOrEqual(r.partidos);
      expect(r.winRate).toBeCloseTo(r.ganados / r.partidos, 10);
      expect(r.ciLow).toBeLessThan(r.winRate);
      expect(r.ciHigh).toBeGreaterThan(r.winRate);
      expect(r.netCiLow).toBeLessThanOrEqual(r.netPerHand);
      expect(r.netCiHigh).toBeGreaterThanOrEqual(r.netPerHand);
    }
  });
  it('las curvas están ordenadas por iteración y el aprendizaje mejora', () => {
    const its = MOCK_RESULTS.learning.map((p) => p.iteration);
    expect([...its].sort((a, b) => a - b)).toEqual(its);
    const first = MOCK_RESULTS.learning[0]!;
    const last = MOCK_RESULTS.learning[MOCK_RESULTS.learning.length - 1]!;
    expect(last.vsHeuristic).toBeGreaterThan(first.vsHeuristic);
    const ex = MOCK_RESULTS.exploitability;
    expect(ex[ex.length - 1]!.exploitability).toBeLessThan(ex[0]!.exploitability);
  });
});

describe('manos destacadas mock', () => {
  it('hay al menos dos repeticiones de 2 o más pasos', () => {
    expect(MOCK_HIGHLIGHTS.length).toBeGreaterThanOrEqual(2);
    for (const h of MOCK_HIGHLIGHTS) expect(h.steps.length).toBeGreaterThanOrEqual(2);
  });
  it('todos los pasos son TableView válidos y con texto', () => {
    for (const h of MOCK_HIGHLIGHTS) {
      expect(h.title.length).toBeGreaterThan(5);
      for (const s of h.steps) {
        expect(s.caption.length).toBeGreaterThan(10);
        expect(validateTableView(s.view)).toEqual([]);
      }
    }
  });
  it('los ids son únicos', () => {
    const ids = MOCK_HIGHLIGHTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Tests de componentes y páginas (fallan)**

`src/components/LineChart.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart } from './LineChart';

const props = {
  title: 'Curva de aprendizaje',
  series: [
    { id: 'a', label: 'Contra el azar', color: '#38d6c8', points: [{ x: 0, y: 0.5 }, { x: 100, y: 0.9 }] },
    { id: 'b', label: 'Contra el heurístico', color: '#f2b134', points: [{ x: 0, y: 0.3 }, { x: 100, y: 0.55 }] },
  ],
  yMin: 0,
  yMax: 1,
  yTicks: [0, 0.5, 1],
  yFormat: (v: number) => `${Math.round(v * 100)}%`,
  xLabel: 'Iteraciones',
  summary: 'Contra el azar llega a 90%.',
};

describe('LineChart', () => {
  it('dibuja una línea por serie, la leyenda y el resumen accesible', () => {
    const { container } = render(<LineChart {...props} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Curva de aprendizaje' })).toBeInTheDocument();
    expect(screen.getByText('Contra el heurístico')).toBeInTheDocument();
    expect(screen.getByText('Contra el azar llega a 90%.')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
  it('con una línea de referencia la rotula', () => {
    render(<LineChart {...props} refLine={{ y: 0.5, label: 'Empate' }} />);
    expect(screen.getByText('Empate')).toBeInTheDocument();
  });
  it('en escala log no se rompe con valores en el dominio', () => {
    const { container } = render(
      <LineChart {...props} yLog yMin={0.01} yMax={1} yTicks={[0.01, 0.1, 1]}
        series={[{ id: 'e', label: 'Explotabilidad', color: '#e0453a', points: [{ x: 0, y: 0.9 }, { x: 50, y: 0.05 }] }]} />,
    );
    const pts = container.querySelector('polyline')!.getAttribute('points')!;
    expect(pts).not.toMatch(/NaN|Infinity/);
  });
});
```

`src/components/ReplayViewer.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOCK_HIGHLIGHTS } from '../data/mock';
import { ReplayViewer } from './ReplayViewer';

describe('ReplayViewer', () => {
  const h = MOCK_HIGHLIGHTS[0]!;
  it('arranca en el paso 1 con el botón Anterior deshabilitado', () => {
    render(<ReplayViewer highlight={h} />);
    expect(screen.getByText(h.steps[0]!.caption)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByText(`Paso 1 de ${h.steps.length}`)).toBeInTheDocument();
  });
  it('avanza y retrocede, y Siguiente se apaga en el último paso', async () => {
    render(<ReplayViewer highlight={h} />);
    const next = screen.getByRole('button', { name: 'Siguiente' });
    for (let i = 1; i < h.steps.length; i++) await userEvent.click(next);
    expect(screen.getByText(h.steps[h.steps.length - 1]!.caption)).toBeInTheDocument();
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByText(`Paso ${h.steps.length - 1} de ${h.steps.length}`)).toBeInTheDocument();
  });
  it('la mesa es de solo lectura (sin botones de jugar)', () => {
    render(<ReplayViewer highlight={h} />);
    expect(screen.queryByRole('button', { name: /^Jugar / })).toBeNull();
  });
  it('al cambiar de repetición vuelve al paso 1', async () => {
    const { rerender } = render(<ReplayViewer highlight={h} />);
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    rerender(<ReplayViewer highlight={MOCK_HIGHLIGHTS[1]!} />);
    expect(screen.getByText(`Paso 1 de ${MOCK_HIGHLIGHTS[1]!.steps.length}`)).toBeInTheDocument();
  });
});
```

`src/pages/Resultados.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOCK_RESULTS } from '../data/mock';
import { Resultados } from './Resultados';

describe('Resultados', () => {
  it('muestra el aviso de datos de ejemplo, la tabla y los dos gráficos', () => {
    const { container } = render(<Resultados />);
    expect(screen.getByRole('heading', { level: 1, name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/datos de ejemplo/i);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(MOCK_RESULTS.tournament.length + 1);
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  });
  it('el veredicto sale del intervalo y no del porcentaje', () => {
    render(<Resultados />);
    expect(screen.getAllByText(/Le gana/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin diferencia clara').length).toBeGreaterThan(0);
  });
});
```

`src/pages/Manos.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOCK_HIGHLIGHTS } from '../data/mock';
import { Manos } from './Manos';

describe('Manos destacadas', () => {
  it('lista las repeticiones y muestra la primera', () => {
    render(<Manos />);
    expect(screen.getByRole('heading', { level: 1, name: 'Manos destacadas' })).toBeInTheDocument();
    for (const h of MOCK_HIGHLIGHTS) expect(screen.getByRole('button', { name: h.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[0]!.title })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(MOCK_HIGHLIGHTS[0]!.steps[0]!.caption)).toBeInTheDocument();
  });
  it('elegir otra repetición cambia el visor', async () => {
    render(<Manos />);
    await userEvent.click(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[1]!.title }));
    expect(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[1]!.title })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(MOCK_HIGHLIGHTS[1]!.steps[0]!.caption)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/logic/verdict.test.ts src/logic/scale.test.ts src/data src/components/LineChart.test.tsx src/components/ReplayViewer.test.tsx src/pages/Resultados.test.tsx src/pages/Manos.test.tsx`
Expected: FAIL (imports no resueltos).

- [ ] **Step 4: Implementar lógica y tipos de datos**

`src/logic/verdict.ts`:
```ts
/** Intervalo de Wilson para una proporción k/n (z = 1,96 → 95%). */
export function wilson(k: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export type Verdict = 'gana' | 'sin-diferencia' | 'pierde';

export function verdictOf(ciLow: number, ciHigh: number): Verdict {
  if (ciLow > 0.5) return 'gana';
  if (ciHigh < 0.5) return 'pierde';
  return 'sin-diferencia';
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  gana: 'Le gana (el intervalo queda por encima de 50%)',
  'sin-diferencia': 'Sin diferencia clara',
  pierde: 'Pierde',
};
```

`src/logic/scale.ts`:
```ts
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** Escala logarítmica; los valores por debajo de `d0` se saturan en `d0` (evita -Infinity). */
export function log(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const f = linear(Math.log10(d0), Math.log10(d1), r0, r1);
  return (v) => f(Math.log10(Math.max(v, d0)));
}
```

`src/data/types.ts`:
```ts
import type { TableView } from '../table/types';

/** Una fila del torneo (mismo formato que va a producir eval/). Las proporciones van de 0 a 1. */
export interface TournamentRow {
  rival: string;
  description: string;
  partidos: number;
  ganados: number;
  winRate: number;
  ciLow: number;
  ciHigh: number;
  netPerHand: number;
  netCiLow: number;
  netCiHigh: number;
  /** % de jugadas del rival externo que hubo que reemplazar por una legal. `null` si no aplica. */
  fallbackPct: number | null;
}

export interface LearningPoint {
  iteration: number;
  vsRandom: number;
  vsHeuristic: number;
}

export interface ExploitPoint {
  iteration: number;
  /** Puntos por mano que perdería contra el mejor contrincante (MiniTruco, exacta). */
  exploitability: number;
}

export interface ReplayStep {
  caption: string;
  view: TableView;
}

export interface Highlight {
  id: string;
  title: string;
  why: string;
  steps: ReplayStep[];
}

export interface ResultsData {
  isMock: boolean;
  generatedAt: string;
  tournament: TournamentRow[];
  learning: LearningPoint[];
  exploitability: ExploitPoint[];
}
```

- [ ] **Step 5: Implementar los datos mock**

`src/data/mock.ts`:
```ts
import { wilson } from '../logic/verdict';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import type { Highlight, ResultsData, TournamentRow } from './types';

// DATOS DE EJEMPLO. Los reales los produce eval/ (eval/results/*.json).

function row(
  rival: string,
  description: string,
  partidos: number,
  ganados: number,
  net: [number, number, number],
  fallbackPct: number | null,
): TournamentRow {
  const { low, high } = wilson(ganados, partidos);
  return {
    rival, description, partidos, ganados,
    winRate: ganados / partidos, ciLow: low, ciHigh: high,
    netPerHand: net[0], netCiLow: net[1], netCiHigh: net[2], fallbackPct,
  };
}

const ITER = [0, 50, 100, 200, 400, 800, 1200, 1600, 2000];
const VS_RANDOM = [0.5, 0.74, 0.86, 0.93, 0.96, 0.97, 0.98, 0.98, 0.985];
const VS_HEUR = [0.31, 0.38, 0.44, 0.49, 0.52, 0.54, 0.55, 0.56, 0.563];
const EXPLOIT = [0.9, 0.52, 0.31, 0.19, 0.11, 0.07, 0.05, 0.04, 0.035];

export const MOCK_RESULTS: ResultsData = {
  isMock: true,
  generatedAt: '2026-10-13',
  tournament: [
    row('Bot al azar', 'Juega cualquier acción legal', 2000, 1910, [1.42, 1.31, 1.53], null),
    row('Heurístico propio', 'Reglas fijas: canta envido con 27 o más, truco con dos cartas altas', 2000, 1126, [0.21, 0.14, 0.28], null),
    row('Bot de marianogappa', 'Reglas en Go, con la flor desactivada', 2000, 1030, [0.03, -0.04, 0.1], 3.1),
    row('Heurístico de nicovon24', 'Corre local; no se copia su código', 2000, 1240, [0.38, 0.31, 0.45], 0.4),
  ],
  learning: ITER.map((iteration, i) => ({ iteration, vsRandom: VS_RANDOM[i]!, vsHeuristic: VS_HEUR[i]! })),
  exploitability: ITER.map((iteration, i) => ({ iteration, exploitability: EXPLOIT[i]! })),
};

const base = FIXTURES.finDeManoRayosX;
const sinReveal = (v: TableView): TableView => ({ ...v, botHand: undefined, xray: undefined });

export const MOCK_HIGHLIGHTS: Highlight[] = [
  {
    id: 'farol-truco',
    title: 'El truco con la peor mano',
    why: 'Con 6, 5 y 4 (lo más flojo del mazo) el bot cantó truco y se llevó el punto sin mostrar nada.',
    steps: [
      {
        caption: 'Perdés la primera baza: el bot respondió tu 5 de oros con un 6.',
        view: sinReveal({ ...base, phase: 'jugando', actions: [], mood: 'neutral' }),
      },
      {
        caption: 'En la segunda baza el bot canta truco. Con esa mano, es un farol.',
        view: sinReveal({
          ...base,
          phase: 'jugando',
          truco: { acceptedLevel: 1, pending: { call: 'truco', by: 'bot' } },
          actions: ['quiero', 'noQuiero', 'retruco'],
          mood: 'farol',
        }),
      },
      {
        caption: 'Te vas al mazo… y el bot muestra que no tenía nada.',
        view: base,
      },
    ],
  },
  {
    id: 'envido-bajo',
    title: 'Envido con 5 de tanto',
    why: 'El bot cantó envido con un 5 y un 4 de distinto palo: casi nada de tanto. Sirvió para que no lo leas.',
    steps: [
      {
        caption: 'Sos mano y jugás tu 3 de bastos. El bot, que es pie, todavía no jugó.',
        view: {
          ...FIXTURES.envidoPendiente,
          envido: { calls: [], pending: null, reveal: null },
          actions: [],
          mood: 'neutral',
        },
      },
      {
        caption: 'El bot canta envido. Con 5 de tanto, es un farol de manual.',
        view: { ...FIXTURES.envidoPendiente, mood: 'farol' },
      },
      {
        caption: 'Con la duda, decís no quiero. El bot suma 1 punto sin mostrar sus tantos.',
        view: {
          ...FIXTURES.envidoPendiente,
          envido: { calls: [{ call: 'envido', by: 'bot' }], pending: null, reveal: null },
          score: [12, 15],
          actions: [],
          mood: 'gana',
        },
      },
    ],
  },
];
```

- [ ] **Step 6: Implementar el gráfico de líneas**

`src/components/LineChart.tsx`:
```tsx
import { linear, log } from '../logic/scale';
import './LineChart.css';

export interface Series {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

interface Props {
  title: string;
  series: Series[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  yFormat: (v: number) => string;
  yLog?: boolean;
  refLine?: { y: number; label: string };
  xLabel: string;
  /** Texto que resume el gráfico para quien no lo puede ver. */
  summary: string;
}

const W = 360;
const H = 210;
const PAD = { l: 44, r: 12, t: 12, b: 30 };

export function LineChart({ title, series, yMin, yMax, yTicks, yFormat, yLog = false, refLine, xLabel, summary }: Props) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = linear(x0, x1, PAD.l, W - PAD.r);
  const sy = yLog ? log(yMin, yMax, H - PAD.b, PAD.t) : linear(yMin, yMax, H - PAD.b, PAD.t);

  return (
    <figure className="chart panel">
      <figcaption className="chart__title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} shapeRendering="crispEdges" className="chart__svg">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--tiza)" strokeOpacity={0.18} />
            <text x={PAD.l - 4} y={sy(t) + 4} textAnchor="end" className="chart__tick">{yFormat(t)}</text>
          </g>
        ))}
        {refLine ? (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(refLine.y)} y2={sy(refLine.y)} stroke="var(--menta)" strokeDasharray="4 4" />
            <text x={W - PAD.r} y={sy(refLine.y) - 4} textAnchor="end" className="chart__ref">{refLine.label}</text>
          </g>
        ) : null}
        {series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={s.color}
            strokeWidth={3}
            strokeLinejoin="miter"
            points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          />
        ))}
        <text x={PAD.l} y={H - 8} className="chart__tick">{x0}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="chart__tick">{x1}</text>
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} textAnchor="middle" className="chart__tick">{xLabel}</text>
      </svg>
      <ul className="chart__legend">
        {series.map((s) => (
          <li key={s.id}>
            <span className="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <p className="chart__summary">{summary}</p>
    </figure>
  );
}
```

`src/components/LineChart.css`:
```css
.chart { margin: 16px 0; }
.chart__title { font: 700 18px var(--font-display); margin-bottom: 8px; }
.chart__svg { display: block; width: 100%; height: auto; }
.chart__tick { fill: var(--tiza-dim); font: 10px var(--font-body); }
.chart__ref { fill: var(--menta); font: 10px var(--font-body); }
.chart__legend { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 15px; }
.chart__swatch { display: inline-block; width: 12px; height: 12px; margin-right: 6px; }
.chart__summary { margin: 8px 0 0; font-size: 15px; color: var(--tiza-dim); }
```

- [ ] **Step 7: Implementar el visor de repeticiones y las dos páginas**

`src/components/ReplayViewer.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { Highlight } from '../data/types';
import { DEFAULT_SKIN } from '../skins';
import { Mesa } from './Mesa';

export function ReplayViewer({ highlight }: { highlight: Highlight }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [highlight.id]);

  const last = highlight.steps.length - 1;
  const current = highlight.steps[Math.min(step, last)]!;

  return (
    <section className="replay" aria-label={`Repetición: ${highlight.title}`}>
      <p className="replay__why">{highlight.why}</p>
      <p className="replay__caption" role="status">{current.caption}</p>
      <Mesa view={current.view} skin={DEFAULT_SKIN} xrayOn={current.view.xray !== undefined} />
      <div className="replay__nav">
        <button type="button" className="btn btn--ghost" disabled={step <= 0} onClick={() => setStep((s) => s - 1)}>
          Anterior
        </button>
        <span>{`Paso ${step + 1} de ${highlight.steps.length}`}</span>
        <button type="button" className="btn" disabled={step >= last} onClick={() => setStep((s) => s + 1)}>
          Siguiente
        </button>
      </div>
    </section>
  );
}
```
Nota: el test "al cambiar de repetición vuelve al paso 1" funciona porque el `useEffect` resetea el paso cuando cambia `highlight.id`; entre el render y el efecto, `Math.min(step, last)` evita leer un paso inexistente.

`src/pages/Resultados.tsx`:
```tsx
import { LineChart } from '../components/LineChart';
import { MOCK_RESULTS } from '../data/mock';
import { formatPct, formatPct1, formatSigned } from '../logic/format';
import { VERDICT_TEXT, verdictOf } from '../logic/verdict';
import './Resultados.css';

export function Resultados() {
  const data = MOCK_RESULTS;
  const learningLast = data.learning[data.learning.length - 1]!;
  const exploitLast = data.exploitability[data.exploitability.length - 1]!;

  return (
    <article className="page results">
      <h1>Resultados</h1>
      {data.isMock ? (
        <p className="banner" role="note">
          Datos de ejemplo. Se reemplazan por los de eval/results cuando termine el torneo.
        </p>
      ) : null}

      <h2>Torneo</h2>
      <p>Partidos completos a 30, en formato duplicado (cada reparto se juega dos veces con los asientos invertidos).</p>
      <div className="results__scroll">
        <table className="results__table">
          <thead>
            <tr>
              <th scope="col">Rival</th>
              <th scope="col">Partidos ganados</th>
              <th scope="col">Veredicto</th>
            </tr>
          </thead>
          <tbody>
            {data.tournament.map((r) => (
              <tr key={r.rival}>
                <th scope="row">
                  {r.rival}
                  <small>{r.description}</small>
                </th>
                <td>
                  <strong>{formatPct1(r.winRate)}</strong> ({r.ganados} de {r.partidos})
                  <small>IC 95%: {formatPct1(r.ciLow)} a {formatPct1(r.ciHigh)}</small>
                  <small>
                    Puntos por mano: {formatSigned(r.netPerHand)} ({formatSigned(r.netCiLow)} a {formatSigned(r.netCiHigh)})
                  </small>
                  {r.fallbackPct !== null ? (
                    <small>Jugadas reemplazadas por una legal: {r.fallbackPct.toFixed(1).replace('.', ',')}%</small>
                  ) : null}
                </td>
                <td>{VERDICT_TEXT[verdictOf(r.ciLow, r.ciHigh)]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Cómo fue aprendiendo</h2>
      <LineChart
        title="Partidos ganados durante el entrenamiento"
        xLabel="Iteraciones"
        yMin={0.2}
        yMax={1}
        yTicks={[0.25, 0.5, 0.75, 1]}
        yFormat={formatPct}
        refLine={{ y: 0.5, label: 'Empate' }}
        series={[
          { id: 'azar', label: 'Contra el bot al azar', color: '#38d6c8', points: data.learning.map((p) => ({ x: p.iteration, y: p.vsRandom })) },
          { id: 'heur', label: 'Contra el heurístico', color: '#f2b134', points: data.learning.map((p) => ({ x: p.iteration, y: p.vsHeuristic })) },
        ]}
        summary={`Al final: ${formatPct(learningLast.vsRandom)} contra el azar y ${formatPct(learningLast.vsHeuristic)} contra el heurístico.`}
      />

      <h2>Qué tan explotable es</h2>
      <p>
        En el MiniTruco (una versión chica del juego) se puede calcular exacto cuántos puntos por mano perdería el bot contra el mejor rival posible. Cuanto más cerca de cero, mejor. En el truco completo ese número no se puede calcular.
      </p>
      <LineChart
        title="Explotabilidad del MiniTruco"
        xLabel="Iteraciones"
        yLog
        yMin={0.01}
        yMax={1}
        yTicks={[0.01, 0.1, 1]}
        yFormat={(v) => String(v).replace('.', ',')}
        refLine={{ y: 0.05, label: 'Meta: 0,05' }}
        series={[
          { id: 'exp', label: 'Puntos por mano que se le pueden sacar', color: '#e0453a', points: data.exploitability.map((p) => ({ x: p.iteration, y: p.exploitability })) },
        ]}
        summary={`Al final: ${String(exploitLast.exploitability).replace('.', ',')} puntos por mano.`}
      />
    </article>
  );
}
```

`src/pages/Resultados.css`:
```css
.results h2 { margin-top: 28px; }
.results__scroll { overflow-x: auto; }
.results__table { width: 100%; border-collapse: collapse; font-size: 15px; }
.results__table th, .results__table td { padding: 10px 8px; vertical-align: top; text-align: left; border-bottom: 1px solid rgba(255, 246, 224, 0.15); }
.results__table thead th { font: 700 15px var(--font-display); color: var(--tiza-dim); }
.results__table small { display: block; font-size: 13px; font-weight: 400; color: var(--tiza-dim); }
.results__table td:last-child { min-width: 120px; }
```

`src/pages/Manos.tsx`:
```tsx
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
```

`src/pages/Manos.css`:
```css
.manos__list { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px; }
.replay__why { color: var(--tiza-dim); font-size: 15px; }
.replay__caption { min-height: 3em; margin: 8px 0; padding: 8px 12px; background: var(--noche); box-shadow: var(--notch); }
.replay__nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
```
(Importar `./Manos.css` ya está en `Manos.tsx`; el visor usa las clases `.replay__*` definidas acá.)

- [ ] **Step 8: Correr y ver que pasan**

Run: `npx vitest run && npx tsc`
Expected: PASS y `tsc` limpio. Si `Resultados.test` falla por "Le gana", revisar que el mock del azar y de nicovon24 den un IC por encima de 50% (1910/2000 y 1240/2000 lo cumplen) y que el de marianogappa (1030/2000 = 51,5%) quede "Sin diferencia clara".

- [ ] **Step 9: Commit**

```bash
git add src/logic src/data src/components src/pages
git commit -m "feat(web): paginas Resultados y Manos destacadas con datos mock tipados y graficos SVG"
```

---

### Task 11: Cáscara de la app — navegación, Jugar (demo), Playground y crédito del arte

**En criollo:** juntamos todo. La **cáscara** (App) pone el fondo remolino, el menú con las cuatro secciones (Jugar, Cómo funciona, Resultados, Manos destacadas), el pie con el crédito visible "Card art by Jose Angel Canabal" y los interruptores de CRT y animaciones. La página **Jugar** usa un `GameSource`: una interfaz de tres métodos (`getView`, `subscribe`, `dispatch`) que es la costura donde el otro plan enchufará el bot real en un Web Worker con WASM. Mientras tanto hay un `GameSource` de demostración que reacciona a los toques con jugadas de ejemplo, y la página dice claramente que es una demo. La página **Playground** (`#/playground`) es el banco de pruebas visual para vos: elegís un fixture, cambiás el ánimo de la mascota, sumás puntos para ver la explosión, probás vale cuatro y ves las 40 cartas para confirmar que el arte importó bien.

**Files:**
- Create: `src/game/source.ts`, `src/game/demo.ts`
- Create: `src/components/Nav.tsx`, `src/pages/Jugar.tsx`, `src/pages/Playground.tsx`, `src/pages/Playground.css`, `src/styles/app.css`
- Modify: `src/App.tsx` (reemplaza el esqueleto), `src/App.test.tsx` (reemplaza), `src/main.tsx` (importa `app.css`)
- Test: `src/game/demo.test.ts`, `src/components/Nav.test.tsx`, `src/pages/Jugar.test.tsx`, `src/pages/Playground.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: todo lo anterior (`Mesa`, `Scoreboard`, `FIXTURES`, `SwirlBackground`, `CrtOverlay`, `SettingsToggles`, `ComoFunciona`, `Resultados`, `Manos`, `useRoute`, `hrefFor`, `ROUTES`, `jcanabalSkin`).
- Produces:
  - `game/source.ts`: `interface GameSource { getView(): TableView; subscribe(listener: () => void): () => void; dispatch(action: ActionId): void }`, `useGameView(source: GameSource): TableView`. **Es el contrato que usa el plan del motor WASM.**
  - `game/demo.ts`: `defaultActions(view: TableView): ActionId[]`, `demoReduce(view: TableView, action: ActionId): TableView`, `demoBotStep(view: TableView): TableView`, `interface DemoSource extends GameSource { reset(view?: TableView): void }`, `createDemoSource(initial: TableView, delayMs?: number): DemoSource`.
  - `Nav({ route }: { route: RouteId })`, páginas `Jugar()`, `Playground()`, `App()`.

- [ ] **Step 1: Tests del demo y de la fuente de juego (fallan)**

`src/game/demo.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import { validateTableView } from '../table/validate';
import { createDemoSource, defaultActions, demoBotStep, demoReduce } from './demo';

afterEach(() => vi.useRealTimers());

describe('demoReduce', () => {
  it('jugar una carta la marca como jugada y abre la baza', () => {
    const v = demoReduce(FIXTURES.inicioDeMano, 'jugar1');
    expect(v.hand[1]!.played).toBe(true);
    expect(v.tricks).toEqual([{ mine: { suit: 'oro', number: 7 }, bot: null, winner: null }]);
    expect(v.actions).toEqual([]);
  });
  it('jugar una carta ya jugada o inexistente no cambia nada', () => {
    const v = FIXTURES.trucoPendiente;
    expect(demoReduce(v, 'jugar0')).toBe(v);
  });
  it('quiero al truco del bot sube el nivel aceptado y limpia el pendiente', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'quiero');
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: null });
  });
  it('no quiero al truco termina la mano', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'noQuiero');
    expect(v.phase).toBe('finDeMano');
  });
  it('retruco como respuesta acepta y vuelve a subir', () => {
    const v = demoReduce(FIXTURES.trucoPendiente, 'retruco');
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: { call: 'retruco', by: 'yo' } });
  });
  it('envido propio queda pendiente de respuesta del bot', () => {
    const v = demoReduce(FIXTURES.inicioDeMano, 'envido');
    expect(v.envido.pending).toEqual({ by: 'yo' });
    expect(v.envido.calls).toEqual([{ call: 'envido', by: 'yo' }]);
  });
  it('irse al mazo termina la mano', () => {
    expect(demoReduce(FIXTURES.inicioDeMano, 'mazo').phase).toBe('finDeMano');
  });
  it('CUALQUIER acción disponible en CUALQUIER fixture produce un TableView válido', () => {
    for (const name of FIXTURE_NAMES) {
      for (const a of FIXTURES[name].actions) {
        expect(validateTableView(demoReduce(FIXTURES[name], a)), `${name} + ${a}`).toEqual([]);
      }
    }
  });
});

describe('demoBotStep / defaultActions', () => {
  it('el bot acepta tu truco y vuelve tu turno', () => {
    const asked = demoReduce(FIXTURES.inicioDeMano, 'truco');
    const v = demoBotStep(asked);
    expect(v.truco).toEqual({ acceptedLevel: 2, pending: null });
    expect(v.actions).toContain('jugar0');
    expect(validateTableView(v)).toEqual([]);
  });
  it('el bot acepta tu envido y se revelan los tantos', () => {
    const v = demoBotStep(demoReduce(FIXTURES.inicioDeMano, 'envido'));
    expect(v.envido.pending).toBeNull();
    expect(v.envido.reveal).not.toBeNull();
    expect(validateTableView(v)).toEqual([]);
  });
  it('en fin de mano no hay acciones', () => {
    expect(defaultActions(FIXTURES.finDeManoRayosX)).toEqual([]);
  });
});

describe('createDemoSource', () => {
  it('despacha, notifica y el bot "responde" después del retardo', () => {
    vi.useFakeTimers();
    const src = createDemoSource(FIXTURES.inicioDeMano, 500);
    const listener = vi.fn();
    src.subscribe(listener);
    src.dispatch('jugar0');
    expect(src.getView().actions).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(src.getView().actions).toContain('jugar1');
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it('ignora acciones que no están disponibles', () => {
    const src = createDemoSource(FIXTURES.finDeManoRayosX);
    const before = src.getView();
    src.dispatch('truco');
    expect(src.getView()).toBe(before);
  });
  it('unsubscribe deja de notificar y reset vuelve al inicio', () => {
    const src = createDemoSource(FIXTURES.inicioDeMano);
    const listener = vi.fn();
    const off = src.subscribe(listener);
    off();
    src.dispatch('mazo');
    expect(listener).not.toHaveBeenCalled();
    src.reset();
    expect(src.getView()).toBe(FIXTURES.inicioDeMano);
  });
});
```

- [ ] **Step 2: Tests de navegación, páginas y App (fallan)**

`src/components/Nav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from './Nav';

describe('Nav', () => {
  it('tiene las 4 secciones con su hash', () => {
    render(<Nav route="jugar" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Jugar', 'Cómo funciona', 'Resultados', 'Manos destacadas']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#/jugar', '#/como-funciona', '#/resultados', '#/manos']);
  });
  it('marca la sección actual', () => {
    render(<Nav route="resultados" />);
    expect(screen.getByRole('link', { name: 'Resultados' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Jugar' })).not.toHaveAttribute('aria-current');
  });
});
```

`src/pages/Jugar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Jugar } from './Jugar';

describe('Jugar (demo)', () => {
  it('avisa que es una demostración y muestra la mesa', () => {
    render(<Jugar />);
    expect(screen.getByRole('heading', { level: 1, name: 'Jugar' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/demostración/i);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
  });
  it('tocar una carta la juega y el turno pasa al bot', () => {
    render(<Jugar />);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    expect(screen.queryByRole('button', { name: 'Jugar 7 de oros' })).toBeNull();
    expect(screen.getByText('El bot está pensando…')).toBeInTheDocument();
  });
  it('el modo rayos X se prende y se apaga', () => {
    render(<Jugar />);
    expect(screen.queryByRole('region', { name: 'Rayos X del bot' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Modo rayos X'));
    expect(screen.getByRole('region', { name: 'Rayos X del bot' })).toBeInTheDocument();
  });
  it('"Nueva mano" restaura el inicio', () => {
    render(<Jugar />);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar 7 de oros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva mano' }));
    expect(screen.getByRole('button', { name: 'Jugar 7 de oros' })).toBeInTheDocument();
  });
});
```

`src/pages/Playground.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Playground } from './Playground';

describe('Playground', () => {
  it('muestra las 40 cartas de la baraja para verificar el arte', () => {
    const { container } = render(<Playground />);
    expect(container.querySelectorAll('.deck img')).toHaveLength(40);
  });
  it('muestra las 5 caras de la mascota', () => {
    render(<Playground />);
    expect(screen.getAllByRole('img', { name: /mascota del bot/i }).length).toBeGreaterThanOrEqual(5);
  });
  it('cambiar el fixture cambia la mesa', async () => {
    render(<Playground />);
    await userEvent.selectOptions(screen.getByLabelText('Situación'), 'trucoPendiente');
    expect(screen.getByText('El bot cantó truco. Respondé.')).toBeInTheDocument();
  });
  it('sumar puntos dispara la explosión', () => {
    render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumarte 2 puntos' }));
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
  it('"Probar vale cuatro" hace temblar la mesa', () => {
    const { container } = render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar vale cuatro' }));
    expect(container.querySelector('.shake-root')).toHaveAttribute('data-shaking', 'true');
    expect(screen.getByText('El bot cantó vale cuatro. Respondé.')).toBeInTheDocument();
  });
  it('registra las acciones tocadas', () => {
    render(<Playground />);
    fireEvent.click(screen.getByRole('button', { name: 'Truco' }));
    expect(screen.getByTestId('action-log')).toHaveTextContent('truco');
  });
});
```

`src/App.test.tsx` (reemplaza el del Task 1):
```tsx
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const go = (hash: string) => {
  window.location.hash = hash;
};

describe('App', () => {
  it.each([
    ['#/jugar', 'Jugar'],
    ['#/como-funciona', 'Cómo funciona'],
    ['#/resultados', 'Resultados'],
    ['#/manos', 'Manos destacadas'],
    ['#/playground', 'Playground'],
    ['#/ruta-que-no-existe', 'Jugar'],
    ['', 'Jugar'],
  ])('en %s muestra el título "%s"', (hash, title) => {
    go(hash);
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
  });

  it('cambia de página cuando cambia el hash', () => {
    go('#/jugar');
    render(<App />);
    act(() => {
      go('#/resultados');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Resultados');
    expect(screen.getByRole('link', { name: 'Resultados' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra el crédito del arte con link al autor', () => {
    go('#/jugar');
    render(<App />);
    const credit = screen.getByRole('link', { name: 'Card art by Jose Angel Canabal' });
    expect(credit).toHaveAttribute('href', 'https://jcanabal.itch.io/spanish-deck-pixel-art');
  });

  it('el interruptor CRT agrega y quita el overlay', async () => {
    go('#/jugar');
    const { container } = render(<App />);
    expect(container.querySelector('.crt')).toBeNull();
    await userEvent.click(screen.getByLabelText('Filtro CRT'));
    expect(container.querySelector('.crt')).not.toBeNull();
  });

  it('refleja la preferencia de animaciones en <html data-motion>', async () => {
    go('#/jugar');
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText('Animaciones'), 'reduced');
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/game src/components/Nav.test.tsx src/pages/Jugar.test.tsx src/pages/Playground.test.tsx src/App.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar `GameSource` y el demo**

`src/game/source.ts`:
```ts
import { useSyncExternalStore } from 'react';
import type { ActionId, TableView } from '../table/types';

/**
 * Contrato entre la UI y quien juega la partida.
 * Acá lo implementa un demo; el plan del motor lo implementará con un Web Worker + engine-wasm.
 * `subscribe` y `getView` deben ser funciones estables (no depender de `this`).
 */
export interface GameSource {
  getView(): TableView;
  subscribe(listener: () => void): () => void;
  dispatch(action: ActionId): void;
}

export function useGameView(source: GameSource): TableView {
  return useSyncExternalStore(source.subscribe, source.getView, source.getView);
}
```

`src/game/demo.ts`:
```ts
import { PLAY_ACTIONS, TRUCO_CALL_LEVEL } from '../table/types';
import type { ActionId, EnvidoCall, TableView, TrickView, TrucoCall } from '../table/types';
import type { GameSource } from './source';

const ENVIDO_CALLS: readonly ActionId[] = ['envido', 'realEnvido', 'faltaEnvido'];
const TRUCO_CALLS: readonly ActionId[] = ['truco', 'retruco', 'valeCuatro'];

/** Acciones que ofrece el demo cuando es tu turno. */
export function defaultActions(view: TableView): ActionId[] {
  if (view.phase === 'finDeMano') return [];
  const actions: ActionId[] = [];
  view.hand.forEach((h, i) => {
    if (!h.played) actions.push(PLAY_ACTIONS[i]!);
  });
  if (view.tricks.length === 0 && view.envido.calls.length === 0) actions.push('envido', 'realEnvido', 'faltaEnvido');
  if (view.truco.acceptedLevel === 1 && !view.truco.pending) actions.push('truco');
  actions.push('mazo');
  return actions;
}

export function demoReduce(view: TableView, action: ActionId): TableView {
  const playIdx = (PLAY_ACTIONS as readonly string[]).indexOf(action);
  if (playIdx >= 0) {
    const slot = view.hand[playIdx];
    if (!slot || slot.played) return view;
    const hand = view.hand.map((h, k) => (k === playIdx ? { ...h, played: true } : h));
    const last = view.tricks[view.tricks.length - 1];
    const tricks: TrickView[] =
      last && last.mine === null
        ? view.tricks.map((t, k) => (k === view.tricks.length - 1 ? { ...t, mine: slot.card } : t))
        : [...view.tricks, { mine: slot.card, bot: null, winner: null }];
    const over = hand.every((h) => h.played);
    return { ...view, hand, tricks, actions: [], mood: over ? 'gana' : 'neutral', phase: over ? 'finDeMano' : 'jugando' };
  }

  if (action === 'mazo') return { ...view, actions: [], mood: 'gana', phase: 'finDeMano' };

  if (action === 'quiero') {
    const p = view.truco.pending;
    return {
      ...view,
      actions: [],
      truco: p ? { acceptedLevel: TRUCO_CALL_LEVEL[p.call], pending: null } : view.truco,
      envido: { ...view.envido, pending: null, reveal: view.envido.pending ? { yo: 27, bot: null } : view.envido.reveal },
      mood: 'farol',
    };
  }

  if (action === 'noQuiero') {
    if (view.truco.pending) {
      return { ...view, actions: [], truco: { ...view.truco, pending: null }, mood: 'gana', phase: 'finDeMano' };
    }
    return { ...view, actions: [], envido: { ...view.envido, pending: null }, mood: 'neutral' };
  }

  if (ENVIDO_CALLS.includes(action)) {
    return {
      ...view,
      actions: [],
      envido: {
        ...view.envido,
        calls: [...view.envido.calls, { call: action as EnvidoCall, by: 'yo' }],
        pending: { by: 'yo' },
      },
      mood: 'neutral',
    };
  }

  if (TRUCO_CALLS.includes(action)) {
    const prev = view.truco.pending;
    const acceptedLevel = prev ? TRUCO_CALL_LEVEL[prev.call] : view.truco.acceptedLevel;
    return {
      ...view,
      actions: [],
      truco: { acceptedLevel, pending: { call: action as TrucoCall, by: 'yo' } },
      mood: 'neutral',
    };
  }

  return view;
}

/** El bot "responde": acepta lo que cantaste y te devuelve el turno. */
export function demoBotStep(view: TableView): TableView {
  let next = view;
  if (next.truco.pending?.by === 'yo') {
    next = { ...next, truco: { acceptedLevel: TRUCO_CALL_LEVEL[next.truco.pending.call], pending: null }, mood: 'farol' };
  }
  if (next.envido.pending?.by === 'yo') {
    next = { ...next, envido: { ...next.envido, pending: null, reveal: { yo: 27, bot: null } }, mood: 'pierde' };
  }
  return { ...next, actions: defaultActions(next) };
}

export interface DemoSource extends GameSource {
  reset(view?: TableView): void;
}

export function createDemoSource(initial: TableView, delayMs = 900): DemoSource {
  let view = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const set = (v: TableView) => {
    view = v;
    listeners.forEach((l) => l());
  };
  return {
    getView: () => view,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action) => {
      if (!view.actions.includes(action)) return;
      set(demoReduce(view, action));
      clearTimeout(timer);
      timer = setTimeout(() => set(demoBotStep(view)), delayMs);
    },
    reset: (v = initial) => {
      clearTimeout(timer);
      set(v);
    },
  };
}
```

- [ ] **Step 5: Implementar Nav, Jugar y Playground**

`src/components/Nav.tsx`:
```tsx
import { hrefFor } from '../router';
import type { RouteId } from '../router';

const ITEMS: { id: RouteId; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'manos', label: 'Manos destacadas' },
];

export function Nav({ route }: { route: RouteId }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map((it) => (
        <a key={it.id} href={hrefFor(it.id)} aria-current={route === it.id ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
```

`src/pages/Jugar.tsx`:
```tsx
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
```

`src/pages/Playground.tsx`:
```tsx
import { useState } from 'react';
import { Mascot } from '../art/Mascot';
import { Mesa } from '../components/Mesa';
import { PixelCard } from '../components/PixelCard';
import { DEFAULT_SKIN } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import type { FixtureName } from '../table/fixtures';
import { MOODS, allCards, cardKey } from '../table/types';
import type { ActionId, Mood, TableView } from '../table/types';
import './Playground.css';

export function Playground() {
  const [name, setName] = useState<FixtureName>('inicioDeMano');
  const [mood, setMood] = useState<Mood>(FIXTURES.inicioDeMano.mood);
  const [score, setScore] = useState<readonly [number, number]>(FIXTURES.inicioDeMano.score);
  const [xray, setXray] = useState(true);
  const [log, setLog] = useState<ActionId[]>([]);
  const [vale, setVale] = useState(false);

  const pick = (n: FixtureName) => {
    setName(n);
    setMood(FIXTURES[n].mood);
    setScore(FIXTURES[n].score);
    setVale(false);
  };
  const base = { ...FIXTURES[name], mood, score };
  // "Probar vale cuatro" simula que el bot lo canta: la mesa tiembla.
  const view: TableView = vale
    ? {
        ...base,
        phase: 'jugando',
        truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } },
        actions: ['quiero', 'noQuiero'],
      }
    : base;

  return (
    <article className="page playground">
      <h1>Playground</h1>
      <p>Banco de pruebas visual con datos falsos. Sirve para revisar el arte y los efectos sin motor.</p>

      <div className="playground__controls panel">
        <label htmlFor="pg-fixture">Situación</label>
        <select id="pg-fixture" value={name} onChange={(e) => pick(e.target.value as FixtureName)}>
          {FIXTURE_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <label htmlFor="pg-mood">Ánimo de la mascota</label>
        <select id="pg-mood" value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="playground__check">
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} />
          <span>Rayos X</span>
        </label>
        <div className="playground__buttons">
          <button type="button" className="btn" onClick={() => setScore([Math.min(30, score[0] + 2), score[1]])}>
            Sumarte 2 puntos
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setScore([score[0], Math.min(30, score[1] + 1)])}>
            Sumarle 1 al bot
          </button>
          <button type="button" className="btn btn--brasa" onClick={() => setVale((v) => !v)}>
            {vale ? 'Quitar vale cuatro' : 'Probar vale cuatro'}
          </button>
        </div>
        <p data-testid="action-log" aria-live="polite">Últimas acciones: {log.length ? log.join(', ') : 'ninguna'}</p>
      </div>

      <Mesa view={view} skin={DEFAULT_SKIN} xrayOn={xray} onAction={(a) => setLog((l) => [a, ...l].slice(0, 5))} />

      <h2>Mascota</h2>
      <div className="playground__moods">
        {MOODS.map((m) => (
          <figure key={m}>
            <Mascot mood={m} scale={6} />
            <figcaption>{m}</figcaption>
          </figure>
        ))}
      </div>

      <h2>Dorso</h2>
      <PixelCard card={null} skin={DEFAULT_SKIN} scale={2} variant="table" />

      <h2>Baraja completa (40 cartas)</h2>
      <p className="playground__credit">{DEFAULT_SKIN.credit}. Si ves una carta con texto en vez de dibujo, falta ese PNG.</p>
      <div className="deck">
        {allCards().map((c) => (
          <PixelCard key={cardKey(c)} card={c} skin={DEFAULT_SKIN} scale={1} variant="table" />
        ))}
      </div>
    </article>
  );
}
```
Nota: el test "sumar puntos dispara la explosión" busca el botón por su nombre accesible `Sumarte 2 puntos`; el "registra las acciones" usa el botón `Truco` de la botonera de la mesa del fixture `inicioDeMano`.

`src/pages/Playground.css`:
```css
.playground__controls { display: grid; gap: 10px; margin-bottom: 16px; }
.playground__controls select {
  font: inherit; color: var(--tiza); background: var(--tinta);
  border: 2px solid var(--tiza-dim); min-height: 44px; padding: 0 8px;
}
.playground__check { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.playground__buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.playground__moods { display: flex; flex-wrap: wrap; gap: 16px; }
.playground__moods figure { margin: 0; text-align: center; }
.playground__moods figcaption { margin-top: 6px; font-size: 14px; }
.playground__credit { font-size: 14px; color: var(--tiza-dim); }
.deck { display: flex; flex-wrap: wrap; gap: 8px; }
```

- [ ] **Step 6: Implementar la cáscara y sus estilos**

Reemplazar `src/App.tsx`:
```tsx
import { useEffect } from 'react';
import { CrtOverlay } from './fx/CrtOverlay';
import { SettingsToggles } from './fx/SettingsToggles';
import { SwirlBackground } from './fx/SwirlBackground';
import { Nav } from './components/Nav';
import { hrefFor, useRoute } from './router';
import type { RouteId } from './router';
import { useSettings } from './settings';
import { ComoFunciona } from './pages/ComoFunciona';
import { Jugar } from './pages/Jugar';
import { Manos } from './pages/Manos';
import { Playground } from './pages/Playground';
import { Resultados } from './pages/Resultados';

const TITLES: Record<RouteId, string> = {
  jugar: 'Jugar',
  'como-funciona': 'Cómo funciona',
  resultados: 'Resultados',
  manos: 'Manos destacadas',
  playground: 'Playground',
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

  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion;
  }, [settings.motion]);

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
            <a href="https://jcanabal.itch.io/spanish-deck-pixel-art">Card art by Jose Angel Canabal</a>. El arte de las cartas no es MIT. El código, la mascota y el dorso sí.
          </p>
        </footer>
      </div>
      <CrtOverlay on={settings.crt} />
    </>
  );
}
```

`src/styles/app.css`:
```css
.app { min-height: 100vh; display: flex; flex-direction: column; }
.app__head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 12px 16px 4px; max-width: 720px; width: 100%; margin: 0 auto; }
.brand { font: 700 22px/1 var(--font-display); color: var(--ambar); text-decoration: none; padding: 10px 0; text-shadow: 3px 3px 0 var(--tinta); }
.nav { display: flex; flex-wrap: wrap; gap: 2px; }
.nav a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; margin: 3px;
  font: 700 16px var(--font-display); color: var(--tiza); text-decoration: none;
  background: var(--noche); box-shadow: var(--notch);
}
.nav a[aria-current='page'] { background: var(--ambar); color: var(--tinta); }
.app__main { flex: 1; width: 100%; max-width: 720px; margin: 0 auto; padding: 8px 16px 32px; }
.app__foot { width: 100%; max-width: 720px; margin: 0 auto; padding: 16px; display: grid; gap: 10px; font-size: 14px; color: var(--tiza-dim); }
.banner { margin: 0 0 12px; padding: 8px 12px; background: var(--tinta); color: var(--ambar); box-shadow: var(--notch); font-size: 15px; }
.page__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 12px; }
.page__tools label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.page__tools input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--ambar); }
```

En `src/main.tsx` agregar `import './styles/app.css';` debajo de `import './styles/base.css';`. Además, en este mismo archivo, cambiar los imports de fuentes a los subconjuntos latinos (menos peso): `@fontsource/pixelify-sans/latin-400.css`, `.../latin-700.css`, `@fontsource/atkinson-hyperlegible/latin-400.css`, `.../latin-700.css`.

- [ ] **Step 7: Correr todo**

Run: `npx vitest run && npx tsc`
Expected: PASS y `tsc` limpio.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat(web): App con navegacion, Jugar demo sobre GameSource, Playground y credito del arte"
```

---

### Task 12: Smoke de todas las páginas, build, peso y verificación visual

**En criollo:** cerramos con tres redes de seguridad. Un test que renderiza cada página con sus fixtures y falla si React emite cualquier error o advertencia en consola (claves repetidas, props inválidas…). El build de producción con `tsc` estricto y el control de que todo el sitio pese menos de 5 MB. Y una revisión visual a mano en 360 px (el tamaño del celular de referencia), que es lo único que los tests de jsdom no pueden ver. No usamos Playwright ni hacemos deploy: eso queda fuera de este plan.

**Files:**
- Create: `src/pages/pages.smoke.test.tsx`
- Modify: ninguno (si algo falla, se corrige en el archivo de la tarea que lo introdujo y se commitea junto)

**Interfaces:**
- Consumes: `App`, `ROUTES`, `FIXTURES`, `Mesa`, todas las páginas.
- Produces: nada nuevo; garantiza que el sitio compila, renderiza y pesa poco.

- [ ] **Step 1: Escribir el smoke test**

`src/pages/pages.smoke.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { Mesa } from '../components/Mesa';
import { jcanabalSkin } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import { ROUTES } from '../router';

afterEach(() => vi.restoreAllMocks());

function silentConsole() {
  return {
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  };
}

describe('smoke: cada página renderiza sin errores ni advertencias de React', () => {
  it.each(ROUTES)('ruta %s', (route) => {
    const spies = silentConsole();
    window.location.hash = `#/${route}`;
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });
});

describe('smoke: la mesa con cada fixture', () => {
  it.each(FIXTURE_NAMES)('%s (jugable y en solo lectura)', (name) => {
    const spies = silentConsole();
    const { unmount } = render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} onAction={() => {}} xrayOn />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    unmount();
    render(<Mesa view={FIXTURES[name]} skin={jcanabalSkin} />);
    expect(screen.getByRole('region', { name: 'Mesa' })).toBeInTheDocument();
    expect(spies.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y arreglar lo que aparezca**

Run: `npx vitest run src/pages/pages.smoke.test.tsx`
Expected: PASS. Si falla por una advertencia (por ejemplo, `key` repetida), corregir en el componente culpable (no silenciar el test) y volver a correr.

- [ ] **Step 3: Suite completa, tipos y build**

```bash
npx vitest run && npx tsc && npm run build
```
Expected: todos los tests PASS, `tsc` sin salida, build exitoso con `dist/`.

- [ ] **Step 4: Verificar el peso (< 5 MB)**

```bash
du -sb dist | awk '{ if ($1 < 5*1024*1024) { print "OK " $1 " bytes" } else { print "DEMASIADO GRANDE " $1; exit 1 } }'
```
Expected: `OK <n> bytes`. Si pasa de 5 MB, mirar `du -ah dist | sort -h | tail -20`: lo normal es que lo más pesado sean las 40 cartas y las fuentes; revisar que los imports de fuentes sean solo los `latin-*.css`.

- [ ] **Step 5: Revisión visual manual (única cosa que no cubre jsdom)**

```bash
npm run dev -- --host
```
Abrir la URL que imprime Vite (desde Windows suele andar `http://localhost:5173`). En Chrome: `F12` → modo dispositivo → 360×640. Revisar, en este orden:

- [ ] `#/playground`: se ven las 40 cartas con dibujo (ninguna con texto en vez de arte) y las 5 caras de la mascota, distintas entre sí.
- [ ] `#/jugar` a 360 px: las 3 cartas de tu mano entran sin scroll horizontal y los botones se alcanzan con el pulgar (al menos 48 px de alto).
- [ ] En `#/jugar`, tocar una carta: se ve el "pop" en la mesa; el marcador y los botones siguen visibles sin scrollear demasiado.
- [ ] En `#/playground`, "Sumarte 2 puntos": explotan partículas y aparece `+2`.
- [ ] En `#/playground`, elegir `trucoPendiente` y ver que la botonera ofrece Quiero / No quiero / Quiero retruco. Tocar "Probar vale cuatro": la pantalla tiembla (una sola vez).
- [ ] El fondo remolino se mueve; con el selector "Animaciones: Reducidas" queda quieto, las cartas dejan de balancearse y no hay partículas ni temblor.
- [ ] Filtro CRT: se enciende y se apaga con el interruptor.
- [ ] `#/como-funciona`: el texto se lee cómodo a 360 px y la curva del envido responde al slider y al cambio mano/pie.
- [ ] `#/resultados` y `#/manos`: se leen sin romper el layout; la tabla de resultados scrollea solo dentro de su caja si hace falta.
- [ ] El crédito "Card art by Jose Angel Canabal" se ve al pie de todas las páginas.

Frenar el servidor con `Ctrl+C`. Cualquier defecto visual se corrige en el archivo de su tarea (CSS o componente), con su commit propio `fix(web): ...`.

- [ ] **Step 5b: Commit final**

```bash
git add src/pages/pages.smoke.test.tsx
git commit -m "test(web): smoke de todas las paginas y de la mesa con cada fixture"
git log --oneline | head -15
```
Expected: se ven los 12 commits de este plan (más los `fix(web)` que hayan hecho falta).
