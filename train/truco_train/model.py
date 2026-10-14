"""La red neuronal: entrada u8 × feature_scale -> MLP con ReLU."""
from __future__ import annotations

import numpy as np
import torch
from torch import nn

from .weights import tcfrw1_bytes


class ScaledMlp(nn.Module):
    """Igual que el MLP de Rust: `x_u8 * input_scale`, `n_hidden` capas ocultas con ReLU y una
    capa final lineal."""

    def __init__(self, input_scale, hidden: int, n_hidden: int, n_out: int):
        super().__init__()
        scale = torch.as_tensor(np.asarray(input_scale, dtype=np.float32))
        self.register_buffer("scale", scale)
        layers: list[nn.Module] = []
        n_in = len(scale)
        for _ in range(n_hidden):
            layers += [nn.Linear(n_in, hidden), nn.ReLU()]
            n_in = hidden
        layers.append(nn.Linear(n_in, n_out))
        self.net = nn.Sequential(*layers)

    def forward(self, x_u8: torch.Tensor) -> torch.Tensor:
        return self.net(x_u8.float() * self.scale)

    def linears(self) -> list[nn.Linear]:
        return [m for m in self.net if isinstance(m, nn.Linear)]

    def to_bytes(self) -> bytes:
        return tcfrw1_bytes(self.linears(), self.scale.detach().cpu().numpy())
