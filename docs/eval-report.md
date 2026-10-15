# Informe de evaluación

Modelo: `models/strategy.tcfrw` (red de estrategia promedio de la corrida `overnight-1`, SHA-256
`194e1f83…`), jugada con `PolicyKind::Strategy` (muestrea de la política). Corridas del 2026-10-14
y 2026-10-15 con `truco-eval` (rama `plan-3-eval`).

## Torneo

Partidos completos a 30 en formato duplicado: cada reparto se juega dos veces y el bot cambia de
asiento, así la suerte de las cartas se compensa. Los puntos por mano son los del bot menos los del
rival; su intervalo sale de un bootstrap que remuestrea pares enteros (2000 remuestras).

| Rival | Partidos | Ganados por el bot | Wilson 95 % | Puntos por mano | IC 95 % |
|---|---|---|---|---|---|
| Azar | 2000 | 1818 = 90,9 % | [89,6; 92,1] | +1,38 | [+1,32; +1,45] |
| Heurístico propio | 2000 | 1268 = 63,4 % | [61,3; 65,5] | +0,14 | [+0,13; +0,16] |
| Claude Haiku | 100 | 59 = 59,0 % | [49,2; 68,1] | +0,23 | [+0,04; +0,42] |

**Criterio 3 del spec** (límite inferior de Wilson por encima del 50 %): cumplido contra el azar
(89,6 %) y contra el heurístico (61,3 %). Contra el heurístico el entrenamiento había medido 60,2 %
[58,1; 62,4] con otras semillas de reparto; la diferencia (3,2 puntos) es de unos dos errores estándar: probable
variación de muestreo, aunque no se descarta del todo un efecto de las semillas.

**Contra Claude Haiku** (no lo exige el spec): con 100 partidos el bot ganó el 59 %, pero el
intervalo de Wilson toca el 50 % (49,2 %), así que la ventaja en partidos no es concluyente. En
puntos por mano el intervalo [+0,04; +0,42] apenas excluye el cero: hay ventaja, con 50 pares de
evidencia.

- Modelo exacto: `claude-haiku-5-5`, vía Claude Code 2.1 (`claude -p`) con la suscripción, sin
  API key. Corrida del 2026-10-14 (22:09 UTC) al 2026-10-15 (02:30 UTC), con 6 llamadas en paralelo y
  una pausa en el medio. La sesión retomada jugó 10 pares en 31 minutos (unos 10 segundos por
  decisión en cada hilo).
- La corrida se cortó una vez (la protección de memoria de Claude Code la detuvo con 40 de 50 pares
  completos) y se retomó con `--resume true`: no se rejugó ningún par.
- Fallbacks (jugada prudente por falta de respuesta válida): **0** en la sesión retomada (contador
  del JSON). De la primera sesión se revisó la salida con 30 de sus 40 pares jugados y no había
  ningún mensaje de error de Claude; la salida de los últimos 10 pares se perdió con un reinicio de
  WSL y no se puede verificar. El torneo se corta solo tras 5 fallbacks seguidos, y no se cortó.
- Decisiones y costo: el archivo `tournament-haiku.json` cuenta solo la sesión retomada (20
  partidos): 1055 decisiones, US$ 0,87 a precio de lista. En la sesión retomada cada acción de Haiku
  fue una consulta (1055 de 1055); en los 100 partidos jugó 4947 acciones, así que el costo total
  de lista es de unos US$ 4,07. Con la suscripción no se pagó aparte; consumió cupo.

## Faroleo

20 000 manos del bot contra sí mismo, con puntajes iniciales al azar como en el entrenamiento
(`sample_scores`). Para cada situación se registra la probabilidad que da la red y la jugada que
efectivamente muestreó.

### Curva del envido

Probabilidad promedio de cantar (envido, real envido o falta envido) en la primera oportunidad de
envido de cada jugador en la mano, según sus tantos. "Pie" cuenta solo las manos en que el mano no
cantó envido antes (incluye las veces en que el pie contesta un truco en la primera baza).

| Tantos | Mano | Pie |
|---|---|---|
| 0–3 | 14,5 % | 28,5 % |
| 4–7 | 38,5 % | 54,6 % |
| 20–26 | 61,2 % | 71,5 % |
| 27–30 | 85,7 % | 88,0 % |
| 31–33 | 95,5 % | 94,5 % |

(Promedios ponderados por la cantidad de situaciones de cada casillero; la curva completa, casillero
por casillero, está en `eval/results/bluff.json`.)

La curva sube con los tantos, como corresponde, pero no arranca en cero: con 7 tantos canta incluso
un poco más que con 21 (mano: 48,9 % contra 45,3 %; pie: 63,0 % contra 60,0 %).

### Envido con 7 o menos (criterio 5)

| Rol | Situaciones | Cantó | Frecuencia | Probabilidad de la red |
|---|---|---|---|---|
| Mano | 8063 | 2709 | 33,6 % | 33,4 % |
| Pie | 3478 | 1683 | 48,4 % | 49,3 % |
| Todos | 11 541 | 4392 | 38,1 % | 38,2 % |

