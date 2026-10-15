import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

describe('index.html', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  it('enlaza un favicon propio que existe en public/ (así no hay 404 de /favicon.ico)', () => {
    const m = html.match(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/);
    expect(m, 'falta <link rel="icon">').not.toBeNull();
    const href = m![1]!.replace(/^\//, '');
    expect(existsSync(resolve(root, 'public', href)), href).toBe(true);
  });
  it('el favicon es SVG pixel art propio (sin imágenes externas)', () => {
    const m = html.match(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/)!;
    const svg = readFileSync(resolve(root, 'public', m[1]!.replace(/^\//, '')), 'utf8');
    expect(svg).toMatch(/<svg/);
    expect(svg).toMatch(/shape-rendering="crispEdges"/);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
  it('ningún href ni src empieza con / (el sitio se sirve desde una subcarpeta)', () => {
    expect(html).not.toMatch(/(href|src)="\//);
  });
});
