import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import './Config.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface PixelSegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

/** Elección de una entre pocas: role="radiogroup" con flechas (da la vuelta), Inicio y Fin; solo la marcada entra con Tab. */
export function PixelSegmented<T extends string>({ label, value, options, onChange }: PixelSegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (i: number) => {
    const n = options.length;
    const next = options[((i % n) + n) % n]!;
    onChange(next.value);
    refs.current[((i % n) + n) % n]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        select(i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        select(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        select(0);
        break;
      case 'End':
        e.preventDefault();
        select(options.length - 1);
        break;
    }
  };

  return (
    <div className="psegmented" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="psegmented__opt"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
