"""Entrenamiento de las redes con los datos de un buffer (todo el buffer vive en la GPU)."""
from __future__ import annotations

import torch

from .buffers import ReservoirBuffer
from .model import ScaledMlp


class _GpuData:
    """Copia del buffer en el dispositivo de entrenamiento (4 M × 304 bytes caben de sobra)."""

    def __init__(self, buf: ReservoirBuffer, device: torch.device):
        n = len(buf)
        if n == 0:
            raise ValueError("el buffer está vacío: no hay con qué entrenar")
        self.n = n
        self.enc = torch.from_numpy(buf.enc[:n]).to(device)
        self.values = torch.from_numpy(buf.values[:n]).to(device)
        # torch no desplaza bits de uint16: las máscaras viajan como int32.
        self.masks = torch.from_numpy(buf.masks[:n].astype("int32")).to(device)
        self.t = torch.from_numpy(buf.t[:n].astype("float32")).to(device)
        self.bits = torch.arange(self.values.shape[1], device=device, dtype=torch.int32)

    def batch(self, size: int, gen: torch.Generator):
        idx = torch.randint(0, self.n, (size,), device=self.enc.device, generator=gen)
        legal = ((self.masks[idx].unsqueeze(1) >> self.bits) & 1).bool()
        return self.enc[idx], self.values[idx], legal, self.t[idx]


def _run(model: ScaledMlp, data: _GpuData, loss_fn, steps: int, batch_size: int, lr: float,
         grad_clip: float, seed: int, decay: bool = False) -> float:
    device = data.enc.device
    gen = torch.Generator(device=device)
    gen.manual_seed(seed)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    tail = max(1, steps // 10)
    recent: list[float] = []
    for step in range(steps):
        if decay:  # el learning rate baja linealmente hasta el 5% al final
            for group in opt.param_groups:
                group["lr"] = lr * (1 - 0.95 * step / steps)
        x, y, legal, t = data.batch(batch_size, gen)
        per_sample = loss_fn(model(x), y, legal)
        # Ponderación lineal de CFR: las muestras de iteraciones tardías pesan más.
        loss = (t * per_sample).sum() / t.sum()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        opt.step()
        if step >= steps - tail:
            recent.append(loss.detach())
    return float(torch.stack(recent).mean())


def _masked_mse(pred, target, legal):
    """Error cuadrático medio solo sobre las acciones legales."""
    sq = (pred - target) ** 2 * legal
    return sq.sum(1) / legal.sum(1).clamp(min=1)


def _masked_cross_entropy(logits, target_probs, legal):
    """Entropía cruzada entre la estrategia muestreada y el softmax sobre las acciones legales."""
    logp = torch.log_softmax(logits.masked_fill(~legal, -1e9), dim=1)
    return -(target_probs * logp).sum(1)


def train_advantage(model: ScaledMlp, buf: ReservoirBuffer, *, steps: int, batch_size: int,
                    lr: float, grad_clip: float, adv_scale: float, seed: int) -> float:
    """MSE ponderado por t y enmascarado, sobre los arrepentimientos divididos por `adv_scale`."""
    data = _GpuData(buf, next(model.parameters()).device)
    data.values = data.values / adv_scale  # copia nueva: en CPU el tensor comparte memoria con el buffer
    return _run(model, data, _masked_mse, steps, batch_size, lr, grad_clip, seed, decay=True)


def train_strategy(model: ScaledMlp, buf: ReservoirBuffer, *, steps: int, batch_size: int,
                   lr: float, grad_clip: float, seed: int) -> float:
    """Entropía cruzada ponderada por t entre las estrategias muestreadas y la red."""
    data = _GpuData(buf, next(model.parameters()).device)
    return _run(model, data, _masked_cross_entropy, steps, batch_size, lr, grad_clip, seed,
                decay=True)
