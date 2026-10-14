"""El circuito de Deep CFR: recorridos en Rust, buffers en numpy, redes en PyTorch."""
from __future__ import annotations

import time

import numpy as np
import torch
import truco_engine_py as eng

from .buffers import ReservoirBuffer
from .config import Config
from .model import ScaledMlp
from .training import train_advantage, train_strategy


def unpack(batch, enc_size: int, n_actions: int):
    """Convierte los bytes que devuelve `traverse_batch` en arrays de numpy (sin copiar)."""
    adv_enc, adv_val, adv_mask, st_enc, st_val, st_mask, nodes = batch
    return (
        (
            np.frombuffer(adv_enc, dtype=np.uint8).reshape(-1, enc_size),
            np.frombuffer(adv_val, dtype="<f4").reshape(-1, n_actions),
            np.frombuffer(adv_mask, dtype="<u2"),
        ),
        (
            np.frombuffer(st_enc, dtype=np.uint8).reshape(-1, enc_size),
            np.frombuffer(st_val, dtype="<f4").reshape(-1, n_actions),
            np.frombuffer(st_mask, dtype="<u2"),
        ),
        nodes,
    )


class DeepCfr:
    def __init__(self, cfg: Config):
        cfg.validate()
        self.cfg = cfg
        self.enc_size, self.n_actions, self.scale = eng.game_info(cfg.game)
        self.device = torch.device(cfg.device)
        torch.manual_seed(cfg.seed)
        self.rng = np.random.default_rng(cfg.seed)
        self.adv_nets = [self._new_net().to(self.device) for _ in range(2)]
        self.adv_bufs = [
            ReservoirBuffer(cfg.adv_capacity, self.enc_size, self.n_actions, self.rng)
            for _ in range(2)
        ]
        self.strat_buf = ReservoirBuffer(cfg.strat_capacity, self.enc_size, self.n_actions, self.rng)
        # TCFRW1 de cada red de ventajas; None = todavía no hay (política uniforme).
        self.net_bytes: list[bytes | None] = [None, None]
        self.iteration = 0
        self.elapsed_s = 0.0
        self.last_strategy_loss: float | None = None

    def _new_net(self) -> ScaledMlp:
        return ScaledMlp(self.scale, self.cfg.hidden, self.cfg.n_hidden, self.n_actions)

    def seed_for(self, t: int, p: int, stream: int = 0) -> int:
        """Semilla determinista (menor que 2**63) para la iteración `t`, el jugador `p`."""
        ss = np.random.SeedSequence([self.cfg.seed, t, p, stream])
        return int(ss.generate_state(1, dtype=np.uint64)[0] >> np.uint64(1))

    def step(self) -> dict:
        """Una iteración de Deep CFR: para cada jugador, recorridos + entrenamiento."""
        cfg = self.cfg
        t = self.iteration + 1
        started = time.perf_counter()
        stats: dict = {"iter": t, "traversal_s": 0.0, "train_s": 0.0, "nodes": 0,
                       "adv_loss": [None, None]}
        for p in (0, 1):
            t0 = time.perf_counter()
            batch = eng.traverse_batch(
                cfg.game, p, self.seed_for(t, p), 0, cfg.traversals,
                self.net_bytes[0], self.net_bytes[1], cfg.threads,
            )
            adv, strat, nodes = unpack(batch, self.enc_size, self.n_actions)
            self.adv_bufs[p].add(*adv, t)
            self.strat_buf.add(*strat, t)
            stats["nodes"] += nodes
            t1 = time.perf_counter()
            if not cfg.warm_start:
                self.adv_nets[p] = self._new_net().to(self.device)
            stats["adv_loss"][p] = train_advantage(
                self.adv_nets[p], self.adv_bufs[p], steps=cfg.adv_steps,
                batch_size=cfg.batch_size, lr=cfg.lr, grad_clip=cfg.grad_clip,
                adv_scale=cfg.adv_scale, seed=self.seed_for(t, p, 1),
            )
            self.net_bytes[p] = self.adv_nets[p].to_bytes()
            stats["traversal_s"] += t1 - t0
            stats["train_s"] += time.perf_counter() - t1
        self.iteration = t
        self.elapsed_s += time.perf_counter() - started
        stats["buf_adv"] = [len(b) for b in self.adv_bufs]
        stats["buf_strat"] = len(self.strat_buf)
        return stats

    def train_strategy_net(self, steps: int | None = None) -> ScaledMlp:
        """Entrena la red de estrategia promedio con el buffer de estrategia."""
        cfg = self.cfg
        net = self._new_net().to(self.device)
        self.last_strategy_loss = train_strategy(
            net, self.strat_buf, steps=steps or cfg.strat_steps, batch_size=cfg.batch_size,
            lr=cfg.strat_lr, grad_clip=cfg.grad_clip, seed=self.seed_for(self.iteration, 0, 2),
        )
        return net
