import './Config.css';

interface PixelSwitchProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  /** Texto chico debajo de la etiqueta. */
  hint?: string;
}

/** Interruptor de pixeles: un botón con role="switch" (Espacio y Enter lo alternan, como cualquier botón). */
export function PixelSwitch({ label, checked, onChange, hint }: PixelSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="pswitch"
      onClick={() => onChange(!checked)}
    >
      <span className="pswitch__text">
        <span className="pswitch__label">{label}</span>
        {hint ? <span className="pswitch__hint">{hint}</span> : null}
      </span>
      <span className="pswitch__track" aria-hidden="true">
        <span className="pswitch__knob" />
        <span className="pswitch__state">{checked ? 'Sí' : 'No'}</span>
      </span>
    </button>
  );
}
