import { useState } from 'react';
import { Mascot } from '../art/Mascot';
import { Mesa } from '../components/Mesa';
import { PixelCard } from '../components/PixelCard';
import { DEFAULT_SKIN } from '../skins';
import { FIXTURES, FIXTURE_NAMES } from '../table/fixtures';
import type { FixtureName } from '../table/fixtures';
import { actionLabel } from '../table/labels';
import { MOODS, allCards, cardKey } from '../table/types';
import type { ActionId, Mood, TableView } from '../table/types';
import './Playground.css';

/** Los ids de las situaciones quedan como están (son claves de FIXTURES); acá se muestran en español. */
const FIXTURE_LABEL: Record<FixtureName, string> = {
  inicioDeMano: 'Inicio de mano',
  envidoPendiente: 'Envido pendiente',
  trucoPendiente: 'Truco pendiente',
  finDeManoRayosX: 'Fin de mano con rayos X',
};

export function Playground() {
  const [name, setName] = useState<FixtureName>('inicioDeMano');
  const [mood, setMood] = useState<Mood>(FIXTURES.inicioDeMano.mood);
  const [score, setScore] = useState<readonly [number, number]>(FIXTURES.inicioDeMano.score);
  const [xray, setXray] = useState(true);
  const [log, setLog] = useState<ActionId[]>([]);
  const [vale, setVale] = useState(false);

  const pick = (n: FixtureName) => {
    setName(n);
    setMood(FIXTURES[n].mood);
    setScore(FIXTURES[n].score);
    setVale(false);
  };
  const base = { ...FIXTURES[name], mood, score };
  // "Probar vale cuatro" simula que el bot lo canta: la mesa tiembla.
  const view: TableView = vale
    ? {
        ...base,
        phase: 'jugando',
        truco: { acceptedLevel: 3, pending: { call: 'valeCuatro', by: 'bot' } },
        actions: ['quiero', 'noQuiero'],
      }
    : base;

  return (
    <article className="page playground">
      <h1>Banco de pruebas</h1>
      <p>Banco de pruebas visual con datos falsos. Sirve para revisar el arte y los efectos sin motor.</p>

      <div className="playground__controls panel">
        <label htmlFor="pg-fixture">Situación</label>
        <select id="pg-fixture" value={name} onChange={(e) => pick(e.target.value as FixtureName)}>
          {FIXTURE_NAMES.map((n) => (
            <option key={n} value={n}>{FIXTURE_LABEL[n]}</option>
          ))}
        </select>
        <label htmlFor="pg-mood">Ánimo de la mascota</label>
        <select id="pg-mood" value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="playground__check">
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} />
          <span>Rayos X</span>
        </label>
        <div className="playground__buttons">
          <button type="button" className="btn" onClick={() => setScore([Math.min(30, score[0] + 2), score[1]])}>
            Sumarte 2 puntos
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setScore([score[0], Math.min(30, score[1] + 1)])}>
            Sumarle 1 al bot
          </button>
          <button type="button" className="btn btn--brasa" onClick={() => setVale((v) => !v)}>
            {vale ? 'Quitar vale cuatro' : 'Probar vale cuatro'}
          </button>
        </div>
        <p data-testid="action-log" aria-live="polite">
          Últimas acciones: {log.length ? log.map((a) => actionLabel(a).toLowerCase()).join(', ') : 'ninguna'}
        </p>
      </div>

      <Mesa view={view} skin={DEFAULT_SKIN} xrayOn={xray} onAction={(a) => setLog((l) => [a, ...l].slice(0, 5))} />

      <h2>Mascota</h2>
      <div className="playground__moods">
        {MOODS.map((m) => (
          <figure key={m}>
            <Mascot mood={m} scale={6} />
            <figcaption>{m}</figcaption>
          </figure>
        ))}
      </div>

      <h2>Dorso</h2>
      <PixelCard card={null} skin={DEFAULT_SKIN} scale={2} variant="table" />

      <h2>Baraja completa (40 cartas)</h2>
      <p className="playground__credit">{DEFAULT_SKIN.credit}. Si ves una carta con texto en vez de dibujo, falta ese PNG.</p>
      <div className="deck">
        {allCards().map((c) => (
          <PixelCard key={cardKey(c)} card={c} skin={DEFAULT_SKIN} scale={1} variant="table" />
        ))}
      </div>
    </article>
  );
}
