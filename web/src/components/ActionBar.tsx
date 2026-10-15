import { useEffect, useId, useRef, useState } from 'react';
import { layoutActions } from '../table/actions';
import type { ActionButton } from '../table/actions';
import type { ActionId, TableView } from '../table/types';
import { PixelIcon } from './icons';

const toneClass = (b: ActionButton): string => {
  if (b.id === 'quiero') return ' btn--menta';
  if (b.id === 'noQuiero') return ' btn--brasa';
  if (b.tone === 'respuesta') return ' btn--menta';
  if (b.tone === 'mazo') return ' btn--ghost';
  return b.id === 'valeCuatro' ? ' btn--brasa' : '';
};

function Btn({ b, onAction }: { b: ActionButton; onAction: (a: ActionId) => void }) {
  return (
    <button type="button" className={`btn${toneClass(b)}`} onClick={() => onAction(b.id)}>
      {b.label}
    </button>
  );
}

/** "Envido": agrupa envido, real envido y falta envido en un menú que se abre hacia arriba. */
function EnvidoMenu({ buttons, onAction }: { buttons: ActionButton[]; onAction: (a: ActionId) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('.actionbar__menu button')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // si cambian las opciones (cambió el turno) el menú se cierra solo
  useEffect(() => {
    setOpen(false);
  }, [buttons.length]);

  return (
    <div className="actionbar__group" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="btn actionbar__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Cantar envido"
        onClick={() => setOpen((o) => !o)}
      >
        Envido
        <PixelIcon name="caret" size={16} />
      </button>
      <div id={menuId} className="actionbar__menu panel" role="group" aria-label="Envido" hidden={!open}>
        {buttons.map((b) => (
          <button
            key={b.id}
            type="button"
            className="btn"
            onClick={() => {
              setOpen(false);
              onAction(b.id);
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ActionBar({ view, onAction }: { view: TableView; onAction: (a: ActionId) => void }) {
  const l = layoutActions(view.actions, view.truco.pending !== null);
  const responding = l.respuesta.length > 0;
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

  // Responder un canto: Quiero / No quiero bien grandes y, abajo, las subidas posibles.
  if (responding) {
    const more = [...l.envido, ...l.truco, ...l.mazo];
    return (
      <div className="actionbar actionbar--respond" role="group" aria-label="Acciones">
        <div className="actionbar__row actionbar__row--answer">
          {l.respuesta.map((b) => (
            <Btn key={b.id} b={b} onAction={onAction} />
          ))}
        </div>
        {more.length > 0 ? (
          <div className="actionbar__row actionbar__row--counter">
            {more.map((b) => (
              <Btn key={b.id} b={b} onAction={onAction} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="actionbar" role="group" aria-label="Acciones">
      <div className="actionbar__row">
        {l.envido.length > 1 ? (
          <EnvidoMenu buttons={l.envido} onAction={onAction} />
        ) : (
          l.envido.map((b) => <Btn key={b.id} b={b} onAction={onAction} />)
        )}
        {l.truco.map((b) => (
          <Btn key={b.id} b={b} onAction={onAction} />
        ))}
        {l.mazo.map((b) => (
          <Btn key={b.id} b={b} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}
