# truco-cfr — Diseño

**Fecha:** 2026-10-13
**Estado:** borrador para revisión

## 1. Objetivo

Proyecto personal open source para mostrar en LinkedIn: un bot de **truco argentino 1 contra 1** entrenado **desde cero** con **Deep CFR** (aprende jugando contra sí mismo, sin datos humanos), que se juega en el navegador sin servidor y viene con evidencia: un torneo contra otros bots y un análisis de cómo aprendió a farolear.

**Gancho:** "Entrené una IA que te gana al truco… y aprendió a mentir sola".

**Restricciones:**
- Costo de mantenimiento cero: sitio estático, el modelo corre en el navegador.
- Unas 48 h de construcción (la cuenta de Claude se renueva el 2026-10-15; no es un límite duro).
- Entrenamiento local en una RTX 5070 Ti (16 GB), CPU de 8 hilos y 31 GB de RAM.
- Todo se desarrolla dentro de WSL Ubuntu.
- Nada pago.

**Qué ya existe** (relevado el 2026-10-13):
- `nicovon24/truco-bot`: MCCFR tabular, que solo funciona sin envido y pierde contra el heurístico. Deep CFR y PPO no terminaron de entrenar (falta de memoria). Sin licencia.
- `stefanolomo/trucobot`: PPO, sin resultados. Sin licencia.
- `andycufari/ai-truco`: LLMs jugando entre sí.
- `marianogappa/truco`: motor y bot de reglas en Go, licencia MIT.

**Diferencial:** juego completo, con un entrenamiento que converge de forma verificable, jugable desde un link, con torneo y con análisis de faroleo.

### Criterios de éxito

1. El motor pasa todos los tests de reglas. Las diferencias con el motor de marianogappa están explicadas.
2. CFR en Kuhn poker llega a una explotabilidad < 0,01. En el mini-truco la explotabilidad exacta decrece de forma monótona (salvo ruido) y termina debajo de 0,05 puntos por mano.
3. En el torneo, el bot le gana al bot al azar y al heurístico propio con el **límite inferior del IC 95% por encima del 50%** de partidos ganados. Contra el bot de marianogappa ese es el objetivo, pero no está garantizado.
4. La web se puede jugar en el celular, el bot responde en menos de 300 ms y el sitio pesa menos de 5 MB.
5. Hay evidencia cuantitativa de faroleo: la probabilidad de cantar envido con 7 de tanto o menos es mayor que cero.
6. Quedan publicados el repo, el modelo en Hugging Face, el sitio, el borrador del post y el guion del video.

## 2. Reglas (truco 1 contra 1, a 30, sin flor)

- **Mazo:** 40 cartas (1–7, 10–12 de cada palo). Jerarquía de mayor a menor: 1♠, 1♣, 7♠, 7♦(oro), treses, doses, 1♥(copa) y 1♦(oro), reyes, caballos, sotas, 7♥ y 7♣, seises, cincos, cuatros.
- **Partido:** a 30 puntos (15 malas y 15 buenas). Termina en el momento en que alguien llega a 30, aunque sea en mitad de una mano (por ejemplo, con un envido).
- **Cálculo del envido:** con dos cartas del mismo palo, 20 + sus valores (las figuras valen 0). Si no, el valor de la carta más alta (las figuras valen 0).
- **Cantos de envido:** envido (2), envido-envido (2+2), real envido (3), falta envido, y sus combinaciones en ese orden. Si te dicen "no quiero", ganás la suma de lo aceptado antes del último canto, o 1 si fue el primero.
- **Falta envido:** si el que va ganando tiene menos de 15, el ganador del envido gana el partido. Si no, vale 30 menos el puntaje del que va ganando.
- **Cuándo se canta envido:** solo durante la primera baza, antes de que quien canta haya jugado su carta. **El envido va primero:** ante un truco en la primera baza, el que responde puede cantar envido. Una vez resuelto el envido, queda pendiente responder el truco. Si el truco ya fue aceptado, el envido queda cerrado.
- **Cantar los tantos:** es automático. El mano declara sus tantos (son públicos). El pie revela los suyos solo si son mayores; si no, dice "son buenas" y no revela nada. Nadie puede mentir con el número.
- **Truco:** truco (2), retruco (3), vale cuatro (4). Solo puede subir quien dijo el último "quiero", y en su turno. Con "no quiero", el que cantó gana el valor anterior.
- **Pardas:** si la primera es parda, gana el que gane la segunda. Si la segunda es parda, gana el que ganó la primera. Si después de una primera parda la segunda también es parda, define la tercera. Si todas son pardas, gana el mano.
- **Irse al mazo:** el rival se lleva el valor vigente del truco (1 si no se cantó). Si te vas en la primera baza sin que se haya jugado el envido, se lleva 1 más.
- **Alternancia:** el mano se alterna en cada mano.

