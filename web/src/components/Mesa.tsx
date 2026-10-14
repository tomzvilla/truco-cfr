import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Mascot } from '../art/Mascot';
import { feltDataUrl, railDataUrl } from '../art/table';
import { handOutcome } from '../game/rules';
import { useElementWidth } from '../hooks/useElementWidth';
import { DESKTOP_QUERY, useDevicePixelRatio, useMediaQuery, useViewportHeight } from '../hooks/useViewport';
import type { CardSkin } from '../skins/types';
import { moodLine } from '../table/labels';
import { handOverlap, tableSizes } from '../table/sizing';
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
  /** Empezar otra mano: se ofrece en el cartel de fin de mano. */
  onNewHand?: () => void;
  xrayOn?: boolean;
  /** Arriba del panel lateral (solo escritorio): marca y aviso de demo. */
  head?: ReactNode;
  /** Botones del panel lateral (solo escritorio): Nueva mano, Configuración, sonido. Fuera del paño. */
  tools?: ReactNode;
}

/** Texturas del paño y del riel (se dibujan una sola vez). Se enchufan como `--felt-image` y `--rail-image`. */
let cachedTextures: { felt: string; rail: string } | null = null;
function textures(): { felt: string; rail: string } {
  cachedTextures ??= { felt: `url("${feltDataUrl()}")`, rail: `url("${railDataUrl()}")` };
  return cachedTextures;
}

