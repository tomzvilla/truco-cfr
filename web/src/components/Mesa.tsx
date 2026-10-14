import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Mascot } from '../art/Mascot';
import { useElementWidth } from '../hooks/useElementWidth';
import { DESKTOP_QUERY, NARROW_QUERY, useDevicePixelRatio, useMediaQuery, useViewportHeight } from '../hooks/useViewport';
import { pickScale, pickScaleByHeight } from '../skins/scale';
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

/** Separación entre cartas de la mano (px); debe coincidir con `gap` de .mesa__hand en Mesa.css. */
const HAND_GAP = 8;

/**
 * Alto fijo (px) de la columna de la mesa en escritorio que no escala con las cartas: etiqueta de baza (26), dos
 * separaciones de 12, aire arriba de la mano (8) y el relleno de la mesa (12 + 12). Debe coincidir con Mesa.css.
 */
const TABLE_OVERHEAD = 82;
/** Cuánto asoma de la carta del bot en cada baza en escritorio (px nativos), igual que `.baza` en Mesa.css. */
const BAZA_OVERLAP = 56;

interface MesaProps {
  view: TableView;
  skin: CardSkin;
  /** Sin `onAction` la mesa es de solo lectura (repeticiones). */
  onAction?: (a: ActionId) => void;
  xrayOn?: boolean;
  /** Botones de la mesa que no son jugadas (Nueva mano, Configuración): van en la columna derecha, al final. */
  tools?: ReactNode;
}

/**
 * Escala máxima que deja entrar la columna de la mesa en lo que queda de la ventana (alto de la ventana menos lo que
 * hay arriba de la mesa y el pie). Solo en escritorio; en celular la mesa se desplaza y esto no aplica (devuelve 3).
 * Lo medido (posición de la mesa, alto del pie) no depende de la escala, así que no hay realimentación.
 */
function useHeightScale(ref: { current: HTMLElement | null }, enabled: boolean, nativeH: number, dpr: number): number {
  const vh = useViewportHeight();
  const [chrome, setChrome] = useState<{ top: number; foot: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const foot = document.querySelector('.app__foot')?.getBoundingClientRect().height ?? 0;
      setChrome((c) => (c && Math.abs(c.top - top) < 0.5 && Math.abs(c.foot - foot) < 0.5 ? c : { top, foot }));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [enabled, ref]);
  if (!enabled) return 3;
  const available = vh - (chrome?.top ?? 0) - (chrome?.foot ?? 0);
  // cartas en pantalla: dorsos (1) + baza (2 cartas menos el solape) + mano (1) = 4 cartas menos el solape
  return pickScaleByHeight(available, TABLE_OVERHEAD, 4 * nativeH - BAZA_OVERLAP, 3, dpr);
}

/**
 * Celular: la mesa se desplaza, pero conviene que la mano y TODOS los botones de jugada entren en la primera pantalla.
 * Se mide lo que no es la mano (todo el alto de la mesa menos las cartas de la mano y menos la fila de herramientas,
 * que queda abajo) y la mano usa la escala más grande que deja entrar el resto, nunca menos de 1x. Lo medido no
 * depende de la escala de la mano, así que no hay realimentación.
 */
function useNarrowFitScale(
  ref: { current: HTMLElement | null },
  enabled: boolean,
  nativeH: number,
  shown: { current: number },
  dpr: number,
): number {
  const vh = useViewportHeight();
  const [m, setM] = useState<{ top: number; rest: number } | null>(null);
  const measureRef = useRef<() => void>(() => {});
  measureRef.current = () => {
    const el = ref.current;
    if (!enabled || !el) return;
    const r = el.getBoundingClientRect();
    const tools = el.querySelector('.mesa__tools')?.getBoundingClientRect().height ?? 0;
    const top = r.top + window.scrollY;
    const rest = r.height - nativeH * shown.current - (tools > 0 ? tools + 6 : 0);
    setM((c) => (c && Math.abs(c.top - top) < 0.5 && Math.abs(c.rest - rest) < 0.5 ? c : { top, rest }));
  };
  useLayoutEffect(() => measureRef.current());
  useEffect(() => {
    if (!enabled) return;
    const run = () => measureRef.current();
    window.addEventListener('resize', run);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', run);
      ro?.disconnect();
    };
  }, [enabled]);
  if (!enabled || !m) return 3;
  return pickScaleByHeight(vh - m.top - m.rest, 0, nativeH, 3, dpr);
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

