import { describe, it, expect } from 'vitest';
import { layoutActions } from './actions';
import { FIXTURES } from './fixtures';

const ids = (l: { id: string }[]) => l.map((b) => b.id);

describe('layoutActions', () => {
  it('inicio de mano: cartas, envidos, truco y mazo; ninguna respuesta', () => {
    const l = layoutActions(FIXTURES.inicioDeMano.actions, false);
    expect(l.cartas).toEqual(['jugar0', 'jugar1', 'jugar2']);
    expect(l.respuesta).toEqual([]);
    expect(ids(l.envido)).toEqual(['envido', 'realEnvido', 'faltaEnvido']);
    expect(ids(l.truco)).toEqual(['truco']);
    expect(ids(l.mazo)).toEqual(['mazo']);
  });
  it('truco pendiente: responder y subir con la etiqueta "Quiero retruco"', () => {
    const l = layoutActions(FIXTURES.trucoPendiente.actions, true);
    expect(ids(l.respuesta)).toEqual(['quiero', 'noQuiero']);
    expect(l.truco).toEqual([{ id: 'retruco', label: 'Quiero retruco', tone: 'truco' }]);
  });
  it('sin canto pendiente el retruco se llama simplemente Retruco', () => {
    expect(layoutActions(['retruco', 'valeCuatro'], false).truco.map((b) => b.label)).toEqual(['Retruco', 'Vale cuatro']);
    expect(layoutActions(['valeCuatro'], true).truco.map((b) => b.label)).toEqual(['Quiero vale cuatro']);
  });
  it('turno del bot: todo vacío', () => {
    const l = layoutActions([], false);
    expect(l).toEqual({ cartas: [], respuesta: [], envido: [], truco: [], mazo: [] });
  });
});