**Criterio 5 del spec** (la probabilidad de cantar envido con 7 o menos es mayor que cero):
cumplido con holgura. No es ruido del softmax: el bot efectivamente canta en más de un tercio de
esas manos.

### Contención con 31 o más

Con 31, 32 o 33 tantos se calla (no canta en su primera oportunidad) el 4,1 % de las veces (mano
4,2 %, pie 4,0 %): esconde poco las manos muy buenas.

### Truco y retruco con mano floja

"Mano floja" = una mano del 30 % más flojo según su fuerza (ver Limitaciones).

| Quién | Cantos de truco o retruco | Con mano floja | Proporción | Wilson 95 % |
|---|---|---|---|---|
| Bot | 16 299 | 2838 | 17,4 % | [16,8; 18,0] |
| Heurístico | 3781 | 0 | 0,0 % | [0,0; 0,1] |

En el 38,7 % de esos faroles del bot (1097 de 2838) el rival, que era el mismo bot, contestó "no
quiero".

## Manos destacadas

Faroles exitosos en los registros del torneo: el bot canta truco, retruco o vale cuatro con una mano
del 30 % más flojo, o envido con 7 o menos, y el rival contesta "no quiero" o se va al mazo en la
jugada siguiente.

| Rival | Manos | Faroles de truco | Faroles de envido |
|---|---|---|---|
| Heurístico | 43 256 | 2969 | 5054 |
| Claude Haiku | 1350 | 29 | 47 |

Haiku se achica mucho menos que el heurístico cuando el bot canta:

| Canto del bot | Contra el heurístico | Contra Haiku |
|---|---|---|
| Envido con 7 o menos: el rival no quiere o se va | 5054 de 6340 = 79,7 % | 47 de 147 = 32,0 % |
| Cualquier truco, retruco o vale cuatro del bot (con cualquier mano): el rival no quiere o se va | 15 493 de 19 225 = 80,6 % | 145 de 522 = 27,8 % |

(Contra Haiku la muestra es chica: 100 partidos.)

`eval/results/highlights.json` guarda, para cada rival, los 3 faroles de truco y los 2 de envido con las manos más flojas (`highlights --per-rival true --top-truco 3 --top-envido 2`).

Un ejemplo contra Haiku: el bot es pie con 10 de copa, 4 de espada y 4 de copa, una de las peores
manos posibles (percentil 0,3 %). Haiku abre con el 4 de oro; el bot canta envido (24 tantos, ese
sí honesto) y Haiku quiere. El bot gana la primera baza con el 10, canta truco con un 4 de espada y
un 4 de copa en la mano, y Haiku no quiere. El bot se lleva 3 puntos.

Otro, contra el heurístico: el bot es mano con 12 de espada, 11 de basto y 11 de copa (0 tantos),
canta envido de entrada y el heurístico no quiere.

## Limitaciones

- No hay rivales de terceros (decisión del 2026-10-14): el heurístico es propio y Haiku es una IA de
  lenguaje general, no un jugador de truco. Tampoco se comparó el motor con otros motores: las reglas
  están cubiertas por los 105 tests del motor.
- Contra Haiku se jugaron 100 partidos (no 2000) porque cada decisión tarda unos 10 segundos: el
  intervalo es más ancho. Haiku decide sin memoria entre jugadas, con la situación descripta en texto,
  y su resultado no es reproducible (el modelo muestrea sus respuestas).
- El intervalo de Wilson trata los partidos como independientes aunque se juegan en pares
  duplicados. El de puntos por mano sí remuestrea pares enteros.
- La fuerza de una mano es una equidad heurística: la probabilidad de ganar las bazas contra una mano
  al azar si los dos tiran cartas con la regla del heurístico y nadie canta (300 simulaciones por mano
  y rol). Se mide sobre las tres cartas repartidas, no en el momento del canto: un truco cantado
  después de jugar la carta buena cuenta según la mano completa.
- La proporción de faroles de truco cuenta truco y retruco; las manos destacadas también incluyen el
  vale cuatro.
- "Se achicó" mira solo la respuesta inmediata al canto: si el rival contesta un truco cantando envido
  y después no quiere el truco, no se cuenta. La tasa del 38,7 % y la cantidad de manos destacadas
  pueden estar un poco por debajo de lo real.
- `pointsWon` en las manos destacadas son los puntos del bot en toda la mano, no solo los del farol.
- Los contadores de `tournament-haiku.json` (decisiones, fallbacks, costo) cubren solo la sesión
  retomada; los totales de arriba se reconstruyeron desde los registros y la salida de las dos sesiones.

## Reproducir

```bash
cargo build --release -p truco-eval
B=target/release/truco-eval
$B tournament --rivals random,heuristic --pairs 1000 --seed 2026 --threads 8
$B bluff --hands 20000 --seed 11
# Haiku: unas 2 h de juego con 6 hilos; si se corta, el mismo comando con --resume true
$B tournament --rivals haiku --pairs 50 --seed 2026 --threads 6 \
  --claude /mnt/c/Users/tomzv/.local/bin/claude.exe
$B highlights --rivals heuristic,haiku --per-rival true --top-truco 3 --top-envido 2
```
