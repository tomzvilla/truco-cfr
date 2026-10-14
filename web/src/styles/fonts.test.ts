import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const src = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(src, p), 'utf8');
const allCss = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith('.css'));

describe('tipografía', () => {
  const main = read('main.tsx');
  // pesos que algún CSS pide para Pixelify Sans (font: <peso> <tamaño> var(--font-display) o font-weight en h1-h3)
  const css = allCss.map((f) => readFileSync(join(src, f), 'utf8')).join('\n');
  const used = new Set([...css.matchAll(/font:\s*(\d{3})\s[^;]*var\(--font-display\)/g)].map((m) => m[1]));

  it('se cargan los pesos de Pixelify Sans que el CSS usa (nada de negrita sintética)', () => {
    expect(used.size).toBeGreaterThan(0);
    for (const w of used) expect(main, `peso ${w}`).toMatch(new RegExp(`pixelify-sans/latin-${w}\\.css`));
  });
  it('los títulos no piden un peso que no se carga', () => {
    const m = read('styles/base.css').match(/h1, h2, h3 \{[^}]*font-weight:\s*(\d{3})/);
    expect(m).not.toBeNull();
    expect(main).toMatch(new RegExp(`pixelify-sans/latin-${m![1]}\\.css`));
  });
  it('Pixelify Sans solo se usa en peso 400: con negrita la C se cierra y parece una O', () => {
    expect([...used]).toEqual(['400']);
  });
  it('el CSS desactiva la síntesis de fuentes', () => {
    expect(read('styles/base.css')).toMatch(/font-synthesis:\s*none/);
  });
});

describe('números legibles (nunca en Pixelify Sans)', () => {
  const css = allCss.map((f) => readFileSync(join(src, f), 'utf8')).join('\n');
  const ruleOf = (selector: string) => {
    const esc = selector.replace(/[.]/g, '\\.');
    const m = css.match(new RegExp(`(?:^|\\n|\\})\\s*${esc}\\s*\\{([^}]*)\\}`));
    expect(m, `regla ${selector}`).not.toBeNull();
    return m![1]!;
  };
  it.each(['.score__num', '.burst__label', '.curve__value', '.xray__pct', '.pcard__fallback'])(
    '%s usa la fuente del cuerpo, en negrita y con cifras tabulares',
    (sel) => {
      const body = ruleOf(sel);
      expect(body).not.toMatch(/var\(--font-display\)/);
      expect(body).toMatch(/font:\s*700\s[^;]*var\(--font-body\)/);
      expect(body).toMatch(/font-variant-numeric:\s*tabular-nums/);
    },
  );
  it('por las dudas, los dígitos de cualquier texto en Pixelify caen en Atkinson (unicode-range)', () => {
    const base = read('styles/base.css');
    expect(base).toMatch(/@font-face\s*\{[^}]*Atkinson Digits[^}]*unicode-range:\s*U\+0030-0039/);
    expect(base).toMatch(/--font-display:\s*'Atkinson Digits',\s*'Pixelify Sans'/);
  });
});
