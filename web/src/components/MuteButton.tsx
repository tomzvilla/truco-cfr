import { toggleMute, useSound } from '../audio/useSound';
import { PixelIcon } from './icons';

/** Silenciar / activar el sonido de todo el sitio. Botón de ícono: `aria-pressed` = está silenciado. */
export function MuteButton({ className = 'btn btn--icon' }: { className?: string }) {
  const { muted } = useSound();
  return (
    <button
      type="button"
      className={className}
      aria-pressed={muted}
      aria-label={muted ? 'Activar sonido' : 'Silenciar'}
      title={muted ? 'Activar sonido' : 'Silenciar'}
      onClick={toggleMute}
    >
      <PixelIcon name={muted ? 'speakerOff' : 'speakerOn'} />
    </button>
  );
}
