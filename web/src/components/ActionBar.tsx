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
