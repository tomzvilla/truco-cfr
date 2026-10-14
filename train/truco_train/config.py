"""Configuración de una corrida de entrenamiento (se lee de un archivo TOML)."""
from __future__ import annotations

import json
import tomllib
from dataclasses import asdict, dataclass, fields
from pathlib import Path

GAMES = ("kuhn", "minitruco", "truco")


@dataclass(frozen=True)
class Config:
    game: str = "truco"
    seed: int = 0
    iterations: int = 100
    # K: recorridos por jugador y por iteración.
    traversals: int = 10_000
    threads: int = 8
    # Red: `n_hidden` capas ocultas de `hidden` neuronas con ReLU.
    hidden: int = 256
    n_hidden: int = 3
    # Buffers de reservorio (muestras de ventaja por jugador, y de estrategia).
    adv_capacity: int = 4_000_000
    strat_capacity: int = 8_000_000
    # Entrenamiento de la red de ventajas en cada iteración.
    adv_steps: int = 2_000
    batch_size: int = 4_096
    lr: float = 1e-3
    grad_clip: float = 1.0
    # Los arrepentimientos se dividen por esto antes de entrenar (el regret matching no
    # cambia si todas las ventajas se escalan igual, así que no hace falta deshacerlo).
    adv_scale: float = 10.0
    # True: cada iteración sigue desde los pesos anteriores. False: arranca de cero (como el paper).
    warm_start: bool = True
    # Red de estrategia promedio, al final.
    strat_steps: int = 20_000
    strat_lr: float = 1e-3
    # Monitoreo y checkpoints (en iteraciones).
    eval_every: int = 5
    eval_pairs: int = 100
    checkpoint_every: int = 10
    compress_checkpoints: bool = True
    # Evaluación final de la red de estrategia (pares de partidos duplicados).
    final_pairs: int = 500
    # Si es > 0, la corrida termina sola cuando se cumple este tiempo (segundos).
    time_budget_s: float = 0.0
    device: str = "cuda"

    def validate(self) -> None:
        if self.game not in GAMES:
            raise ValueError(f"game tiene que ser uno de {GAMES}, no {self.game!r}")
        if self.device not in ("cuda", "cpu"):
            raise ValueError(f"device tiene que ser 'cuda' o 'cpu', no {self.device!r}")
        for name in (
            "iterations", "traversals", "threads", "hidden", "n_hidden", "adv_capacity",
            "strat_capacity", "adv_steps", "batch_size", "strat_steps", "eval_every",
            "eval_pairs", "checkpoint_every", "final_pairs",
        ):
            if getattr(self, name) < 1:
                raise ValueError(f"{name} tiene que ser al menos 1")
        if not (0 <= self.seed < 2**31):
            raise ValueError("seed tiene que estar entre 0 y 2**31 - 1")
        if self.adv_scale <= 0 or self.lr <= 0 or self.strat_lr <= 0:
            raise ValueError("adv_scale, lr y strat_lr tienen que ser positivos")
        if self.grad_clip <= 0 or self.time_budget_s < 0:
            raise ValueError("grad_clip tiene que ser positivo y time_budget_s no negativo")

    @classmethod
    def from_dict(cls, data: dict) -> Config:
        defaults = cls()
        names = {f.name for f in fields(cls)}
        unknown = set(data) - names
        if unknown:
            raise ValueError(f"claves desconocidas en la configuración: {sorted(unknown)}")
        clean = {}
        for key, value in data.items():
            default = getattr(defaults, key)
            if isinstance(default, bool):
                if not isinstance(value, bool):
                    raise ValueError(f"{key} tiene que ser true o false")
            elif isinstance(default, float):
                value = float(value)
            elif isinstance(default, int) and (isinstance(value, bool) or not isinstance(value, int)):
                raise ValueError(f"{key} tiene que ser un entero")
            clean[key] = value
        cfg = cls(**clean)
        cfg.validate()
        return cfg

    @classmethod
    def from_toml(cls, path: str | Path) -> Config:
        with open(path, "rb") as f:
            return cls.from_dict(tomllib.load(f))

    @classmethod
    def from_json(cls, text: str) -> Config:
        return cls.from_dict(json.loads(text))

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)
