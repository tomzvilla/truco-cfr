import { xrayRows } from '../logic/xray';
import type { XRayEntry } from '../table/types';

export function XRayPanel({ entries }: { entries?: XRayEntry[] }) {
  const rows = xrayRows(entries);
  return (
    <section className="xray panel" aria-label="Rayos X del bot">
      <h2>Rayos X</h2>
      {rows.length === 0 ? (
        <p>Todavía no hay datos: el bot no decidió nada en esta mano.</p>
      ) : (
        <>
          <p className="xray__hint">Así de probable era cada jugada del bot en su última decisión.</p>
          <ul className="xray__list">
            {rows.map((r) => (
              <li key={r.action}>
                <span className="xray__label">{r.label}</span>
                <span className="xray__bar" aria-hidden="true">
                  <span style={{ width: `${r.widthPct}%` }} />
                </span>
                <span className="xray__pct">{r.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
