# Benchmarks del motor

Fecha: 2026-10-13. Máquina: AMD Ryzen 7 9800X3D (8 núcleos / 8 hilos en WSL), RTX 5070 Ti, 15 GB de RAM visibles dentro de WSL (la máquina tiene más). Perfil release con `target-cpu=native`.

Comando: `cargo run --release -p truco-engine --example bench`

```
motor (1 hilo): 1929475 manos/s, 8499700 decisiones/s, 4.4 decisiones por mano
MLP 3×128: 21.6 µs por forward (1 hilo), checksum 0.051
MLP 3×256: 67.1 µs por forward (1 hilo), checksum 0.083
```

Nota: las 4.4 decisiones por mano son de jugadores al azar (las manos terminan rápido por los "no quiero" y los mazos); el forward del MLP reserva vectores temporales en cada llamada, así que hay margen de mejora si hiciera falta.

## Estimación para el Plan 2

`recorridos/s ≈ 8 hilos × 1e6 / (µs_forward × nodos_por_recorrido)`, con `nodos_por_recorrido ≈ 150`:

- Red 3×128: 8e6 / (21.6 × 150) ≈ 2 470 recorridos/s
- Red 3×256: 8e6 / (67.1 × 150) ≈ 795 recorridos/s

Las referencias esperadas (más de 1 M de decisiones/s en el motor y menos de 100 µs por forward con la red de 256) se cumplen con holgura.

## Mediciones reales de Deep CFR (Plan 2)

Redes recién inicializadas, 8 hilos, truco completo (`train/scripts/bench_traversal.py`):

| Red | Recorridos/s | Nodos por recorrido | µs por nodo y por hilo |
|-----|--------------|---------------------|------------------------|
| 3×128 | 1 979 | 134 | 30 |
| 3×256 | 1 516 | 59 | 90 |

Entrenamiento en la GPU: ~640 pasos/s con lotes de 4 096 (3×128 y 3×256 por igual: lo limita el lanzamiento de kernels, no la aritmética).

Con redes ya entrenadas (3×128, corrida corta de 22 iteraciones) los recorridos son más largos y la velocidad baja a ~600 recorridos/s: **la estimación de la sección anterior (2 470 y 795) es optimista**. Fórmula para elegir K (recorridos por jugador y por iteración):

`K = recorridos_por_s × (segundos_por_iteración − 2 × segundos_de_entrenamiento) / 2`

Volver a medir con `scripts/bench_traversal.py --checkpoint runs/<id>` cuando exista una corrida corta.

Medición repetida al implementar (`scripts/bench_traversal.py --k 2000`, redes recién inicializadas, 8 hilos): 3×256 = 1 397 recorridos/s, 59 nodos por recorrido, 97 µs por nodo y por hilo, 612 pasos/s de entrenamiento; 3×128 = 1 811 recorridos/s, 133 nodos, 33 µs, 478 pasos/s. Quedan dentro de ±30 % de la tabla.

Nota: la primera tabla de esta sección es la medición al planificar y el párrafo de arriba la repetición al implementar; difieren por ruido de medición (±30 %).

### Con redes entrenadas (Tarea 10)

- 3×128 entrenada (short-2, 82 iteraciones): 577 recorridos/s, 324 nodos por recorrido, 43 µs por nodo y por hilo; entrenamiento 626 pasos/s.
- 3×256 entrenada (probe-256, 16 iteraciones): 185 recorridos/s, 366 nodos por recorrido, 118 µs por nodo y por hilo; entrenamiento 607 pasos/s.
- Elegido para la noche: 3×256 (185 ≥ 150), K = 185 × (55 − 2 × 3,5) / 2 ≈ 4 440 → 4 500 por jugador, 590 iteraciones (32 400 s / 55 s; manda `time_budget_s`), y `warm_start = false`: con warm start la política se degradaba (short-1: red final 38,7 % contra el heurístico y 73,7 % contra el azar) y desde cero no (short-2, misma config salvo eso: 48,3 % y 86,8 %, 1 000 partidos cada uno).
