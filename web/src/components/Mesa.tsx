import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Mascot } from '../art/Mascot';
import { useElementWidth } from '../hooks/useElementWidth';
import { NARROW_QUERY, useDevicePixelRatio, useMediaQuery } from '../hooks/useViewport';
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

/** Separación entre cartas de la mano (px); debe coincidir con `gap` de .mesa__hand en Mesa.css. */
const HAND_GAP = 8;

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
  // El ancho disponible es el del contenedor real de la mano (no window.innerWidth menos un margen supuesto).
  const [handWidth, handRef] = useElementWidth<HTMLDivElement>();
  const dpr = useDevicePixelRatio();
  const narrow = useMediaQuery(NARROW_QUERY);
  const scale = pickScale(handWidth, skin.native.w, 3, HAND_GAP, 3, dpr);
  // Solo la mano propia crece con la densidad de pantalla; el bot y las bazas quedan en tamaño nativo (el bot siempre,
  // las bazas en celular) para que la mano y los botones entren sin scroll en 360 x 780.
  const tableScale = narrow ? 1 : scale;
  const botScale = 1;
  const botLeft = Math.max(0, 3 - view.tricks.filter((t) => t.bot).length);
  const shake = useShakeTrigger(view);
  const status = describeStatus(view);
  const w = skin.native.w * scale;
  const h = skin.native.h * scale;
  const revealed = view.botHand !== undefined;

  return (
    <ShakeRoot trigger={shake}>
      <section className="mesa" aria-label="Mesa" style={{ '--scale': tableScale } as CSSProperties}>
        <header className="mesa__bot">
          <div className="mesa__botcards" data-revealed={String(revealed)}>
            {view.botHand
              ? view.botHand.map((c, i) => <PixelCard key={i} card={c} skin={skin} scale={botScale} variant="table" />)
              : Array.from({ length: botLeft }, (_, i) => (
                  <PixelCard key={i} card={null} skin={skin} scale={botScale} variant="table" />
                ))}
          </div>
          <div className="mesa__mascot">
            <Mascot mood={view.mood} scale={narrow ? 3 : 4} />
            {/* sin aria-live: el ánimo cambia seguido y no hace falta anunciarlo; el estado real va en la lista de abajo */}
            <p className="bubble">{moodLine(view.mood)}</p>
          </div>
        </header>

        <Scoreboard score={view.score} mano={view.mano} />

        <ul className="mesa__status" aria-label="Estado de la mano" aria-live="polite">
          {status.map((l) => (
            <li key={l.key}>{l.text}</li>
          ))}
        </ul>

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

        {onAction ? <ActionBar view={view} onAction={onAction} /> : null}
        {xrayOn ? <XRayPanel entries={view.xray} /> : null}
      </section>
    </ShakeRoot>
  );
}
