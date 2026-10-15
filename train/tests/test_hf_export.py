"""La red publicada da lo mismo en PyTorch, en Rust (el mismo código que corre el WASM) y en ONNX."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_hf  # noqa: E402

MODEL = Path(__file__).resolve().parents[2] / "models" / "strategy.tcfrw"


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    out = tmp_path_factory.mktemp("hf")
    export_hf.export(MODEL, out, fixture=out / "fixture.json", n_fixture=16)
    return out


def test_archivos(exported):
    for name in ("model.safetensors", "model.onnx", "strategy.tcfrw", "config.json"):
        assert (exported / name).exists(), name
    cfg = json.loads((exported / "config.json").read_text())
    assert cfg["input_size"] == 304 and cfg["n_actions"] == 12
    assert cfg["actions"][9] == "quiero"


def test_paridad_pytorch_rust_onnx(exported):
    diffs = export_hf.parity(MODEL, exported / "model.onnx", n=2000)
    assert diffs["rust"] < 1e-4, diffs
    assert diffs["onnx"] < 1e-4, diffs


def test_fixture_para_el_wasm(exported):
    fx = json.loads((exported / "fixture.json").read_text())
    assert len(fx["inputs"]) == 16 and len(fx["inputs"][0]) == 304
    assert len(fx["logits"][0]) == 12
    assert np.abs(np.array(fx["logits"])).max() > 0.1