## 3. Arquitectura

Todo vive en `~/projects/truco-cfr` (WSL), en un monorepo:

```
engine/        crate Rust: reglas, estado, acciones, observación, codificación, forward del MLP, CFR genérico
engine-py/     bindings PyO3 (maturin): recorridos en paralelo, devuelven arrays numpy
engine-wasm/   wasm-bindgen: estado de juego + política para el navegador
train/         Python 3.12 + uv + PyTorch (CUDA 12.8): loop de Deep CFR, buffers, checkpoints, export
eval/          torneo, adaptadores de rivales, análisis de faroleo, gráficos
web/           Vite + React + TypeScript, sitio estático
docs/          spec, plan, informe, "cómo funciona"
third_party/   (en .gitignore) clones locales de rivales sin licencia
```

**Interfaz única de agente:** `act(observación) → acción`. La implementan el bot CFR, el bot al azar, el heurístico propio, los adaptadores de rivales externos y, en la v2, un adaptador de LLM. El motor Rust siempre hace de árbitro.

### 3.1 Motor (`engine/`)

- **Trait `Game`, genérico:** `State` compacto y copiable; `current_player()` (incluye el azar); `legal_actions() -> u16` (máscara de bits); `apply(action)`; `is_terminal()`; `returns() -> [f32; 2]`; `infoset(player) -> InfoSet` compacto; `encode(&InfoSet, &mut [f32])`.
- **Tres implementaciones:** `Truco` (juego completo), `MiniTruco` y `Kuhn`. El código de CFR y de evaluación es genérico sobre el trait.
- **Acciones de truco (12, fijas):** `Jugar0`, `Jugar1`, `Jugar2` (índices sobre la mano original ordenada por jerarquía), `Envido`, `RealEnvido`, `FaltaEnvido`, `Truco`, `Retruco`, `ValeCuatro`, `Quiero`, `NoQuiero`, `Mazo`. Las transiciones automáticas (cantar los tantos, cerrar la baza) las resuelve el motor sin acción de ningún jugador.
- **Unidad de entrenamiento:** una **mano**, con el puntaje de inicio como parte del estado. La recompensa son los puntos netos de la mano, limitados por lo que falta para 30. Un partido completo es una sucesión de manos que arma un `MatchRunner` aparte.
- **Codificación (unos 300 floats):** las 3 cartas propias en one-hot de 40, las cartas jugadas por cada jugador en cada baza, quién ganó cada baza, la historia de cantos y respuestas (truco y envido), quién es mano, el puntaje propio y el del rival normalizados, si se está en malas o buenas, y los tantos revelados.
- **MLP en Rust:** solo el forward, en f32, con pesos en un formato binario propio (encabezado + matrices) que exporta Python. Se usa durante los recorridos y en el WASM.

### 3.2 Entrenamiento (`train/` + `engine-py/`)

**Algoritmo:** Deep CFR (Brown et al., 2019) con muestreo externo (external-sampling MCCFR) y ponderación lineal por iteración.

Cada iteración `t`, para cada jugador `p`:
1. Rust ejecuta `K` recorridos en paralelo con rayon sobre los 8 hilos. Las decisiones se toman por regret matching sobre la salida de la red de ventajas actual de cada jugador, que se evalúa en Rust. Los recorridos devuelven:
   - **Muestras de ventaja** `(infoset compacto, regrets[12], máscara, t)` para el jugador `p`.
   - **Muestras de estrategia** `(infoset compacto, estrategia[12], máscara, t)` de los nodos del rival.
2. Python agrega las muestras a buffers de reservorio que guardan el infoset compacto en enteros, no ya codificado.
3. Se entrena la red de ventajas de `p` en la GPU, con MSE ponderado por `t` y enmascarado a las acciones legales. Por configuración puede arrancar desde cero (como en el paper) o desde los pesos anteriores (más rápido). El default es arrancar desde los pesos anteriores.
4. Se exportan los pesos a Rust para la iteración siguiente.

**Al final**, se entrena la **red de estrategia promedio** con el buffer de estrategia (cross-entropy ponderada por `t`). Esa es la red que se publica.

**Parámetros por defecto** (se ajustan después del benchmark):
- MLP de 3 capas ocultas de 256 neuronas con ReLU. Si los recorridos resultan lentos, se baja a 128.
- `K` = 20 000 recorridos por jugador por iteración.
- Buffers de 4 M muestras de ventaja por jugador y 8 M de estrategia.
- Puntaje inicial de cada mano: uniforme sobre [0, 29]², con un 30% de manos que arrancan en 0–0.

