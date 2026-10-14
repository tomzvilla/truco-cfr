export interface HowSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const HOW_LEAD =
  "Un bot de truco que se entrenó solo y que aprendió a mentir. Acá te explicamos cómo, sin vueltas y sin fórmulas.";

export const HOW_SECTIONS: HowSection[] = [
  {
    id: "que-es",
    title: "Qué es este bot (y qué no es)",
    paragraphs: [
      "Este bot juega al truco uno contra uno, a 30 puntos. Nadie le explicó estrategias ni le mostró partidas de personas: aprendió solo, jugando millones de manos contra sí mismo.",
      "No es un LLM. No lee ni escribe texto, no hay ningún prompt y no pasó por un fine-tuning de un modelo grande. Es una red neuronal chica, entrenada desde cero, que recibe un montón de números (tus cartas, lo que se jugó, el marcador, los cantos) y devuelve un puñado de probabilidades: cuánto le conviene jugar cada carta, cantar o irse al mazo.",
      "Como es tan chica (unos cientos de miles de números ajustables, en un archivo de uno o dos megas), corre entera en tu navegador. No hay un servidor pensando por él: una vez que carga la página, juega sin conexión.",
    ],
  },
  {
    id: "arrepentimiento",
    title: "Cómo aprende: arrepentimiento contrafáctico",
    paragraphs: [
      "El método se llama CFR, por Counterfactual Regret Minimization. En criollo: minimizar el arrepentimiento contrafáctico. Suena a filosofía, pero la idea es de sobremesa.",
      "Pensá en alguien que, después de cada mano, se repasa: «si en vez de irme al mazo hubiera cantado truco, ¿cuántos puntos más habría sacado?». Esa diferencia es el arrepentimiento. Y «contrafáctico» quiere decir justamente eso: de lo que no hice. El bot compara lo que hizo con lo que podría haber hecho en la misma situación.",
      "Ese arrepentimiento se va sumando mano tras mano, situación por situación. Y la regla para decidir es simple: elegí cada jugada en proporción a cuánto te arrepentís de no haberla elegido. Si cantar envido con 29 de tanto te rindió más que callarte, el arrepentimiento por callarte crece, y la próxima vez cantás más seguido.",
      "El truco tiene demasiadas situaciones posibles para anotarlas todas en una libreta. Ahí entra la red neuronal: en vez de memorizar cada situación, aprende a estimar el arrepentimiento para situaciones parecidas. Esa versión se llama Deep CFR.",
    ],
  },
  {
    id: "nash",
    title: "Equilibrio de Nash: la estrategia que no se puede explotar",
    paragraphs: [
      "Si repetís ese proceso muchísimas veces, el promedio de las estrategias del bot se acerca a un equilibrio de Nash: una forma de jugar tal que, aunque el rival sepa exactamente cómo jugás, no tiene ninguna contra-estrategia que le gane de manera sostenida.",
      "Pensalo con piedra, papel o tijera. Si jugás siempre piedra, el otro te gana siempre con papel. El equilibrio es elegir cada una un tercio de las veces, al azar. No es la mejor jugada contra cada rival en particular: es la que no deja ganar a ninguno a la larga.",
      "En juegos con información oculta, como el truco, el equilibrio casi siempre es mezclado: ante la misma situación, el bot a veces hace una cosa y a veces otra, con ciertas probabilidades. Con el botón de Rayos X de la mesa ves esas probabilidades.",
      "Una aclaración honesta: en el truco completo no podemos calcular exactamente qué tan cerca del equilibrio quedó el bot. En versiones chiquitas del juego sí, y ahí se mide y se publica (mirá la sección Resultados).",
    ],
  },
  {
    id: "farol",
    title: "Por qué aprende a farolear",
    paragraphs: [
      "Nadie le enseñó a mentir. Pensá qué pasaría si el bot cantara envido solo con tantos buenos, digamos 27 para arriba. Lo leerías al toque: «canta, entonces tiene». Cuando cantara, vos no aceptarías sin buenos tantos; cuando no cantara, sabrías que está flojo. Una jugada predecible es una jugada explotable.",
      "El equilibrio lo resuelve mezclando: con algunas manos flojas el bot también canta, de vez en cuando. Así su «envido» casi no te dice nada de lo que tiene. Y con tantos muy buenos a veces se queda callado, por el mismo motivo. Farolear, acá, es la forma matemática de no regalar información.",
      "Probalo en la curva de abajo. Muestra qué tan seguido el bot canta envido según sus tantos. Si fuera un bot de reglas fijas, la curva sería cero hasta cierto número y uno de ahí en adelante. La del bot tiene un piso con tantos bajos (las barras rojas): ese piso es el farol.",
    ],
  },
  {
    id: "rust-wasm-gpu",
    title: "Qué hacen Rust, la GPU y WASM",
    paragraphs: [
      "Rust es el lenguaje del motor: las reglas del truco, el simulador de manos y el árbitro. Es muy rápido, así que puede jugar millones de manos por hora, y es estricto, así que cuesta que se cuelen errores. Si alguien intenta una jugada ilegal, el motor la rechaza.",
      "La GPU (la placa de video) hace la parte pesada del aprendizaje: ajustar los números de la red. Es un trabajo de multiplicar matrices enormes en paralelo, y las placas de video están hechas justo para eso. El entrenamiento corrió en una sola placa de una PC de escritorio.",
      "WASM (WebAssembly) es una forma de correr código escrito en lenguajes como Rust dentro del navegador, casi a la velocidad de una app instalada. Gracias a eso el mismo motor que entrenó al bot corre en tu celular, y no hace falta un servidor (ni pagarlo).",
    ],
  },
  {
    id: "limites",
    title: "Lo que no sabemos",
    paragraphs: [
      "El bot no es invencible. Aprendió contra copias de sí mismo, y una persona con mañas raras puede encontrarle debilidades que nunca vio. En el torneo lo medimos contra otros bots, con intervalos de confianza para que la suerte no nos engañe.",
      "El bot no ve tus cartas: decide solo con lo que apareció en la mesa, igual que vos. Y juega una variante puntual: uno contra uno, a 30 puntos y sin flor.",
      "Las probabilidades del modo Rayos X son las que el bot usa de verdad para elegir su jugada. No son «lo que piensa» de tu mano ni una opinión sobre si la suya es buena o mala.",
    ],
  },
];
