"""Corridas: `run` (empezar), `resume` (retomar), `finalize` (red de estrategia + exportación)."""
from __future__ import annotations

import hashlib
import json
import shutil
import signal
import time
from datetime import datetime
from pathlib import Path

import truco_engine_py as eng

from .checkpoint import has_checkpoint, load_checkpoint, save_checkpoint
from .config import Config
from .deepcfr import DeepCfr
from .monitor import duplicate_vs, evaluate


def _append(path: Path, record: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def truncate_metrics(path: Path, upto: int) -> None:
    """Deja en `metrics.jsonl` solo las filas con `iter <= upto` (y descarta una última línea
    cortada a medias). Se usa al retomar: el checkpoint es de la iteración `upto`, y las filas
    posteriores se van a volver a generar."""
    if not path.exists():
        return
    kept = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row["iter"] <= upto:
            kept.append(line)
    tmp = path.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(line + "\n" for line in kept), encoding="utf-8")
    tmp.replace(path)


def _short(stats: dict) -> str:
    parts = [f"iter {stats['iter']:>4}", f"recorridos {stats['traversal_s']:.1f}s",
             f"entrenamiento {stats['train_s']:.1f}s",
             f"pérdida {stats['adv_loss'][0]:.4f}/{stats['adv_loss'][1]:.4f}"]
    for opp, r in stats.get("eval", {}).items():
        if isinstance(r, dict):
            parts.append(f"vs {opp} {r['rate']:.0%} [{r['lo']:.0%}, {r['hi']:.0%}]")
        else:
            parts.append(f"{opp} {r:.4f}")
    return " | ".join(parts)


def start(cfg: Config, runs_dir: Path, run_id: str | None = None, name: str = "run",
          config_toml: Path | None = None) -> Path:
    """Crea `runs/<id>/` y corre el entrenamiento completo. Si se da `config_toml`, lo copia
    junto a la corrida."""
    run_id = run_id or f"{name}-{datetime.now():%Y%m%d-%H%M%S}"
    run_dir = runs_dir / run_id
    if run_dir.exists():
        raise FileExistsError(f"ya existe {run_dir}: usá `resume` o cambiá --run-id")
    run_dir.mkdir(parents=True)
    (run_dir / "config.json").write_text(cfg.to_json(), encoding="utf-8")
    if config_toml is not None:
        shutil.copy(config_toml, run_dir / "config.toml")
    drive(DeepCfr(cfg), run_dir)
    return run_dir


def resume(run_dir: Path, iterations: int | None = None) -> Path:
    """Retoma una corrida desde su último checkpoint. `iterations` extiende el objetivo."""
    cfg = Config.from_json((run_dir / "config.json").read_text(encoding="utf-8"))
    if iterations is not None:
        data = json.loads(cfg.to_json())
        data["iterations"] = iterations
        cfg = Config.from_dict(data)
        (run_dir / "config.json").write_text(cfg.to_json(), encoding="utf-8")
    if not has_checkpoint(run_dir):
        raise FileNotFoundError(f"{run_dir} no tiene checkpoint: todavía no se guardó ninguno")
    dcfr = load_checkpoint(run_dir, cfg)
    truncate_metrics(run_dir / "metrics.jsonl", dcfr.iteration)
    print(f"retomando {run_dir.name} desde la iteración {dcfr.iteration}")
    drive(dcfr, run_dir)
    return run_dir


def drive(dcfr: DeepCfr, run_dir: Path) -> None:
    """Itera hasta `cfg.iterations` (o hasta agotar `time_budget_s`), guardando métricas y
    checkpoints.

    Ctrl-C (SIGINT) no corta la iteración en curso: levanta una bandera, la iteración termina,
    se guarda un checkpoint consistente (nunca un estado a medias) y la corrida sale sin
    finalizar; se retoma con `resume`. Un segundo Ctrl-C sí corta de inmediato (se pierde el
    trabajo desde el último checkpoint)."""
    cfg = dcfr.cfg
    metrics = run_dir / "metrics.jsonl"
    began = time.monotonic()
    stop = {"requested": False}
    previous = None

    def on_sigint(signum, frame):
        stop["requested"] = True
        signal.signal(signal.SIGINT, previous)  # el segundo Ctrl-C vuelve a ser el normal
        print("\nCtrl-C: termino la iteración en curso, guardo y salgo "
              "(otro Ctrl-C corta ya)", flush=True)

    try:
        previous = signal.signal(signal.SIGINT, on_sigint)
        handled = True
    except ValueError:  # no estamos en el hilo principal
        handled = False
    try:
        while dcfr.iteration < cfg.iterations:
            stats = dcfr.step()
            t = dcfr.iteration
            if t % cfg.eval_every == 0:
                stats["eval"] = evaluate(cfg, dcfr.net_bytes, dcfr.seed_for(t, 0, 3))
            stats["elapsed_s"] = dcfr.elapsed_s
            _append(metrics, stats)
            print(_short(stats), flush=True)
            if stop["requested"]:
                save_checkpoint(dcfr, run_dir)
                print(f"interrumpido en la iteración {t}; retomá con: "
                      f"python -m truco_train resume {run_dir}", flush=True)
                return
            if t % cfg.checkpoint_every == 0:
                save_checkpoint(dcfr, run_dir)
            if cfg.time_budget_s > 0 and time.monotonic() - began >= cfg.time_budget_s:
                print("se cumplió time_budget_s: termina la corrida", flush=True)
                break
    finally:
        if handled and not stop["requested"]:
            signal.signal(signal.SIGINT, previous)
    save_checkpoint(dcfr, run_dir)
    finalize(dcfr, run_dir)


def finalize(dcfr: DeepCfr, run_dir: Path) -> dict:
    """Entrena la red de estrategia promedio, la exporta a `strategy.tcfrw` y la evalúa."""
    cfg = dcfr.cfg
    net = dcfr.train_strategy_net()
    data = net.to_bytes()
    (run_dir / "strategy.tcfrw").write_bytes(data)
    final: dict = {
        "game": cfg.game,
        "iterations": dcfr.iteration,
        "elapsed_s": dcfr.elapsed_s,
        "strategy_bytes": len(data),
        "strategy_sha256": hashlib.sha256(data).hexdigest(),
        "strategy_loss": dcfr.last_strategy_loss,
    }
    if cfg.game == "truco":
        for opp in ("heuristic", "random"):
            final[f"vs_{opp}"] = duplicate_vs(cfg, opp, "strategy", data, None, cfg.final_pairs,
                                              dcfr.seed_for(dcfr.iteration, 0, 4))
    else:
        final["exploitability"] = eng.exploitability(cfg.game, "strategy", data)
    (run_dir / "final.json").write_text(json.dumps(final, indent=2), encoding="utf-8")
    print("listo: " + json.dumps(final), flush=True)
    return final
