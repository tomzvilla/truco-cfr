"""Buffer de reservorio: guarda una muestra uniforme de todo lo que le llegó, en numpy.

El infoset se guarda comprimido como los `u8` de la codificación (304 bytes en truco), no
como floats: 4 M de muestras ocupan unos 1,2 GB.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np


class ReservoirBuffer:
    def __init__(self, capacity: int, enc_size: int, width: int, rng: np.random.Generator):
        self.capacity = capacity
        self.enc = np.zeros((capacity, enc_size), dtype=np.uint8)
        self.values = np.zeros((capacity, width), dtype=np.float32)
        self.masks = np.zeros(capacity, dtype=np.uint16)
        self.t = np.zeros(capacity, dtype=np.int32)
        self.size = 0  # cuántas ranuras están ocupadas
        self.seen = 0  # cuántas muestras pasaron por el buffer en total
        self.rng = rng

    def __len__(self) -> int:
        return self.size

    def add(self, enc: np.ndarray, values: np.ndarray, masks: np.ndarray, t: int) -> None:
        """Agrega un lote (muestreo de reservorio, algoritmo R)."""
        m = len(masks)
        if not (len(enc) == len(values) == m):
            raise ValueError("enc, values y masks tienen que tener el mismo largo")
        if m == 0:
            return
        position = self.seen + np.arange(m, dtype=np.int64)  # lugar de cada muestra en el flujo
        slot = np.where(position < self.capacity, position, -1)
        full = slot < 0
        if full.any():
            # La muestra número k (desde 0) entra con probabilidad capacity / (k + 1).
            j = self.rng.integers(0, position[full] + 1)
            slot[full] = np.where(j < self.capacity, j, -1)
        keep = slot >= 0
        idx = slot[keep]
        # Si dos muestras eligen la misma ranura, gana la última (como en el algoritmo secuencial).
        self.enc[idx] = enc[keep]
        self.values[idx] = values[keep]
        self.masks[idx] = masks[keep]
        self.t[idx] = t
        self.seen += m
        self.size = min(self.capacity, self.seen)

    def save(self, path: str | Path, compress: bool = True) -> None:
        save = np.savez_compressed if compress else np.savez
        save(
            path,
            enc=self.enc[: self.size],
            values=self.values[: self.size],
            masks=self.masks[: self.size],
            t=self.t[: self.size],
            seen=np.array(self.seen, dtype=np.int64),
        )

    def load(self, path: str | Path) -> None:
        with np.load(path) as data:
            n = len(data["masks"])
            if n > self.capacity:
                raise ValueError(
                    f"el checkpoint tiene {n} muestras y la capacidad es {self.capacity}"
                )
            self.enc[:n] = data["enc"]
            self.values[:n] = data["values"]
            self.masks[:n] = data["masks"]
            self.t[:n] = data["t"]
            self.size = n
            self.seen = int(data["seen"])
