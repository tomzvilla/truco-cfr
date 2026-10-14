"""Mide la velocidad real de los recorridos (Rust, 8 hilos) y del entrenamiento (GPU) en truco
completo, y recomienda `traversals` (K) para un tiempo de iteración objetivo.

    uv run --no-sync python scripts/bench_traversal.py --hidden 256 --threads 8 --k 2000
    uv run --no-sync python scripts/bench_traversal.py --checkpoint runs/<id>   # con redes entrenadas

Con redes recién inicializadas los recorridos son más rápidos o más lentos que con redes
entrenadas (cambia cuántas jugadas se exploran): repetir con `--checkpoint` cuando haya uno.
"""
from __future__ import annotations

import argparse
import dataclasses
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # para importar truco_train

import truco_engine_py as eng  # noqa: E402

from truco_train.buffers import ReservoirBuffer
from truco_train.checkpoint import load_checkpoint
from truco_train.config import Config
from truco_train.deepcfr import DeepCfr, unpack
from truco_train.training import train_advantage


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--n-hidden", type=int, default=3)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--k", type=int, default=2000, help="recorridos a medir")
    ap.add_argument("--batch-size", type=int, default=4096)
    ap.add_argument("--adv-steps", type=int, default=2000)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--target-iter-seconds", type=float, default=40.0)
    ap.add_argument("--checkpoint", type=Path, default=None, help="carpeta de una corrida")
    args = ap.parse_args()

    cfg = Config.from_dict(dict(
        hidden=args.hidden, n_hidden=args.n_hidden, threads=args.threads,
        batch_size=args.batch_size, adv_steps=args.adv_steps, device=args.device,
    ))
    if args.checkpoint:
        dcfr = load_checkpoint(args.checkpoint, Config.from_json((args.checkpoint / "config.json").read_text()))
        cfg = dcfr.cfg
        nets = dcfr.net_bytes
        origin = f"redes del checkpoint (iteración {dcfr.iteration})"
    else:
        dcfr = DeepCfr(cfg)
        nets = [n.to_bytes() for n in dcfr.adv_nets]
        origin = "redes recién inicializadas"

    eng.traverse_batch("truco", 0, 1, 0, args.threads * 4, nets[0], nets[1], args.threads)  # calentar
    t0 = time.perf_counter()
    batch = eng.traverse_batch("truco", 0, 2, 0, args.k, nets[0], nets[1], args.threads)
    secs = time.perf_counter() - t0
    adv, strat, nodes = unpack(batch, dcfr.enc_size, dcfr.n_actions)

    trav_per_s = args.k / secs
    print(f"Recorridos ({origin}, red {cfg.n_hidden}x{cfg.hidden}, {args.threads} hilos):")
    print(f"  {trav_per_s:,.0f} recorridos/s  ({secs:.1f} s para {args.k})")
    print(f"  {nodes / args.k:.0f} nodos de decisión por recorrido, "
          f"{secs * args.threads * 1e6 / nodes:.1f} µs por nodo y por hilo")
    print(f"  {len(adv[2]) / args.k:.1f} muestras de ventaja y {len(strat[2]) / args.k:.1f} de estrategia por recorrido")

    buf = ReservoirBuffer(max(len(adv[2]), 1), dcfr.enc_size, dcfr.n_actions, dcfr.rng)
    buf.add(*adv, 1)
    net = dcfr._new_net().to(dcfr.device)
    train_advantage(net, buf, steps=5, batch_size=cfg.batch_size, lr=cfg.lr, grad_clip=cfg.grad_clip,
                    adv_scale=cfg.adv_scale, seed=0)  # calentar la GPU
    t0 = time.perf_counter()
    train_advantage(net, buf, steps=cfg.adv_steps, batch_size=cfg.batch_size, lr=cfg.lr,
                    grad_clip=cfg.grad_clip, adv_scale=cfg.adv_scale, seed=0)
    train_s = time.perf_counter() - t0
    print(f"Entrenamiento: {cfg.adv_steps} pasos de {cfg.batch_size} en {train_s:.1f} s "
          f"({cfg.adv_steps / train_s:,.0f} pasos/s)")

    k_target = max(100, int(trav_per_s * (args.target_iter_seconds - 2 * train_s) / 2))
    adv_per_iter = len(adv[2]) / args.k * k_target
    print(f"Para una iteración de ~{args.target_iter_seconds:.0f} s (2 jugadores):")
    print(f"  traversals (K) = {k_target:,}")
    print(f"  el buffer de ventajas ({cfg.adv_capacity:,}) se llena en {cfg.adv_capacity / adv_per_iter:.1f} iteraciones")
    print(f"  iteraciones en 30 min: {1800 / args.target_iter_seconds:.0f}; en 9 h: {32400 / args.target_iter_seconds:.0f}")
    print("config sugerida: " + str(dataclasses.asdict(dataclasses.replace(cfg, traversals=k_target))))


if __name__ == "__main__":
    main()
