"""Los archivos de `configs/` que se entregan tienen que ser válidos."""
from pathlib import Path

import pytest

from truco_train.config import Config

CONFIGS = sorted((Path(__file__).resolve().parent.parent / "configs").glob("*.toml"))


def test_the_shipped_configs_exist():
    assert {p.stem for p in CONFIGS} == {"smoke", "short", "overnight", "minitruco"}


@pytest.mark.parametrize("path", CONFIGS, ids=lambda p: p.stem)
def test_every_shipped_config_parses_and_validates(path):
    cfg = Config.from_toml(path)
    assert cfg.game == ("minitruco" if path.stem == "minitruco" else "truco")
    assert cfg.traversals >= 1000


def test_overnight_fits_in_the_wsl_memory_budget():
    cfg = Config.from_toml(next(p for p in CONFIGS if p.stem == "overnight"))
    # u8 (304) + f32 (12 * 4) + u16 + i32 por muestra; la estrategia usa lo mismo.
    per_sample = 304 + 12 * 4 + 2 + 4
    gb = (2 * cfg.adv_capacity + cfg.strat_capacity) * per_sample / 1e9
    assert gb < 8.0, f"los buffers ocupan {gb:.1f} GB"


@pytest.mark.parametrize("stem", ["short", "overnight"])
def test_long_runs_retrain_advantage_nets_from_scratch(stem):
    # Medido en la Tarea 10: con warm_start la política actual se degradaba
    # (short-1: red final 39 % vs heurístico, 74 % vs azar); desde cero no
    # (short-2: 48 % y 87 %, mismas semillas y K).
    cfg = Config.from_toml(next(p for p in CONFIGS if p.stem == stem))
    assert cfg.warm_start is False