/** Cuánto le queda a la mesa en la ventana: alto de la ventana menos lo que hay arriba (y el pie en escritorio). */
function useAvailableHeight(ref: { current: HTMLElement | null }, desktop: boolean): { height: number; top: number } {
  const vh = useViewportHeight();
  const [chrome, setChrome] = useState({ top: 0, foot: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const foot = desktop ? Math.round(document.querySelector('.app__foot')?.getBoundingClientRect().height ?? 0) : 0;
      setChrome((c) => (c.top === top && c.foot === foot ? c : { top, foot }));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [ref, desktop]);
  return { height: vh - chrome.top - chrome.foot, top: chrome.top };
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

const WINNER_TEXT = { yo: 'Ganaste', bot: 'Ganó el bot', parda: 'Parda' } as const;

function Slot({ w, h, ghost }: { w: number; h: number; ghost?: boolean }) {
  return <div className={ghost ? 'slot slot--ghost' : 'slot'} style={{ width: w, height: h }} aria-hidden="true" />;
}

function Baza({ n, trick, skin, scale }: { n: number; trick: TrickView | undefined; skin: CardSkin; scale: number }) {
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;
  return (
    <div className="baza" role="group" aria-label={`Baza ${n}`} data-winner={trick?.winner ?? 'none'}>
      <div className="baza__cards">
        {trick?.bot ? <PixelCard card={trick.bot} skin={skin} scale={scale} variant="table" /> : <Slot w={w} h={h} />}
        {trick?.mine ? <PixelCard card={trick.mine} skin={skin} scale={scale} variant="table" /> : <Slot w={w} h={h} />}
      </div>
      <span className="baza__tag">{trick?.winner ? WINNER_TEXT[trick.winner] : ''}</span>
    </div>
  );
}

function resultLine(view: TableView): string {
  const o = handOutcome(view.tricks, view.mano);
  return o === 'yo' ? 'Ganaste la mano' : o === 'bot' ? 'Ganó el bot' : 'Mano terminada';
}

export function Mesa({ view, skin, onAction, onNewHand, xrayOn = false, head, tools }: MesaProps) {
  const [handWidth, handRef] = useElementWidth<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement>(null);
  const dpr = useDevicePixelRatio();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { height, top } = useAvailableHeight(sectionRef, desktop);
  const sizes = tableSizes({ desktop, width: handWidth, height, dpr, native: skin.native });
  const [xrayOpen, setXrayOpen] = useState(false);
  const xrayId = useId();

  const shake = useShakeTrigger(view);
  const status = describeStatus(view);
  const nw = skin.native.w;
  const nh = skin.native.h;
  const handW = nw * sizes.hand;
  const handH = nh * sizes.hand;
  const playedW = nw * sizes.played;
  const playedH = nh * sizes.played;
  const botW = nw * sizes.bot;
  const botH = nh * sizes.bot;
  const overlap = handOverlap(handWidth, handW, desktop ? Math.round(handW * 0.1) : 6, handH);
  const botLeft = Math.max(0, 3 - view.tricks.filter((t) => t.bot).length);
  const revealed = view.botHand !== undefined;
  const interactive = onAction !== undefined;
  const sheet = interactive && xrayOn; // jugando: los rayos X se abren desde un botón
  const ended = interactive && view.phase === 'finDeMano';

  const style = {
    '--hand-w': `${handW}px`,
    '--hand-h': `${handH}px`,
    '--played-w': `${playedW}px`,
    '--played-h': `${playedH}px`,
    '--bot-w': `${botW}px`,
    '--bot-h': `${botH}px`,
    '--hand-overlap': `${overlap}px`,
    '--mesa-top': `${top}px`,
    '--felt-image': textures().felt,
    '--rail-image': textures().rail,
  } as CSSProperties;

  const backs = (
    <div className="mesa__bots" data-revealed={String(revealed)}>
      <div className="mesa__botcards" data-revealed={String(revealed)}>
        {view.botHand
          ? view.botHand.map((c, i) => <PixelCard key={i} card={c} skin={skin} scale={sizes.bot} variant="table" />)
          : Array.from({ length: botLeft }, (_, i) => (
              <PixelCard key={i} card={null} skin={skin} scale={sizes.bot} variant="table" />
            ))}
      </div>
    </div>
  );

  const mascot = (
    <div className="mesa__mascot">
      <Mascot mood={view.mood} scale={desktop ? 3 : 2} />
      {/* sin aria-live: el ánimo cambia seguido y no hace falta anunciarlo; el estado real va en la lista de chips */}
      <p className="bubble">{moodLine(view.mood)}</p>
    </div>
  );

  const paper = (
    <div className="mesa__paper">
      <Scoreboard score={view.score} mano={view.mano} />
      <ul className="mesa__status" aria-label="Estado de la mano" aria-live="polite">
        {status.map((l) => (
          <li key={l.key}>{l.text}</li>
        ))}
      </ul>
    </div>
  );

  const xrayToggle = sheet ? (
    <button
      type="button"
      className="btn btn--ghost"
      aria-expanded={xrayOpen}
      aria-controls={xrayId}
      onClick={() => setXrayOpen((o) => !o)}
    >
      Rayos X
    </button>
  ) : null;

  const toolRow =
    tools || xrayToggle ? (
      <div className="mesa__tools">
        {tools}
        {xrayToggle}
      </div>
    ) : null;

  const xraySheet = sheet ? (
    <div id={xrayId} className="xsheet" data-open={String(xrayOpen)} hidden={!xrayOpen}>
      <div className="xsheet__box">
        <XRayPanel entries={view.xray} />
        <button type="button" className="btn btn--ghost xsheet__close" onClick={() => setXrayOpen(false)}>
          Cerrar rayos X
        </button>
      </div>
    </div>
  ) : null;

  return (
    <ShakeRoot trigger={shake}>
      <section ref={sectionRef} className="mesa" aria-label="Mesa" style={style} data-layout={desktop ? 'desktop' : 'mobile'}>
        {desktop ? (
          <div className="mesa__side">
            {head}
            {mascot}
            {paper}
            {toolRow}
            {xraySheet}
          </div>
        ) : null}

        <div className="mesa__play">
          {desktop ? backs : (
            <div className="mesa__strip">
              {backs}
              {mascot}
            </div>
          )}

          <div className="mesa__rail">
            <div className="mesa__felt">
              {desktop ? null : paper}
              <div className="mesa__bazas">
                {[0, 1, 2].map((i) => (
                  <Baza key={i} n={i + 1} trick={view.tricks[i]} skin={skin} scale={sizes.played} />
                ))}
              </div>
              {ended ? (
                <div className="mesa__end" data-outcome={handOutcome(view.tricks, view.mano) ?? 'none'}>
                  <p className="mesa__end-title">{resultLine(view)}</p>
                  {onNewHand ? (
                    <button type="button" className="btn btn--brasa" onClick={onNewHand}>
                      Nueva mano
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mesa__hand" ref={handRef} role="group" aria-label="Tus cartas">
            {view.hand.map((slot, i) => {
              const id = PLAY_ACTIONS[i]!;
              return slot.played ? (
                <Slot key={i} w={handW} h={handH} ghost />
              ) : (
                <PixelCard
                  key={i}
                  card={slot.card}
                  skin={skin}
                  scale={sizes.hand}
                  variant="hand"
                  index={i}
                  onPlay={onAction ? () => onAction(id) : undefined}
                  disabled={!view.actions.includes(id)}
                />
              );
            })}
          </div>

          {onAction ? (
            <div className="mesa__bar">
              <ActionBar view={view} onAction={onAction} />
            </div>
          ) : null}
          {desktop ? null : toolRow}
          {desktop ? null : xraySheet}
          {!interactive && xrayOn ? <XRayPanel entries={view.xray} /> : null}
        </div>
      </section>
    </ShakeRoot>
  );
}
