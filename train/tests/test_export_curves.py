import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_curves  # noqa: E402


def write_run(tmp_path, lines, final=None):
    (tmp_path / "metrics.jsonl").write_text("\n".join(json.dumps(x) for x in lines) + "\n")
    if final is not None:
        (tmp_path / "final.json").write_text(json.dumps(final))
    return tmp_path


def ev(rate_h, rate_r):
    return {"heuristic": {"wins": 1, "games": 400, "rate": rate_h, "lo": rate_h - 0.05, "hi": rate_h + 0.05},
            "random": {"wins": 1, "games": 400, "rate": rate_r, "lo": rate_r - 0.03, "hi": rate_r + 0.03}}


def test_learning_toma_solo_las_iteraciones_evaluadas(tmp_path):
    run = write_run(tmp_path, [{"iter": 1}, {"iter": 10, "eval": ev(0.58, 0.92)}, {"iter": 11},
                               {"iter": 20, "eval": ev(0.62, 0.93)}])
    out = export_curves.learning(run)
    assert [p["iteration"] for p in out["points"]] == [10, 20]
    assert out["points"][0]["vsHeuristic"] == 0.58
    assert out["points"][1]["vsRandomCi"] == pytest.approx([0.9, 0.96])


def test_learning_sin_evaluaciones_falla(tmp_path):
    with pytest.raises(ValueError):
        export_curves.learning(write_run(tmp_path, [{"iter": 1}]))


def test_minitruco(tmp_path):
    run = write_run(tmp_path, [{"iter": 5, "eval": {"exploitability_current": 0.4}},
                               {"iter": 10, "eval": {"exploitability_current": 0.2}}],
                    final={"exploitability": 0.05, "iterations": 10})
    out = export_curves.minitruco(run)
    assert out["points"] == [{"iteration": 5, "exploitability": 0.4}, {"iteration": 10, "exploitability": 0.2}]
    assert out["finalStrategyExploitability"] == 0.05
