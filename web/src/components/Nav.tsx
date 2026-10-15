import { useEffect, useId, useRef, useState } from 'react';
import { hrefFor } from '../router';
import type { RouteId } from '../router';
import { PixelIcon } from './icons';

const ITEMS: { id: RouteId; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'manos', label: 'Manos destacadas' },
];

interface NavProps {
  route: RouteId;
  /** Si hay una partida en pantalla, el menú ofrece "Nuevo partido". */
  onNewMatch?: (() => void) | null;
}

/**
 * Navegación del sitio. Desde 720 px es una fila de enlaces; en pantallas más angostas el CSS la oculta y aparece el
 * botón de hamburguesa que abre un panel con los mismos enlaces (y "Nuevo partido" si hay partida). El panel siempre está
 * en el DOM pero con `hidden` mientras está cerrado, así `aria-controls` apunta a algo real.
 */
export function Nav({ route, onNewMatch }: NavProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  // al abrir: el foco va al primer enlace
  useEffect(() => {
    if (open) drawer.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  // Esc y clic afuera lo cierran
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!drawer.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // cambiar de sección cierra el menú
  useEffect(() => {
    setOpen(false);
  }, [route]);

  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [route]);

  const links = (ref?: boolean) =>
    ITEMS.map((it) => (
      <a
        key={it.id}
        ref={ref && route === it.id ? current : undefined}
        href={hrefFor(it.id)}
        aria-current={route === it.id ? 'page' : undefined}
        onClick={() => setOpen(false)}
      >
        {it.label}
      </a>
    ));

  return (
    <>
      <nav className="nav" aria-label="Secciones">
        {links(true)}
      </nav>
      <button
        ref={button}
        type="button"
        className="btn btn--icon nav__burger"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((o) => !o)}
      >
        <PixelIcon name={open ? 'close' : 'menu'} />
      </button>
      <div ref={drawer} id={drawerId} className="drawer panel" hidden={!open}>
        <nav aria-label="Menú">{links()}</nav>
        {onNewMatch ? (
          <button
            type="button"
            className="btn btn--brasa drawer__new"
            onClick={() => {
              setOpen(false);
              onNewMatch();
            }}
          >
            Nuevo partido
          </button>
        ) : null}
      </div>
    </>
  );
}
