"""Exporta la red de estrategia a los formatos de Hugging Face y mide la paridad entre implementaciones.

  uv run python scripts/export_hf.py [--model ../models/strategy.tcfrw] [--out ../hf]
      [--fixture ../web/src/engine/parity-fixture.json]

Deja en --out: model.safetensors (pesos), model.onnx (red completa, entrada uint8[batch, 304]),
strategy.tcfrw (el formato propio que usa el motor) y config.json.
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from pathlib import Path

import numpy as np
import torch
import truco_engine_py as eng
from safetensors.torch import save_file

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # permite correrlo como script

from truco_train.model import ScaledMlp
from truco_train.weights import read_tcfrw1

ACTIONS = ["jugar0", "jugar1", "jugar2", "envido", "realEnvido", "faltaEnvido",
           "truco", "retruco", "valeCuatro", "quiero", "noQuiero", "mazo"]


def load(model: Path) -> ScaledMlp:
    layers, scale = read_tcfrw1(model.read_bytes())
    hidden = layers[0][0].shape[0]
    net = ScaledMlp(scale, hidden, len(layers) - 1, layers[-1][0].shape[0])
    with torch.no_grad():
        for lin, (w, b) in zip(net.linears(), layers):
            lin.weight.copy_(torch.from_numpy(w.copy()))
            lin.bias.copy_(torch.from_numpy(b.copy()))
    net.eval()
    assert net.to_bytes() == model.read_bytes(), "la red cargada no reproduce el archivo"
    return net


def encodings(n: int, seed: int = 0) -> np.ndarray:
    """Situaciones reales de truco (de manos jugadas al azar), como las ve cada jugador."""
    rng = random.Random(seed)
    rows, k = [], 0
    while len(rows) < n:
        hand = eng.Hand(seed * 100_000 + k)
        k += 1
        while not hand.is_terminal() and len(rows) < n:
            rows.append(hand.encode(hand.current_player()))
            mask = hand.legal_mask()
            hand.apply(rng.choice([a for a in range(12) if mask & (1 << a)]))
    return np.frombuffer(b"".join(rows), dtype=np.uint8).reshape(n, 304)


def export(model: Path, out: Path, fixture: Path | None = None, n_fixture: int = 64) -> None:
    out.mkdir(parents=True, exist_ok=True)
    net = load(model)
    save_file({k: v.contiguous() for k, v in net.state_dict().items()}, str(out / "model.safetensors"))
    torch.onnx.export(net, (torch.zeros(1, 304, dtype=torch.uint8),), str(out / "model.onnx"),
                      input_names=["features"], output_names=["logits"],
                      dynamic_axes={"features": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, dynamo=False)
    shutil.copyfile(model, out / "strategy.tcfrw")
    layers = net.linears()
    config = {
        "architecture": "MLP (ReLU), entrada uint8 multiplicada por input_scale",
        "input_size": 304, "hidden": layers[0].out_features, "n_hidden": len(layers) - 1,
        "n_actions": 12, "actions": ACTIONS,
        "policy": "softmax de los logits sobre las acciones legales (red de estrategia promedio de Deep CFR)",
        "encoding": "engine/src/truco/encode.rs",
    }
    (out / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    if fixture is not None:
        x = encodings(n_fixture, seed=7)
        with torch.no_grad():
            y = net(torch.from_numpy(x.copy())).numpy()
        fixture.write_text(json.dumps({"inputs": x.tolist(), "logits": y.tolist()}) + "\n", encoding="utf-8")


def parity(model: Path, onnx_path: Path, n: int = 2000) -> dict:
    """Diferencia máxima absoluta de los logits contra PyTorch."""
    import onnxruntime as ort

    net = load(model)
    x = encodings(n)
    with torch.no_grad():
        ref = net(torch.from_numpy(x.copy())).numpy()
    rust = np.frombuffer(eng.mlp_forward(model.read_bytes(), x.tobytes()), dtype="<f4").reshape(n, 12)
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    onnx = sess.run(["logits"], {"features": x})[0]
    return {"rust": float(np.abs(rust - ref).max()), "onnx": float(np.abs(onnx - ref).max())}


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    p = argparse.ArgumentParser()
    p.add_argument("--model", type=Path, default=root / "models" / "strategy.tcfrw")
    p.add_argument("--out", type=Path, default=root / "hf")
    p.add_argument("--fixture", type=Path, default=root / "web" / "src" / "engine" / "parity-fixture.json")
    a = p.parse_args()
    export(a.model, a.out, a.fixture)
    print("paridad (máx |Δ| contra PyTorch):", parity(a.model, a.out / "model.onnx"))


if __name__ == "__main__":
    main()
