"""Paridad entre el forward de PyTorch y el de Rust (el mismo que correrá el WASM)."""
import random

import numpy as np
import pytest
import torch
import truco_engine_py as eng

from truco_train.model import ScaledMlp


def real_encodings(n):
    """Codificaciones reales de situaciones de truco (de jugadas al azar)."""
    rng = random.Random(0)
    rows = []
    seed = 0
    while len(rows) < n:
        hand = eng.Hand(seed)
        seed += 1
        while not hand.is_terminal() and len(rows) < n:
            rows.append(hand.encode(hand.current_player()))
            mask = hand.legal_mask()
            hand.apply(rng.choice([a for a in range(12) if mask & (1 << a)]))
    return np.frombuffer(b"".join(rows), dtype=np.uint8).reshape(n, 304)


@pytest.mark.parametrize("hidden,n_hidden", [(32, 2), (128, 3)])
def test_pytorch_and_rust_forward_agree(hidden, n_hidden):
    torch.manual_seed(1)
    _, _, scale = eng.game_info("truco")
    net = ScaledMlp(scale, hidden, n_hidden, 12)
    # Pesos más grandes que el default, para que la comparación no sea trivial.
    for p in net.parameters():
        torch.nn.init.normal_(p, std=0.3)
    x = real_encodings(200)
    with torch.no_grad():
        expected = net(torch.from_numpy(x.copy())).numpy()
    got = np.frombuffer(eng.mlp_forward(net.to_bytes(), x.tobytes()), dtype="<f4").reshape(200, 12)
    assert np.abs(got - expected).max() < 1e-4
    assert np.abs(expected).max() > 0.1, "la salida no puede ser casi cero"


def test_mlp_forward_rejects_bad_input():
    net = ScaledMlp(np.ones(4, np.float32), 4, 1, 2).to_bytes()
    with pytest.raises(ValueError, match="múltiplo"):
        eng.mlp_forward(net, b"\x00" * 5)
    with pytest.raises(ValueError):
        eng.mlp_forward(b"basura", b"\x00" * 4)
