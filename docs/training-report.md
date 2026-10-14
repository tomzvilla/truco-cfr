# Informe de entrenamiento

Corrida `overnight-1`. Generado por `python -m truco_train report`.

## Qué se entrenó

- Algoritmo: Deep CFR con muestreo externo y ponderación lineal por iteración.
- Juego: `truco`. Red: 3 capas ocultas de 256 neuronas (ReLU), entrada de bytes por `feature_scale`.
- 590 iteraciones, 4 500 recorridos por jugador y por iteración (K), semilla 2.
- Buffers de reservorio: 4 000 000 muestras de ventaja por jugador, 8 000 000 de estrategia.
- Arranque de cada iteración: desde cero.
- Tiempo total de entrenamiento: 7.16 horas. Archivo de pesos: `strategy.tcfrw` (832 KiB, SHA-256 `194e1f83f8ccfe4a3842b5d3d00e6ba7c4f84007393bf8933827120a4a2219f7`).

## Resultados de la red de estrategia promedio

| Rival | Partidos ganados |
|---|---|
| Heurístico | 60.2% [58.1%, 62.4%] (1205/2000) |
| Azar | 91.8% [90.5%, 92.9%] (1835/2000) |

Los intervalos son de Wilson al 95%, sobre partidos completos a 30 en formato duplicado.

## Curva de aprendizaje

Política actual (regret matching sobre las redes de ventajas), medida durante el entrenamiento.

