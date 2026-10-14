"""Escritura y lectura de pesos en formato TCFRW1 (ver docs/weights-format.md)."""
from __future__ import annotations

import struct
from collections.abc import Iterable
from pathlib import Path

import numpy as np

MAGIC = b"TCFRW1\0\0"


def tcfrw1_bytes(linears: Iterable, input_scale) -> bytes:
    """Serializa capas `torch.nn.Linear` (ReLU entre capas, la última lineal) a TCFRW1."""
    linears = list(linears)
    scale = np.asarray(input_scale, dtype="<f4")
    out = [MAGIC, struct.pack("<II", len(linears), len(scale)), scale.tobytes()]
    for lin in linears:
        w = lin.weight.detach().cpu().numpy().astype("<f4")
        b = lin.bias.detach().cpu().numpy().astype("<f4")
        out.append(struct.pack("<II", w.shape[1], w.shape[0]))
        out.append(np.ascontiguousarray(w).tobytes(order="C"))
        out.append(b.tobytes())
    return b"".join(out)


def write_tcfrw1(path: str | Path, linears: Iterable, input_scale) -> None:
    Path(path).write_bytes(tcfrw1_bytes(linears, input_scale))


def read_tcfrw1(data: bytes):
    """Devuelve (capas, input_scale), con capas = [(w[out, in], b[out]), ...]. Para tests."""
    if data[:8] != MAGIC:
        raise ValueError("no es un archivo TCFRW1")
    n_layers, input_size = struct.unpack_from("<II", data, 8)
    pos = 16
    scale = np.frombuffer(data, dtype="<f4", count=input_size, offset=pos)
    pos += 4 * input_size
    layers = []
    for _ in range(n_layers):
        n_in, n_out = struct.unpack_from("<II", data, pos)
        pos += 8
        w = np.frombuffer(data, dtype="<f4", count=n_in * n_out, offset=pos).reshape(n_out, n_in)
        pos += 4 * n_in * n_out
        b = np.frombuffer(data, dtype="<f4", count=n_out, offset=pos)
        pos += 4 * n_out
        layers.append((w, b))
    if pos != len(data):
        raise ValueError("sobran bytes al final")
    return layers, scale
