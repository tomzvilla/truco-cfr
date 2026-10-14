import { useEffect, useRef } from 'react';
import { hrefFor } from '../router';
import type { RouteId } from '../router';

const ITEMS: { id: RouteId; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'manos', label: 'Manos destacadas' },
];

export function Nav({ route }: { route: RouteId }) {
  const current = useRef<HTMLAnchorElement>(null);
  // En celular el menú es una fila que se desplaza: se asegura que la sección actual quede a la vista.
  useEffect(() => {
    current.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [route]);

  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map((it) => (
        <a
          key={it.id}
          ref={route === it.id ? current : undefined}
          href={hrefFor(it.id)}
          aria-current={route === it.id ? 'page' : undefined}
        >
          {it.label}
        </a>
      ))}
    </nav>
  );
}
