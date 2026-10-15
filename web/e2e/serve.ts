import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const BASE = '/truco-cfr/';
const PORT = Number(process.env.PORT ?? 4190);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8', '.tcfrw': 'application/octet-stream',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  let path = normalize(join(ROOT, url.pathname.slice(BASE.length)));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`sirviendo dist/ en http://localhost:${PORT}${BASE}`));
