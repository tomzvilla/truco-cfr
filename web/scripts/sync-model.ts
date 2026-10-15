// Copia la red publicada (models/strategy.tcfrw, en la raíz del repo) a public/models/ para que Vite
// la sirva. La copia no se versiona (la raíz ignora *.tcfrw salvo models/strategy.tcfrw).
import { copyFileSync, mkdirSync } from 'node:fs';

const src = new URL('../../models/strategy.tcfrw', import.meta.url);
const dir = new URL('../public/models/', import.meta.url);
mkdirSync(dir, { recursive: true });
copyFileSync(src, new URL('strategy.tcfrw', dir));
console.log('modelo copiado a public/models/strategy.tcfrw');