**Checkpoints y reanudación:** se guardan cada `N` iteraciones (pesos, buffers comprimidos y estado del RNG). Un comando `resume` retoma desde el último.

**Monitoreo:** cada `N` iteraciones se juegan 1000 manos en formato duplicado contra el heurístico y contra el bot al azar. Las métricas se guardan en `runs/<id>/metrics.jsonl` y de ahí sale la curva de aprendizaje.

**Validación por etapas:**
1. **Kuhn**, con CFR tabular y con Deep CFR: la explotabilidad exacta tiene que bajar de 0,01. Es un test automático.
2. **MiniTruco:** mazo de 6 cartas, 1 carta por jugador, una sola baza, solo truco/retruco/quiero/no quiero/mazo. Se calcula la explotabilidad exacta recorriendo todo el árbol en Rust, y tiene que decrecer.
3. **Benchmark de velocidad** de los recorridos en truco completo antes de fijar `K` y el tamaño de la red.
4. **Corrida corta** de unos 30 minutos y después **corrida larga** de 8–10 horas, de noche.

### 3.3 Evaluación (`eval/`)

- **Torneo:** partidos completos a 30 en formato duplicado (cada reparto se juega dos veces con los asientos invertidos, usando una semilla de reparto por partido). Son 2000 partidos por rival.
- **Métricas:** porcentaje de partidos ganados con IC de Wilson al 95%, y puntos netos por mano con IC por bootstrap.
- **Rivales:**
  - Al azar, como control.
  - **Heurístico propio:** canta envido con 27 o más tantos (real envido con 30 o más); acepta envido con 26 o más; canta truco con dos cartas de las 6 más altas; acepta truco con al menos una; juega la carta más baja que gana la baza, o la más baja si no puede ganarla.
  - **Bot de marianogappa** (`examplebot/newbot`), a través de un puente en Go que habla JSON por stdin/stdout, con la flor desactivada.
  - **Heurístico de nicovon24**, corriendo localmente desde `third_party/` (no se copia su código).
- **Traducción en adaptadores:** el estado y las acciones se traducen en ambos sentidos. Si un rival externo propone una jugada que nuestras reglas no permiten, el adaptador elige la jugada legal más parecida, se cuenta como "fallback" y se informa.
- **Salida:** `eval/results/*.json`, versionado, y de ahí salen las tablas y gráficos de la web.

**Análisis de faroleo:** se consulta directamente la red de estrategia sobre situaciones muestreadas.
- **Curva del envido:** probabilidad de cantar envido, real envido o falta envido como primer canto según los tantos propios, separada para mano y pie.
- **Faroleo en el truco:** la **fuerza de la mano** se mide con una simulación Monte Carlo: se reparten manos al azar al rival y ambos juegan cartas con la regla del heurístico. Es una equidad heurística y se documenta como tal. Se reporta qué porcentaje de los cantos de truco y retruco salen del 30% de manos más flojas.
- **Contención:** qué porcentaje de las veces no canta envido teniendo 31 o más.
- **Manos destacadas:** búsqueda automática en los registros del torneo de faroles exitosos (canto con mano en el 30% más flojo y el rival dice "no quiero" o se va al mazo), exportados como repeticiones.

**Explotabilidad:** es exacta en Kuhn y en MiniTruco. En el truco completo no se calcula y se dice explícitamente. Un "bot cazador" que busque sus debilidades queda para la v2.

### 3.4 Web (`web/`)

- **Stack:** Vite + React + TypeScript. El motor y la política corren en un **Web Worker** con `engine-wasm`; los pesos se cargan como binario (unos 1–2 MB).
- **Secciones:**
  1. **Jugar:** mesa, tus cartas, botones de canto contextuales, marcador a 30 con fosforitos. **Modo rayos X:** probabilidades del bot para cada acción y sus cartas al terminar la mano. El bot hace una pausa de 400–900 ms para "pensar".
  2. **Cómo funciona:** explicación simple de CFR, del equilibrio y del faroleo, con la curva del envido interactiva.
  3. **Resultados:** tabla del torneo, curva de aprendizaje y explotabilidad del MiniTruco.
  4. **Manos destacadas:** repeticiones.