export function Mesa({ view, skin, onAction, xrayOn = false, tools }: MesaProps) {
  // El ancho disponible es el del contenedor real de la mano (no window.innerWidth menos un margen supuesto).
  const [handWidth, handRef] = useElementWidth<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement>(null);
  const dpr = useDevicePixelRatio();
  const narrow = useMediaQuery(NARROW_QUERY);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const heightScale = useHeightScale(sectionRef, desktop, skin.native.h, dpr);
  const shownScale = useRef(1);
  const narrowCap = useNarrowFitScale(sectionRef, narrow, skin.native.h, shownScale, dpr);
  const scale = Math.min(pickScale(handWidth, skin.native.w, 3, HAND_GAP, 3, dpr), heightScale, narrowCap);
  shownScale.current = scale;
  // En celular solo la mano propia crece con la densidad de pantalla; el bot y las bazas quedan en tamaño nativo para
  // que la mano y los botones entren sin scroll en 360 x 780. En escritorio todo usa la misma escala (limitada por
  // el ancho de la mano y por el alto de la ventana: la mesa entera tiene que entrar sin scroll).
  const tableScale = narrow ? 1 : scale;
  const botScale = desktop ? scale : 1;
  const botLeft = Math.max(0, 3 - view.tricks.filter((t) => t.bot).length);
  const shake = useShakeTrigger(view);
  const status = describeStatus(view);
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;
  const revealed = view.botHand !== undefined;

  return (
    <ShakeRoot trigger={shake}>
      <section ref={sectionRef} className="mesa" aria-label="Mesa" style={{ '--scale': tableScale } as CSSProperties}>
        <div className="mesa__table">
          <header className="mesa__bot">
            <div className="mesa__botcards" data-revealed={String(revealed)}>
              {view.botHand
                ? view.botHand.map((c, i) => <PixelCard key={i} card={c} skin={skin} scale={botScale} variant="table" />)
                : Array.from({ length: botLeft }, (_, i) => (
                    <PixelCard key={i} card={null} skin={skin} scale={botScale} variant="table" />
                  ))}
            </div>
          </header>

          <div className="mesa__bazas">
            {[0, 1, 2].map((i) => (
              <Baza key={i} n={i + 1} trick={view.tricks[i]} skin={skin} scale={tableScale} />
            ))}
          </div>

          <div className="mesa__hand" ref={handRef} role="group" aria-label="Tus cartas">
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
        </div>

        <div className="mesa__aside">
          <div className="mesa__mascot">
            <Mascot mood={view.mood} scale={narrow ? 3 : 4} />
            {/* sin aria-live: el ánimo cambia seguido y no hace falta anunciarlo; el estado real va en la lista de abajo */}
            <p className="bubble">{moodLine(view.mood)}</p>
          </div>

          <Scoreboard score={view.score} mano={view.mano} />

          <ul className="mesa__status" aria-label="Estado de la mano" aria-live="polite">
            {status.map((l) => (
              <li key={l.key}>{l.text}</li>
            ))}
          </ul>

          {onAction ? <ActionBar view={view} onAction={onAction} /> : null}
          {xrayOn ? <XRayPanel entries={view.xray} /> : null}
          {tools ? <div className="mesa__tools">{tools}</div> : null}
        </div>
      </section>
    </ShakeRoot>
  );
}
