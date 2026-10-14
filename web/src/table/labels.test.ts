import { describe, it, expect } from 'vitest';
import { ACTION_IDS, MOODS } from './types';
import { ACTION_LABEL, CALL_LABEL, cardLabel, moodLine } from './labels';

describe('textos', () => {
  it('cardLabel', () => {
    expect(cardLabel({ suit: 'espada', number: 1 })).toBe('1 de espadas');
    expect(cardLabel({ suit: 'oro', number: 10 })).toBe('Sota de oros');
    expect(cardLabel({ suit: 'copa', number: 11 })).toBe('Caballo de copas');
    expect(cardLabel({ suit: 'basto', number: 12 })).toBe('Rey de bastos');
  });
  it('todas las acciones tienen etiqueta distinta y no vacía', () => {
    const labels = ACTION_IDS.map((id) => ACTION_LABEL[id]);
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(12);
  });
  it('todos los cantos tienen nombre', () => {
    expect(CALL_LABEL.valeCuatro).toBe('vale cuatro');
    expect(CALL_LABEL.realEnvido).toBe('real envido');
  });
  it('todos los ánimos tienen frase', () => {
    for (const m of MOODS) expect(moodLine(m).length).toBeGreaterThan(5);
  });
});
