import { describe, it, expect } from 'vitest';
import { HOW_LEAD, HOW_SECTIONS } from './howItWorks';

const all = [HOW_LEAD, ...HOW_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs])].join('\n');

describe('texto de "Cómo funciona"', () => {
  it('tiene las 6 secciones con texto real', () => {
    expect(HOW_SECTIONS.map((s) => s.id)).toEqual(['que-es', 'arrepentimiento', 'nash', 'farol', 'rust-wasm-gpu', 'limites']);
    for (const s of HOW_SECTIONS) {
      expect(s.paragraphs.length).toBeGreaterThanOrEqual(2);
      for (const p of s.paragraphs) expect(p.length).toBeGreaterThan(60);
    }
  });
  it('explica todos los conceptos pedidos', () => {
    for (const re of [
      /arrepentimiento contrafáctico/i, /Nash/, /piedra, papel o tijera/i, /No es un LLM/, /fine-tuning/,
      /desde cero/, /farol/i, /Rust/, /GPU/, /WASM/,
    ]) {
      expect(all).toMatch(re);
    }
  });
  it('no quedan marcas de texto pendiente (sin la bandera i: "método" contiene "todo")', () => {
    expect(all).not.toMatch(/\bTODO\b|\bTBD\b|lorem|completar/);
  });
  it('la regla detecta marcas reales y no falsos positivos', () => {
    const re = /\bTODO\b|\bTBD\b|lorem|completar/;
    expect(re.test('falta TODO esto')).toBe(true);
    expect(re.test('lorem ipsum')).toBe(true);
    expect(re.test('el método y todo lo demás')).toBe(false);
  });
});
