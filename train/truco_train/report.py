"""Arma el informe de entrenamiento (docs/training-report.md) a partir de una corrida."""
from __future__ import annotations

import json
from pathlib import Path
from string import Template

TEMPLATE = Template(
    """# Informe de entrenamiento

Corrida `$run_id`. Generado por `python -m truco_train report`.

## Qué se entrenó

- Algoritmo: Deep CFR con muestreo externo y ponderación lineal por iteración.
- Juego: `$game`. Red: $n_hidden capas ocultas de $hidden neuronas (ReLU), entrada de bytes por `feature_scale`.
- $iterations iteraciones, $traversals recorridos por jugador y por iteración (K), semilla $seed.
- Buffers de reservorio: $adv_capacity muestras de ventaja por jugador, $strat_capacity de estrategia.
- Arranque de cada iteración: $warm_start.
- Tiempo total de entrenamiento: $hours horas. Archivo de pesos: `strategy.tcfrw` ($kib KiB, SHA-256 `$sha`).

## Resultados de la red de estrategia promedio

$final_table

Los intervalos son de Wilson al 95%, sobre partidos completos a 30 en formato duplicado.

## Curva de aprendizaje

Política actual (regret matching sobre las redes de ventajas), medida durante el entrenamiento.

$curve_table

## Observaciones

_(Completar a mano, con dos o tres frases en lenguaje simple: cómo evolucionó la curva, si se estancó, qué sorprendió.)_

## Limitaciones

- La explotabilidad exacta solo se calcula en Kuhn y MiniTruco. En el truco completo no se calcula;
  la medida de fuerza es el rendimiento contra el heurístico propio y contra el azar.
- Es una sola corrida con una sola semilla: no hay intervalos de confianza entre corridas.
- Todos los números de este informe salen de `runs/$run_id/metrics.jsonl` y `final.json`.
"""
)


def _rate(r: dict) -> str:
    return f"{r['rate']:.1%} [{r['lo']:.1%}, {r['hi']:.1%}] ({r['wins']}/{r['games']})"


def build_report(run_dir: Path) -> str:
    cfg = json.loads((run_dir / "config.json").read_text(encoding="utf-8"))
    final_path = run_dir / "final.json"
    final = json.loads(final_path.read_text(encoding="utf-8")) if final_path.exists() else {}
    rows = [json.loads(line) for line in (run_dir / "metrics.jsonl").read_text(encoding="utf-8").splitlines() if line]

    if "vs_heuristic" in final:
        final_table = "| Rival | Partidos ganados |\n|---|---|\n" + "\n".join(
            f"| {name} | {_rate(final['vs_' + key])} |"
            for key, name in (("heuristic", "Heurístico"), ("random", "Azar"))
        )
    elif "exploitability" in final:
        final_table = f"Explotabilidad exacta: **{final['exploitability']:.4f}**."
    else:
        final_table = "_La corrida todavía no terminó (falta `final.json`)._"

    evals = [r for r in rows if r.get("eval")]
    if evals and "heuristic" in evals[0]["eval"]:
        curve = "| Iteración | vs heurístico | vs azar |\n|---|---|---|\n" + "\n".join(
            f"| {r['iter']} | {_rate(r['eval']['heuristic'])} | {_rate(r['eval']['random'])} |"
            for r in evals
        )
    elif evals:
        curve = "| Iteración | Explotabilidad (política actual) |\n|---|---|\n" + "\n".join(
            f"| {r['iter']} | {r['eval']['exploitability_current']:.4f} |" for r in evals
        )
    else:
        curve = "_Sin mediciones todavía._"

    elapsed = final.get("elapsed_s", rows[-1]["elapsed_s"] if rows else 0.0)
    return TEMPLATE.substitute(
        run_id=run_dir.name,
        game=cfg["game"],
        n_hidden=cfg["n_hidden"],
        hidden=cfg["hidden"],
        iterations=final.get("iterations", rows[-1]["iter"] if rows else 0),
        traversals=f"{cfg['traversals']:,}".replace(",", " "),
        seed=cfg["seed"],
        adv_capacity=f"{cfg['adv_capacity']:,}".replace(",", " "),
        strat_capacity=f"{cfg['strat_capacity']:,}".replace(",", " "),
        warm_start="desde los pesos anteriores" if cfg["warm_start"] else "desde cero",
        hours=f"{elapsed / 3600:.2f}",
        kib=f"{final.get('strategy_bytes', 0) / 1024:.0f}",
        sha=final.get("strategy_sha256", "n/d"),
        final_table=final_table,
        curve_table=curve,
    )
