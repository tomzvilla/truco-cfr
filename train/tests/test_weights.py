import struct

import numpy as np
import torch

from truco_train.model import ScaledMlp
from truco_train.weights import MAGIC, read_tcfrw1, tcfrw1_bytes


def reference_writer(linears, input_scale) -> bytes:
    """El escritor de referencia de docs/weights-format.md, copiado tal cual."""
    import io

    f = io.BytesIO()
    f.write(b"TCFRW1\0\0")
    f.write(struct.pack("<II", len(linears), len(input_scale)))
    f.write(np.asarray(input_scale, dtype="<f4").tobytes())
    for lin in linears:
        w = lin.weight.detach().cpu().numpy().astype("<f4")
        b = lin.bias.detach().cpu().numpy().astype("<f4")
        f.write(struct.pack("<II", w.shape[1], w.shape[0]))
        f.write(w.tobytes(order="C"))
        f.write(b.tobytes())
    return f.getvalue()


def make_net() -> ScaledMlp:
    torch.manual_seed(0)
    scale = np.linspace(0.1, 2.0, 7, dtype=np.float32)
    return ScaledMlp(scale, hidden=5, n_hidden=2, n_out=3)


def test_writer_matches_the_documented_reference_byte_for_byte():
    net = make_net()
    assert net.to_bytes() == reference_writer(net.linears(), net.scale.numpy())


def test_header_layout():
    data = make_net().to_bytes()
    assert data[:8] == MAGIC
    assert struct.unpack_from("<II", data, 8) == (3, 7)  # 3 capas lineales, entrada de 7
    n_in, n_out = struct.unpack_from("<II", data, 16 + 4 * 7)
    assert (n_in, n_out) == (7, 5)


def test_read_back_gives_the_same_weights():
    net = make_net()
    layers, scale = read_tcfrw1(net.to_bytes())
    assert np.array_equal(scale, net.scale.numpy())
    for (w, b), lin in zip(layers, net.linears()):
        assert np.array_equal(w, lin.weight.detach().numpy())
        assert np.array_equal(b, lin.bias.detach().numpy())


def test_tcfrw1_bytes_accepts_any_iterable_of_linears():
    net = make_net()
    assert tcfrw1_bytes(iter(net.linears()), net.scale.numpy()) == net.to_bytes()
