import { actionIndex } from '../table/types';
import type { TableView } from '../table/types';
import type { FromEngine, ToEngine } from './protocol';

/** Lo que el Worker usa de `WasmMatch` (el partido en Rust). Las vistas vienen como JSON. */
export interface MatchApi {
  view(): string;
  botToMove(): boolean;
  act(action: number): string;
  botStep(): string;
  newHand(): string;
  newMatch(seed: number): string;
}

export interface SessionDeps {
  /** Crea el partido (en el Worker: bajar el modelo y construir `WasmMatch`). */
  load(modelUrl: string, seed: number): Promise<MatchApi>;
  post(msg: FromEngine): void;
  /** Pausa antes de cada jugada del bot (en el Worker, de 400 a 900 ms; en los tests, nada). */
  think(): Promise<void>;
}

/**
 * Atiende los mensajes de a uno, en orden: lo que llega mientras el bot "piensa" espera su turno.
 * Devuelve la función que recibe cada mensaje (la promesa se resuelve cuando terminó de atenderlo).
 */
export function createSession(deps: SessionDeps): (msg: ToEngine) => Promise<void> {
  let match: MatchApi | null = null;
  let queue: Promise<void> = Promise.resolve();
  // mensajes aceptados que todavía no terminaron (incluye las pausas del bot)
  let pending = 0;

  const send = (json: string) => deps.post({ type: 'view', view: JSON.parse(json) as TableView });

  const botTurn = async (m: MatchApi) => {
    while (m.botToMove()) {
      await deps.think();
      send(m.botStep());
    }
  };

  const handle = async (msg: ToEngine) => {
    if (msg.type === 'init') {
      match = await deps.load(msg.modelUrl, msg.seed);
      send(match.view());
      await botTurn(match);
      return;
    }
    if (!match) throw new Error('El motor todavía no está listo');
    if (msg.type === 'act') {
      // un clic viejo (doble clic, o mientras el bot pensaba) no es un error: se ignora
      const current = JSON.parse(match.view()) as TableView;
      if (!current.actions.includes(msg.action)) return;
      send(match.act(actionIndex(msg.action)));
    } else if (msg.type === 'newHand') {
      send(match.newHand());
    } else {
      send(match.newMatch(msg.seed));
    }
    await botTurn(match);
  };

  return (msg) => {
    // una jugada que llega mientras se atiende otro mensaje (doble clic, o el bot pensando) se ignora:
    // quien la mandó miraba una vista que ya no vale. Además, `handle` revisa la legalidad con la vista al ejecutar.
    if (msg.type === 'act' && pending > 0) return queue;
    pending += 1;
    queue = queue
      .then(() => handle(msg))
      .catch((e: unknown) => {
        deps.post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => {
        pending -= 1;
      });
    return queue;
  };
}
