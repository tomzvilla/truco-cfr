import { MOOD_LINE } from './labels';
import type { TableView } from './types';

/**
 * Lo que dice Fosfo en la burbuja. Las frases de cada canto son las mismas tenga buenas cartas
 * o esté mintiendo: si no, la burbuja delataría el farol. El farol se confiesa al final de la mano.
 */
export const BOT_PHRASES = {
  truco: [
    '¡Truco! Y no me vengas con cuentos.',
    '¡Truco, paisano! A ver si te animás.',
    '¡Truco! Que se arme el baile.',
    '¡Truco, y que tiemble el rancho!',
  ],
  retruco: [
    '¡Quiero retruco! ¿O te achicás?',
    '¡Retruco! Acá no se arruga nadie.',
    '¡Retruco, y con ganas!',
  ],
  valeCuatro: [
    '¡Quiero vale cuatro! A todo o nada.',
    '¡Vale cuatro, y el que pierde ceba el mate!',
    '¡Vale cuatro! Que sea lo que Dios quiera.',
  ],
  envido: [
    'Envido, que la tengo en el bolsillo.',
    '¡Envido! Contá tus tantos, paisano.',
    'Envido, y no te hagas el distraído.',
    '¡Envido! A ver esos tantos.',
  ],
  realEnvido: [
    '¡Real envido! Esto se pone lindo.',
    '¡Real envido, compadre!',
    'Real envido, que hoy estoy de suerte.',
  ],
  faltaEnvido: [
    '¡Falta envido! Me juego el poncho.',
    '¡Falta envido! A matar o morir.',
    '¡Falta envido, y que sea lo que sea!',
  ],
  quiero: [
    '¡Quiero! Mostrá lo que tenés.',
    '¡Quiero, y vale el rancho!',
    'Quiero. A ver si es cierto.',
    '¡Quiero! No me asustás.',
  ],
  noQuiero: [
    'No quiero, paisano. Otra vez será.',
    'No quiero. Hoy no es mi día.',
    'No quiero… guardate esa.',
  ],
  mazo: ['Me voy al mazo. Esta no es para mí.', 'Al mazo. Ya vendrán tiempos mejores.'],
  pensando: ['Mmm… dejame pensar.', 'A ver, a ver…', 'Uh, me agarraste cebando mate.'],
  confiesa: ['¡Te la creíste! No tenía nada.', 'Je, era puro cuento.', '¡Puro chamuyo, paisano!'],
  descubierto: ['Uy… me cazaste mintiendo.', 'Me vieron la hilacha.'],
  gana: ['¡Esta mano es mía!', '¡Tomá mate, paisano!', 'Así se juega en el campo.'],
  pierde: ['Bien jugado. Revancha.', 'Me ganaste esta. La próxima es mía.'],
  pareja: ['Pareja. Vamos de nuevo.'],
  neutral: ['Dale, jugá.', 'Te toca, paisano.', 'A ver qué tenés.'],
} as const;

type Pool = keyof typeof BOT_PHRASES;

/** Elige siempre la misma frase para la misma situación (no cambia en cada render) y varía entre manos. */
function pick(pool: Pool, v: TableView): string {
  const list = BOT_PHRASES[pool];
  const handSum = v.hand.reduce((acc, h) => acc + h.card.number, 0);
  const seed =
    v.score[0] * 7 + v.score[1] * 13 + v.tricks.length * 5 + v.envido.calls.length * 3 + v.truco.acceptedLevel + handSum;
  return list[seed % list.length]!;
}

const END_POOL: Record<TableView['mood'], Pool> = {
  farol: 'confiesa',
  descubierto: 'descubierto',
  gana: 'gana',
  pierde: 'pierde',
  neutral: 'pareja',
};

export function botLine(v: TableView): string {
  if (v.phase === 'finDeMano') return pick(END_POOL[v.mood], v);
  const last = v.last;
  if (last?.by === 'bot' && last.action in BOT_PHRASES) return pick(last.action as Pool, v);
  // en las repeticiones el humor de farol se muestra a mitad de mano (ahí la idea es verlo)
  if (v.mood === 'farol') return MOOD_LINE.farol;
  const myCall = v.truco.pending?.by === 'yo' || v.envido.pending?.by === 'yo';
  if (myCall) return pick('pensando', v);
  return pick('neutral', v);
}
