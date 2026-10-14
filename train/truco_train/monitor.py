"""Monitoreo: qué tan bien juega la política actual (barato) y el intervalo de Wilson."""
from __future__ import annotations

import math

import truco_engine_py as eng

from .config import Config


def wilson(wins: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Intervalo de Wilson al 95% para una proporción."""
    if n == 0:
        return (0.0, 1.0)
    p = wins / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, center - half), min(1.0, center + half))


def duplicate_vs(cfg: Config, opponent: str, mode: str, net0: bytes, net1: bytes | None,
                 pairs: int, seed: int) -> dict:
    wins, games = eng.eval_duplicate(opponent, mode, net0, net1, pairs, seed, cfg.threads)
    lo, hi = wilson(wins, games)
    return {"wins": wins, "games": games, "rate": wins / games, "lo": lo, "hi": hi}


def evaluate(cfg: Config, net_bytes: list[bytes | None], seed: int) -> dict:
    """Política actual por regret matching. En truco: partidos duplicados contra el
    heurístico y el azar. En los juegos chicos: explotabilidad exacta de la política actual
    (que no es la promedio, así que es ruidosa)."""
    if net_bytes[0] is None or net_bytes[1] is None:
        return {}
    if cfg.game == "truco":
        return {
            opp: duplicate_vs(cfg, opp, "advantage", net_bytes[0], net_bytes[1],
                              cfg.eval_pairs, seed)
            for opp in ("heuristic", "random")
        }
    return {"exploitability_current": eng.exploitability(cfg.game, "advantage",
                                                         net_bytes[0], net_bytes[1])}
