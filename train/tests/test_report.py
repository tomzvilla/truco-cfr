import pytest

from truco_train.monitor import wilson
from truco_train.report import build_report


def test_wilson_interval_known_values():
    lo, hi = wilson(50, 100)
    assert lo == pytest.approx(0.4038, abs=1e-3) and hi == pytest.approx(0.5962, abs=1e-3)
    assert wilson(0, 0) == (0.0, 1.0)
    lo, hi = wilson(100, 100)
    assert hi == pytest.approx(1.0) and lo > 0.95


def test_report_contains_the_run_facts(tiny_run):
    text = build_report(tiny_run)
    assert text.startswith("# Informe de entrenamiento")
    assert "`tiny`" in text and "Heurístico" in text and "Azar" in text
    assert "| 2 |" in text, "la curva de aprendizaje tiene que incluir la iteración 2"
    assert "$" not in text, "quedó un campo de la plantilla sin llenar"


def test_report_on_an_unfinished_run_says_so(tiny_run, tmp_path):
    import shutil

    partial = tmp_path / "partial"
    partial.mkdir()
    shutil.copy(tiny_run / "config.json", partial / "config.json")
    shutil.copy(tiny_run / "metrics.jsonl", partial / "metrics.jsonl")
    assert "todavía no terminó" in build_report(partial)
