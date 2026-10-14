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
