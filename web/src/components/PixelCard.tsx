import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useMotionPolicy } from '../fx/useMotionPolicy';
import { tiltFromPointer } from '../logic/motion';
import type { CardSkin } from '../skins/types';
import { cardLabel } from '../table/labels';
import { cardKey } from '../table/types';
import type { Card } from '../table/types';
import './PixelCard.css';

interface Props {
  card: Card | null;
  skin: CardSkin;
  /** Escala CSS (>= 1) tal que escala x dpr sea entero (ver pickScale): píxeles físicos enteros. */
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
  // Se recuerda QUÉ carta falló (no un booleano): al cambiar de carta, la nueva intenta cargar su imagen.
  const [brokenKey, setBrokenKey] = useState<string | null>(null);
  const key = card ? cardKey(card) : null;
  const broken = key !== null && brokenKey === key;

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
      {broken ? (
        <span className="pcard__fallback">{name}</span>
      ) : (
        <img
          src={card ? skin.faceUrl(card) : skin.backUrl()}
          alt={name}
          width={w}
          height={h}
          draggable={false}
          onError={() => setBrokenKey(key)}
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
