"""Checkpoints: pesos, buffers, estado de los generadores aleatorios y número de iteración."""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
import torch

from .config import Config
from .deepcfr import DeepCfr

DIR = "checkpoint"


def save_checkpoint(dcfr: DeepCfr, run_dir: Path) -> None:
    """Escribe en una carpeta temporal y recién después reemplaza la anterior, así un corte
    de luz a mitad del guardado no destruye el último checkpoint bueno.

    Orden: (1) escribir `checkpoint.tmp`; (2) `checkpoint` pasa a `checkpoint.old`;
    (3) `checkpoint.tmp` pasa a `checkpoint`; (4) recién ahí se borra `checkpoint.old`.
    Si el corte cae entre (2) y (3), no existe `checkpoint/` pero `checkpoint.old` está
    completo: `has_checkpoint` y `load_checkpoint` lo usan. Un guardado nuevo nunca borra
    `checkpoint.old` mientras falte `checkpoint/`."""
    final = run_dir / DIR
    tmp = run_dir / f"{DIR}.tmp"
    old = run_dir / f"{DIR}.old"
    if tmp.exists():
        shutil.rmtree(tmp)
    if final.exists() and old.exists():
        shutil.rmtree(old)  # el viejo ya no hace falta: `checkpoint/` está completo
    tmp.mkdir(parents=True)
    compress = dcfr.cfg.compress_checkpoints
    for p in (0, 1):
        dcfr.adv_bufs[p].save(tmp / f"adv{p}.npz", compress)
    dcfr.strat_buf.save(tmp / "strat.npz", compress)
    state = {
        "iteration": dcfr.iteration,
        "elapsed_s": dcfr.elapsed_s,
        "adv_nets": [net.state_dict() for net in dcfr.adv_nets],
        "np_rng": dcfr.rng.bit_generator.state,
        "torch_rng": torch.get_rng_state(),
    }
    torch.save(state, tmp / "state.pt")
    if final.exists():
        final.rename(old)
    tmp.rename(final)
    if old.exists():
        shutil.rmtree(old)


def _source(run_dir: Path) -> Path | None:
    """La carpeta de la que se puede leer: `checkpoint/`, o `checkpoint.old/` si el corte cayó
    justo entre los dos renombrados."""
    for name in (DIR, f"{DIR}.old"):
        if (run_dir / name / "state.pt").exists():
            return run_dir / name
    return None


def has_checkpoint(run_dir: Path) -> bool:
    return _source(run_dir) is not None


def load_checkpoint(run_dir: Path, cfg: Config) -> DeepCfr:
    """Reconstruye un `DeepCfr` exactamente como estaba al guardar."""
    src = _source(run_dir)
    if src is None:
        raise FileNotFoundError(f"{run_dir} no tiene checkpoint")
    dcfr = DeepCfr(cfg)
    state = torch.load(src / "state.pt", weights_only=False, map_location=dcfr.device)
    dcfr.iteration = state["iteration"]
    dcfr.elapsed_s = state["elapsed_s"]
    for p in (0, 1):
        dcfr.adv_nets[p].load_state_dict(state["adv_nets"][p])
        dcfr.net_bytes[p] = dcfr.adv_nets[p].to_bytes() if dcfr.iteration > 0 else None
        dcfr.adv_bufs[p].load(src / f"adv{p}.npz")
    dcfr.strat_buf.load(src / "strat.npz")
    dcfr.rng.bit_generator.state = state["np_rng"]
    torch.set_rng_state(state["torch_rng"].cpu())
    return dcfr
