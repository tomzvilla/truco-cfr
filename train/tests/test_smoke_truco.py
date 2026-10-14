"""Smoke test: 2 iteraciones de Deep CFR en el truco completo, de punta a punta."""
import json

import pytest
import torch
import truco_engine_py as eng

from truco_train.run import start
from truco_train.weights import read_tcfrw1

from .helpers import tiny_truco_config


def test_two_iterations_produce_every_artifact(tiny_run):
    metrics = [json.loads(line) for line in (tiny_run / "metrics.jsonl").read_text().splitlines()]
    assert [m["iter"] for m in metrics] == [1, 2]
    for m in metrics:
        assert m["nodes"] > 0 and m["buf_strat"] > 0 and min(m["buf_adv"]) > 0
        assert all(loss == loss for loss in m["adv_loss"]), "pérdida NaN"
    # eval_every=1: desde la iteración 1 hay resultados contra heurístico y azar.
    for m in metrics:
        for opp in ("heuristic", "random"):
            r = m["eval"][opp]
            assert r["games"] == 6 and 0 <= r["wins"] <= 6 and r["lo"] <= r["rate"] <= r["hi"]
    final = json.loads((tiny_run / "final.json").read_text())
    assert final["iterations"] == 2 and final["vs_heuristic"]["games"] == 6
    assert len(final["strategy_sha256"]) == 64
    assert (tiny_run / "config.json").exists()
    assert (tiny_run / "checkpoint" / "state.pt").exists()


def test_exported_strategy_is_a_valid_tcfrw1_that_rust_can_play(tiny_run):
    data = (tiny_run / "strategy.tcfrw").read_bytes()
    layers, scale = read_tcfrw1(data)
    assert len(scale) == 304 and layers[0][0].shape[1] == 304 and layers[-1][0].shape[0] == 12
    wins, games = eng.eval_duplicate("random", "strategy", data, None, 2, 0, 1)
    assert games == 4


@pytest.mark.skipif(not torch.cuda.is_available(), reason="sin GPU")
def test_the_same_smoke_run_works_on_the_gpu(tmp_path):
    run_dir = start(tiny_truco_config(device="cuda"), tmp_path, run_id="gpu")
    assert (run_dir / "strategy.tcfrw").exists()
