import { hrefFor } from '../router';
import type { RouteId } from '../router';

const ITEMS: { id: RouteId; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'manos', label: 'Manos destacadas' },
];

export function Nav({ route }: { route: RouteId }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map((it) => (
        <a key={it.id} href={hrefFor(it.id)} aria-current={route === it.id ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
