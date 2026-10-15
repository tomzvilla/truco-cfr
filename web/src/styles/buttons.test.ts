import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const src = resolve(__dirname, '..');
const allCss = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith('.css'));
const cssOf = (f: string) => readFileSync(join(src, f), 'utf8');
const base = cssOf('styles/base.css');
const app = cssOf('styles/app.css');
const everything = allCss.map(cssOf).join('\n');

/** Parte el CSS en el texto de dentro y de fuera de los bloques `@media (hover: hover) { ... }`. */
function splitHover(css: string): { inside: string; outside: string } {
  let inside = '';
  let outside = '';
  let i = 0;
  const re = /@media\s*\(hover:\s*hover\)\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    outside += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    inside += css.slice(m.index + m[0].length, j - 1);
    i = j;
    re.lastIndex = j;
  }
  outside += css.slice(i);
  return { inside, outside };
}

describe('estados de los botones', () => {
  it('.btn tiene hover (dentro de @media (hover: hover)), active y focus-visible', () => {
    const { inside } = splitHover(base);
    expect(inside).toMatch(/\.btn:hover/);
    expect(base).toMatch(/\.btn:active/);
    expect(base).toMatch(/\.btn:focus-visible/);
  });
  it('ningún :hover queda fuera de @media (hover: hover): en el celular no se pega', () => {
    for (const f of allCss) {
      const { outside } = splitHover(cssOf(f));
      // las reglas de animaciones reducidas solo anulan el movimiento: pueden estar fuera
      expect(outside.replace(/:root\[data-reduced[^\n]*/g, ''), f).not.toMatch(/:hover/);
    }
  });
  it('las cartas de la mano y los links del menú también reaccionan al hover', () => {
    const { inside } = splitHover(everything);
    expect(inside).toMatch(/button\.pcard[^{]*:hover/);
    expect(inside).toMatch(/\.nav a:hover/);
  });
  it('con animaciones reducidas el hover no mueve nada (solo cambia el color)', () => {
    expect(base).toMatch(/:root\[data-reduced='true'\] \.btn:hover[^{]*\{[^}]*transform:\s*none/);
    // la carta se levanta moviendo su dibujo (.pcard__face); con animaciones reducidas, no
    expect(everything).toMatch(/:root\[data-reduced='true'\] button\.pcard[^{]*:hover \.pcard__face[^{]*\{[^}]*translate:\s*none/);
  });
  it('los links del menú tienen focus-visible propio', () => {
    expect(app).toMatch(/\.nav a:focus-visible/);
  });
});