- **Estética Balatro:** pixel art escalado sin suavizado (`image-rendering: pixelated`), fondo con remolino animado (fragment shader WebGL propio y liviano, con fallback CSS), filtro CRT opcional, cartas que se balancean y se inclinan siguiendo el puntero o el toque, "pop" al jugar, números que explotan al sumar puntos y temblor de pantalla con el vale cuatro. Se respeta `prefers-reduced-motion`.
- **Arte:**
  - **Caras de las cartas:** "Spanish Deck – Pixel Art" de jcanabal, edición gratuita (73×113 PNG). La licencia permite usarlas y modificarlas en cualquier proyecto digital; solo prohíbe redistribuirlas como pack de assets por separado. Por eso: crédito visible en la web y el README ("Card art by Jose Angel Canabal"), y un `web/public/cards/LICENSE-ART.md` que aclara que el arte no es MIT y no puede extraerse como pack independiente.
  - **Hecho por nosotros:** el personaje del bot en pixel art (original, sin marcas de terceros), con reacciones (neutral, farol, descubierto, gana, pierde), el dorso de las cartas y el fondo.
  - **Skins:** las cartas se cargan a través de una interfaz `CardSkin`, así se puede sumar o cambiar un mazo sin tocar el resto.
- **Mobile-first:** se puede jugar con una mano en un celular de 360 px de ancho.
- **Idioma:** la web en español.
- **Deploy:** sitio estático independiente del hosting. Por defecto Vercel (gratis); el dominio se decide al final.

### 3.5 Publicación

- **Código:** licencia MIT. Créditos a terceros en `NOTICE`.
- **README:** en inglés, con la sección "Cómo funciona" también en español.
- **Hugging Face:** pesos (safetensors), ONNX y una ficha del modelo con método, configuración, resultados y limitaciones.
- **Para LinkedIn:** borrador del post y guion de video de 30–45 s. El video lo graba el usuario.

## 4. Testing

- **Rust:** tests unitarios por regla y casos tabla para envido y pardas. Tests de propiedades con `proptest`: miles de manos al azar donde los puntos son consistentes, la mano siempre termina y las acciones legales nunca están vacías en un nodo de decisión.
- **Comparación con marianogappa:** escenarios fijos y manos al azar con las mismas cartas y las mismas acciones, comparando acciones legales y puntos. Las diferencias por variantes de reglas se documentan en `docs/rules-diff.md`.
- **Convergencia:** Kuhn y MiniTruco como tests automáticos rápidos (menos de 1 minuto).
- **Python:** tests de buffers y codificación, y una corrida de entrenamiento mínima (2 iteraciones) como smoke test.
- **Exportación:** paridad entre el forward de PyTorch, el de Rust, el de ONNX y el de WASM (`|Δ| < 1e-4`) sobre un set fijo de entradas.
- **Web:** vitest para la lógica de UI y un smoke test e2e con Playwright para jugar una mano completa.
- **CI:** GitHub Actions con `cargo test`, `pytest` (smoke) y `web build`.

## 5. Entorno

- **WSL Ubuntu:** `rustup` (stable + target `wasm32-unknown-unknown`), `wasm-pack`, `uv` (Python 3.12), `maturin`, PyTorch con CUDA 12.8 (necesario para Blackwell, sm_120), Go (para el puente con marianogappa) y Node 24.
- **Primera verificación:** `torch.cuda.is_available()` dentro de WSL y un matmul en la GPU.

## 6. Cronograma y prioridades

| Bloque | Contenido |
|---|---|
| Día 1, tarde | Entorno; motor + tests; CFR en Kuhn. En paralelo: esqueleto de la web y del skin, heurístico, puente Go |
| Día 1, noche | Circuito de Deep CFR, MiniTruco, benchmark, corrida corta → corrida larga de noche |
| Día 2 | Torneo, análisis de faroleo, integración en la web, resultados, README, Hugging Face |
| Día 3, mañana | Pulido, deploy, post y guion |

**Prioridades** (si hay que recortar, se corta de abajo hacia arriba):
1. Motor correcto y testeado
2. Entrenamiento que converge
3. Web jugable
4. Torneo contra el bot al azar y el heurístico
5. Análisis de faroleo y modo rayos X
6. Rivales externos
7. Manos destacadas
8. Extra: "lo que el bot cree que tenés"

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El bot no le gana al heurístico a la mañana | Seguir entrenando de día y ajustar `K`, el tamaño de la red y el learning rate; en el peor caso, publicar resultados honestos |
| Los recorridos son lentos | Benchmark temprano; red de 128; menos `K`; perfilar el motor |
| Problemas de CUDA o Blackwell en WSL | Es la primera verificación del día 1 |
| La traducción de reglas con los rivales externos lleva mucho tiempo | Se bajan de prioridad: se usan solo para contrastar reglas |

## 8. Fuera de alcance (v1)

Flor, partidos de 4 jugadores, benchmark contra LLMs (es la v2), bot cazador, multijugador online, cuentas de usuario y la inferencia de "lo que el bot cree que tenés" (solo si sobra tiempo).
