"""Exporta las curvas del entrenamiento a archivos chicos y versionados en eval/results/.

  learning:    metrics.jsonl de una corrida de truco -> [{iteration, vsRandom, vsRandomCi, vsHeuristic, vsHeuristicCi, games}]
  minitruco:   metrics.jsonl + final.json de una corrida de MiniTruco -> {points: [{iteration, exploitability}], final}

Uso:
  python scripts/export_curves.py learning RUN_DIR OUT.json
  python scripts/export_curves.py minitruco RUN_DIR OUT.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def read_metrics(run_dir: Path) -> list[dict]:
    lines = (run_dir / "metrics.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def learning(run_dir: Path) -> dict:
    points = []
    for m in read_metrics(run_dir):
        ev = m.get("eval")
        if not ev or "heuristic" not in ev:
            continue
        points.append({
            "iteration": m["iter"],
            "vsRandom": ev["random"]["rate"],
            "vsRandomCi": [ev["random"]["lo"], ev["random"]["hi"]],
            "vsHeuristic": ev["heuristic"]["rate"],
            "vsHeuristicCi": [ev["heuristic"]["lo"], ev["heuristic"]["hi"]],
            "games": ev["heuristic"]["games"],
        })
    if not points:
        raise ValueError(f"{run_dir} no tiene evaluaciones de truco")
    return {"run": run_dir.name, "policy": "advantage (regret matching, la política de cada iteración)",
            "points": points}


def minitruco(run_dir: Path) -> dict:
    points = [{"iteration": m["iter"], "exploitability": m["eval"]["exploitability_current"]}
              for m in read_metrics(run_dir) if m.get("eval", {}).get("exploitability_current") is not None]
    if not points:
        raise ValueError(f"{run_dir} no tiene explotabilidad")
    final = json.loads((run_dir / "final.json").read_text(encoding="utf-8"))
    return {"run": run_dir.name, "points": points, "finalStrategyExploitability": final["exploitability"],
            "iterations": final["iterations"]}


def main(argv: list[str]) -> None:
    kind, run_dir, out = argv
    data = {"learning": learning, "minitruco": minitruco}[kind](Path(run_dir))
    Path(out).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
