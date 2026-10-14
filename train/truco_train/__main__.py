"""Línea de comandos.

    uv run python -m truco_train run --config configs/smoke.toml
    uv run python -m truco_train resume runs/<id> [--iterations N]
    uv run python -m truco_train report runs/<id> --out ../docs/training-report.md
"""
from __future__ import annotations

import argparse
from pathlib import Path

from .config import Config
from .report import build_report
from .run import resume, start


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="truco_train")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="empezar una corrida nueva")
    p_run.add_argument("--config", type=Path, required=True)
    p_run.add_argument("--runs-dir", type=Path, default=Path("runs"))
    p_run.add_argument("--run-id", default=None)

    p_res = sub.add_parser("resume", help="retomar una corrida desde su último checkpoint")
    p_res.add_argument("run_dir", type=Path)
    p_res.add_argument("--iterations", type=int, default=None, help="nuevo objetivo de iteraciones")

    p_rep = sub.add_parser("report", help="armar el informe de una corrida")
    p_rep.add_argument("run_dir", type=Path)
    p_rep.add_argument("--out", type=Path, default=None)

    args = parser.parse_args(argv)
    if args.command == "run":
        cfg = Config.from_toml(args.config)
        start(cfg, args.runs_dir, args.run_id, name=args.config.stem, config_toml=args.config)
    elif args.command == "resume":
        resume(args.run_dir, args.iterations)
    else:
        text = build_report(args.run_dir)
        if args.out:
            args.out.write_text(text, encoding="utf-8")
            print(f"informe escrito en {args.out}")
        else:
            print(text)


if __name__ == "__main__":
    main()
