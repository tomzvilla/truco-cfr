import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { MotionSetting } from '../logic/motion';
import { updateSettings, useSettings } from '../settings';
import { PixelSegmented } from './PixelSegmented';
import { PixelSwitch } from './PixelSwitch';
import './Config.css';

const MOTION_OPTIONS: readonly { value: MotionSetting; label: string }[] = [
  { value: 'auto', label: 'Según el sistema' },
  { value: 'full', label: 'Completas' },
  { value: 'reduced', label: 'Reducidas' },
];

const FOCUSABLE = 'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Botón "Configuración" + panel modal con todas las preferencias. Es un diálogo de verdad: el foco entra y no se
 * escapa con Tab, Esc (o el fondo, o "Cerrar") lo cierra y el foco vuelve al botón.
 */
export function ConfigDialog() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  // al abrir: el foco entra al primer control
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn btn--ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Configuración
      </button>
      {open
        ? createPortal(
            <div className="config__backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
              <div
                ref={panel}
                className="config panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={onKeyDown}
              >
                <h2 id={titleId}>Configuración</h2>
                <div className="config__list">
                  <PixelSwitch
                    label="Modo rayos X"
                    hint="Muestra las probabilidades con las que el bot elige cada jugada."
                    checked={s.xray}
                    onChange={(xray) => updateSettings({ xray })}
                  />
                  <PixelSwitch
                    label="Filtro CRT"
                    hint="Líneas de pantalla vieja sobre todo el sitio."
                    checked={s.crt}
                    onChange={(crt) => updateSettings({ crt })}
                  />
                  <div className="config__group">
                    <span className="config__group-label">Animaciones</span>
                    <PixelSegmented
                      label="Animaciones"
                      value={s.motion}
                      options={MOTION_OPTIONS}
                      onChange={(motion) => updateSettings({ motion })}
                    />
                  </div>
                </div>
                <button type="button" className="btn" onClick={close}>
                  Cerrar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