| Iteración | vs heurístico | vs azar |
|---|---|---|
| 10 | 58.8% [53.9%, 63.5%] (235/400) | 92.0% [88.9%, 94.3%] (368/400) |
| 20 | 62.5% [57.7%, 67.1%] (250/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 30 | 60.2% [55.4%, 64.9%] (241/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 40 | 62.3% [57.4%, 66.9%] (249/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 50 | 61.8% [56.9%, 66.4%] (247/400) | 91.8% [88.6%, 94.1%] (367/400) |
| 60 | 69.5% [64.8%, 73.8%] (278/400) | 92.5% [89.5%, 94.7%] (370/400) |
| 70 | 51.0% [46.1%, 55.9%] (204/400) | 94.8% [92.1%, 96.5%] (379/400) |
| 80 | 62.0% [57.2%, 66.6%] (248/400) | 93.0% [90.1%, 95.1%] (372/400) |
| 90 | 72.2% [67.7%, 76.4%] (289/400) | 92.8% [89.8%, 94.9%] (371/400) |
| 100 | 64.8% [59.9%, 69.3%] (259/400) | 91.0% [87.8%, 93.4%] (364/400) |
| 110 | 52.5% [47.6%, 57.3%] (210/400) | 94.2% [91.5%, 96.1%] (377/400) |
| 120 | 46.2% [41.4%, 51.1%] (185/400) | 94.5% [91.8%, 96.3%] (378/400) |
| 130 | 61.3% [56.4%, 65.9%] (245/400) | 91.8% [88.6%, 94.1%] (367/400) |
| 140 | 63.2% [58.4%, 67.8%] (253/400) | 92.5% [89.5%, 94.7%] (370/400) |
| 150 | 56.0% [51.1%, 60.8%] (224/400) | 94.5% [91.8%, 96.3%] (378/400) |
| 160 | 57.5% [52.6%, 62.3%] (230/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 170 | 58.8% [53.9%, 63.5%] (235/400) | 89.2% [85.8%, 91.9%] (357/400) |
| 180 | 60.0% [55.1%, 64.7%] (240/400) | 94.8% [92.1%, 96.5%] (379/400) |
| 190 | 57.5% [52.6%, 62.3%] (230/400) | 87.2% [83.6%, 90.2%] (349/400) |
| 200 | 65.8% [61.0%, 70.2%] (263/400) | 90.2% [86.9%, 92.8%] (361/400) |
| 210 | 55.5% [50.6%, 60.3%] (222/400) | 90.5% [87.2%, 93.0%] (362/400) |
| 220 | 55.2% [50.4%, 60.0%] (221/400) | 94.0% [91.2%, 95.9%] (376/400) |
| 230 | 48.5% [43.6%, 53.4%] (194/400) | 91.2% [88.1%, 93.6%] (365/400) |
| 240 | 56.0% [51.1%, 60.8%] (224/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 250 | 58.8% [53.9%, 63.5%] (235/400) | 91.8% [88.6%, 94.1%] (367/400) |
| 260 | 50.7% [45.9%, 55.6%] (203/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 270 | 50.7% [45.9%, 55.6%] (203/400) | 90.5% [87.2%, 93.0%] (362/400) |
| 280 | 60.8% [55.9%, 65.4%] (243/400) | 90.5% [87.2%, 93.0%] (362/400) |
| 290 | 58.8% [53.9%, 63.5%] (235/400) | 90.8% [87.5%, 93.2%] (363/400) |
| 300 | 57.8% [52.9%, 62.5%] (231/400) | 94.2% [91.5%, 96.1%] (377/400) |
| 310 | 59.8% [54.9%, 64.4%] (239/400) | 94.0% [91.2%, 95.9%] (376/400) |
| 320 | 63.0% [58.2%, 67.6%] (252/400) | 91.0% [87.8%, 93.4%] (364/400) |
| 330 | 58.8% [53.9%, 63.5%] (235/400) | 90.0% [86.7%, 92.6%] (360/400) |
| 340 | 52.5% [47.6%, 57.3%] (210/400) | 96.2% [93.9%, 97.7%] (385/400) |
| 350 | 62.5% [57.7%, 67.1%] (250/400) | 90.0% [86.7%, 92.6%] (360/400) |
| 360 | 60.0% [55.1%, 64.7%] (240/400) | 91.0% [87.8%, 93.4%] (364/400) |
| 370 | 61.3% [56.4%, 65.9%] (245/400) | 92.2% [89.2%, 94.5%] (369/400) |
| 380 | 55.5% [50.6%, 60.3%] (222/400) | 85.8% [82.0%, 88.8%] (343/400) |
| 390 | 56.5% [51.6%, 61.3%] (226/400) | 91.8% [88.6%, 94.1%] (367/400) |
| 400 | 61.3% [56.4%, 65.9%] (245/400) | 94.2% [91.5%, 96.1%] (377/400) |
| 410 | 61.8% [56.9%, 66.4%] (247/400) | 89.0% [85.6%, 91.7%] (356/400) |
| 420 | 51.7% [46.9%, 56.6%] (207/400) | 91.5% [88.4%, 93.9%] (366/400) |
| 430 | 68.0% [63.3%, 72.4%] (272/400) | 92.5% [89.5%, 94.7%] (370/400) |
| 440 | 59.2% [54.4%, 64.0%] (237/400) | 89.2% [85.8%, 91.9%] (357/400) |
| 450 | 68.8% [64.0%, 73.1%] (275/400) | 94.2% [91.5%, 96.1%] (377/400) |
| 460 | 53.2% [48.4%, 58.1%] (213/400) | 91.5% [88.4%, 93.9%] (366/400) |
| 470 | 70.8% [66.1%, 75.0%] (283/400) | 91.8% [88.6%, 94.1%] (367/400) |
| 480 | 66.0% [61.2%, 70.5%] (264/400) | 95.0% [92.4%, 96.7%] (380/400) |
| 490 | 60.8% [55.9%, 65.4%] (243/400) | 92.5% [89.5%, 94.7%] (370/400) |
| 500 | 72.8% [68.2%, 76.9%] (291/400) | 93.2% [90.4%, 95.3%] (373/400) |
| 510 | 63.0% [58.2%, 67.6%] (252/400) | 90.8% [87.5%, 93.2%] (363/400) |
| 520 | 67.8% [63.0%, 72.1%] (271/400) | 91.2% [88.1%, 93.6%] (365/400) |
| 530 | 68.5% [63.8%, 72.9%] (274/400) | 94.2% [91.5%, 96.1%] (377/400) |
| 540 | 68.5% [63.8%, 72.9%] (274/400) | 96.0% [93.6%, 97.5%] (384/400) |
| 550 | 59.5% [54.6%, 64.2%] (238/400) | 90.0% [86.7%, 92.6%] (360/400) |
| 560 | 63.2% [58.4%, 67.8%] (253/400) | 93.8% [90.9%, 95.7%] (375/400) |
| 570 | 63.2% [58.4%, 67.8%] (253/400) | 92.8% [89.8%, 94.9%] (371/400) |
| 580 | 65.2% [60.5%, 69.8%] (261/400) | 90.8% [87.5%, 93.2%] (363/400) |
| 590 | 65.8% [61.0%, 70.2%] (263/400) | 89.2% [85.8%, 91.9%] (357/400) |

## Observaciones

- El bot aprendió muy rápido: a la iteración 10 ya le ganaba al heurístico (59 %) y al azar (92 %). Después la
  política actual osciló entre 46 % y 73 % contra el heurístico, con un bajón entre las iteraciones 110 y 300
  (promedio ~57 %) y su mejor tramo al final (iteraciones 430 a 590, promedio ~65 %). Cada punto se mide con 400
  partidos, así que buena parte del sube y baja es ruido (±5 puntos).
- La red de estrategia promedio, que es la que se publica, le gana al heurístico el 60,2 % [58,1; 62,4] de 2 000
  partidos: el límite inferior del intervalo queda bien arriba del 50 %. Contra el azar gana el 91,8 %, por encima
  del 85 % que pide el spec.
- Lo que sorprendió: la red promedio queda unos puntos por debajo de las últimas políticas actuales. Tiene sentido,
  porque promedia todas las iteraciones (con más peso en las últimas) e incluye el tramo flojo del medio; a cambio
  es más estable y es la que, en teoría, se acerca al equilibrio.
- La corrida se cortó cinco veces porque la PC se quedó con poca memoria libre mientras se usaba para otras cosas
  (en las iteraciones 188, 300, 400, 542 y 550; la de la 400 fue una parada pedida a mano). Cada vez se retomó con
  `resume` desde el último checkpoint, y las iteraciones perdidas (151 a 188 y 501 a 542) se volvieron a calcular.

## Limitaciones

- La explotabilidad exacta solo se calcula en Kuhn y MiniTruco. En el truco completo no se calcula;
  la medida de fuerza es el rendimiento contra el heurístico propio y contra el azar.
- Es una sola corrida con una sola semilla: no hay intervalos de confianza entre corridas.
- Todos los números de este informe salen de `runs/overnight-1/metrics.jsonl` y `final.json`.
