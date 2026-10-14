"""Validación de Deep CFR en los juegos chicos (spec 3.2, etapas 1 y 2).

Son los tests lentos de verdad (30 a 60 segundos cada uno, en CPU y con un solo hilo).
Si en otra máquina el de Kuhn da entre 0,01 y 0,02, subir `iterations` (nunca el umbral).
"""
import dataclasses

import truco_engine_py as eng

from truco_train.config import Config
from truco_train.deepcfr import DeepCfr


def small_game_config(game: str, **overrides) -> Config:
    base = dataclasses.asdict(Config())
    base.update(
        game=game, seed=1, threads=1, hidden=64, n_hidden=2, adv_capacity=2_000_000,
        strat_capacity=2_000_000, adv_steps=100, batch_size=2048, lr=2e-3, adv_scale=2.0,
        strat_steps=2000, device="cpu",
    )
    base.update(overrides)
    return Config.from_dict(base)


def strategy_exploitability(dcfr: DeepCfr) -> float:
    net = dcfr.train_strategy_net()
    return eng.exploitability(dcfr.cfg.game, "strategy", net.to_bytes())


def test_deep_cfr_reaches_exploitability_below_0_01_on_kuhn():
    dcfr = DeepCfr(small_game_config("kuhn", traversals=20_000))
    for _ in range(60):
        dcfr.step()
    expl = strategy_exploitability(dcfr)
    assert expl < 0.01, f"explotabilidad de la red de estrategia en Kuhn: {expl:.4f}"


def test_deep_cfr_exploitability_decreases_on_minitruco():
    dcfr = DeepCfr(small_game_config("minitruco", traversals=5_000))
    for _ in range(10):
        dcfr.step()
    early = strategy_exploitability(dcfr)
    for _ in range(30):
        dcfr.step()
    late = strategy_exploitability(dcfr)
    assert late < early / 2, f"early={early:.4f} late={late:.4f}"
    assert late < 0.05, f"explotabilidad final en MiniTruco: {late:.4f}"
