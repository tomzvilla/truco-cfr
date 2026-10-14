import json
import os
import shutil
import signal

import numpy as np
import pytest

from truco_train.checkpoint import has_checkpoint, load_checkpoint, save_checkpoint
from truco_train.deepcfr import DeepCfr
from truco_train.run import drive, resume, start, truncate_metrics

from .helpers import tiny_truco_config


def test_a_restored_checkpoint_continues_exactly_like_the_original(tmp_path):
    cfg = tiny_truco_config(iterations=4)
    original = DeepCfr(cfg)
    original.step()
    original.step()
    save_checkpoint(original, tmp_path)
    assert has_checkpoint(tmp_path)

    restored = load_checkpoint(tmp_path, cfg)
    assert restored.iteration == 2
    assert restored.net_bytes == original.net_bytes
    for p in (0, 1):
        assert np.array_equal(restored.adv_bufs[p].enc[:restored.adv_bufs[p].size],
                              original.adv_bufs[p].enc[:original.adv_bufs[p].size])

    for dcfr in (original, restored):
        dcfr.step()
        dcfr.step()
    assert restored.net_bytes == original.net_bytes, "después de reanudar, las redes difieren"
    assert restored.strat_buf.seen == original.strat_buf.seen


def test_saving_a_second_checkpoint_replaces_the_first(tmp_path):
    dcfr = DeepCfr(tiny_truco_config())
    dcfr.step()
    save_checkpoint(dcfr, tmp_path)
    dcfr.step()
    save_checkpoint(dcfr, tmp_path)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["checkpoint"]
    assert load_checkpoint(tmp_path, dcfr.cfg).iteration == 2


def test_resume_extends_a_finished_run(tmp_path):
    run_dir = start(tiny_truco_config(iterations=2), tmp_path, run_id="r")
    resume(run_dir, iterations=3)
    iters = [json.loads(line)["iter"] for line in (run_dir / "metrics.jsonl").read_text().splitlines()]
    assert iters == [1, 2, 3]
    assert json.loads((run_dir / "final.json").read_text())["iterations"] == 3
    assert json.loads((run_dir / "config.json").read_text())["iterations"] == 3


def test_resume_without_checkpoint_explains_itself(tmp_path):
    (tmp_path / "config.json").write_text(tiny_truco_config().to_json())
    with pytest.raises(FileNotFoundError, match="checkpoint"):
        resume(tmp_path)


def test_start_refuses_to_overwrite_an_existing_run(tmp_path):
    start(tiny_truco_config(iterations=1), tmp_path, run_id="dup")
    with pytest.raises(FileExistsError):
        start(tiny_truco_config(iterations=1), tmp_path, run_id="dup")


def test_time_budget_stops_the_run_early_but_still_finalizes(tmp_path):
    cfg = tiny_truco_config(iterations=1000, time_budget_s=0.001)
    run_dir = start(cfg, tmp_path, run_id="budget")
    final = json.loads((run_dir / "final.json").read_text())
    assert 1 <= final["iterations"] < 1000
    assert (run_dir / "strategy.tcfrw").exists()


def test_a_crash_between_the_two_renames_keeps_the_last_good_checkpoint(tmp_path):
    dcfr = DeepCfr(tiny_truco_config())
    dcfr.step()
    save_checkpoint(dcfr, tmp_path)
    # El corte cae justo después de `checkpoint -> checkpoint.old`: no existe `checkpoint/`.
    (tmp_path / "checkpoint").rename(tmp_path / "checkpoint.old")
    assert has_checkpoint(tmp_path)
    assert load_checkpoint(tmp_path, dcfr.cfg).iteration == 1

    # Un guardado que falla a mitad de camino no puede borrar el único checkpoint bueno.
    dcfr.step()
    original_save = type(dcfr.strat_buf).save

    def boom(self, path, compress=True):
        raise OSError("disco lleno")

    type(dcfr.strat_buf).save = boom
    try:
        with pytest.raises(OSError):
            save_checkpoint(dcfr, tmp_path)
    finally:
        type(dcfr.strat_buf).save = original_save
    assert load_checkpoint(tmp_path, dcfr.cfg).iteration == 1

    # Y un guardado completo deja una sola carpeta, con la iteración nueva.
    save_checkpoint(dcfr, tmp_path)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["checkpoint"]
    assert load_checkpoint(tmp_path, dcfr.cfg).iteration == 2


def test_resume_drops_metrics_rows_newer_than_the_checkpoint(tmp_path):
    run_dir = start(tiny_truco_config(iterations=3, checkpoint_every=2), tmp_path, run_id="m")
    # Simula un corte en la iteración 3: el último checkpoint es el de la 2 y el log tiene la 3
    # más una línea cortada a medias.
    save_cfg = tiny_truco_config(iterations=3, checkpoint_every=2)
    dcfr = DeepCfr(save_cfg)
    dcfr.step()
    dcfr.step()
    save_checkpoint(dcfr, run_dir)
    with open(run_dir / "metrics.jsonl", "a", encoding="utf-8") as f:
        f.write('{"iter": 4, "trunca')
    (run_dir / "final.json").unlink()
    resume(run_dir, iterations=4)
    iters = [json.loads(line)["iter"] for line in (run_dir / "metrics.jsonl").read_text().splitlines()]
    assert iters == [1, 2, 3, 4]


def test_truncate_metrics_keeps_only_rows_up_to_the_checkpoint(tmp_path):
    path = tmp_path / "metrics.jsonl"
    path.write_text('{"iter": 1}\n{"iter": 2}\n{"iter": 3}\n{"iter": 4, "x', encoding="utf-8")
    truncate_metrics(path, 2)
    assert path.read_text() == '{"iter": 1}\n{"iter": 2}\n'
    truncate_metrics(tmp_path / "no_existe.jsonl", 2)  # no falla


@pytest.mark.parametrize("sig", [signal.SIGINT, signal.SIGTERM])
def test_ctrl_c_finishes_the_current_iteration_and_saves_a_consistent_checkpoint(tmp_path, sig):
    cfg = tiny_truco_config(iterations=4, checkpoint_every=100)
    reference = DeepCfr(cfg)
    for _ in range(4):
        reference.step()

    dcfr = DeepCfr(cfg)
    run_dir = tmp_path / "ctrlc"
    run_dir.mkdir()
    (run_dir / "config.json").write_text(cfg.to_json(), encoding="utf-8")
    real_step = dcfr.step
    calls = {"n": 0}

    def step_with_interrupt():
        calls["n"] += 1
        if calls["n"] == 2:
            signal.raise_signal(sig)  # llega a mitad de la iteración 2
        return real_step()

    dcfr.step = step_with_interrupt
    drive(dcfr, run_dir)  # no levanta KeyboardInterrupt: termina la iteración y sale
    assert not (run_dir / "final.json").exists()
    assert signal.getsignal(signal.SIGINT) is signal.default_int_handler
    assert signal.getsignal(signal.SIGTERM) is signal.SIG_DFL
    saved = load_checkpoint(run_dir, cfg)
    assert saved.iteration == 2, "el checkpoint tiene que ser de una iteración completa"
    assert [json.loads(line)["iter"] for line in (run_dir / "metrics.jsonl").read_text().splitlines()] == [1, 2]

    resume(run_dir)
    final = json.loads((run_dir / "final.json").read_text())
    assert final["iterations"] == 4
    assert load_checkpoint(run_dir, cfg).net_bytes == reference.net_bytes, \
        "retomar después de Ctrl-C tiene que dar lo mismo que no interrumpir"


def test_save_checkpoint_fsyncs_every_file_and_both_directories_before_removing_the_old_one(
        tmp_path, monkeypatch):
    from truco_train import checkpoint as ckpt

    dcfr = DeepCfr(tiny_truco_config())
    dcfr.step()
    save_checkpoint(dcfr, tmp_path)  # ahora existe `checkpoint/` y el próximo guardado crea `.old`
    dcfr.step()

    events = []
    real_fsync, real_rmtree = os.fsync, shutil.rmtree
    monkeypatch.setattr(ckpt.os, "fsync", lambda fd: (events.append(("fsync", os.readlink(f"/proc/self/fd/{fd}"))),
                                                      real_fsync(fd))[1])
    monkeypatch.setattr(ckpt.shutil, "rmtree", lambda p, *a, **k: (events.append(("rmtree", str(p))),
                                                                     real_rmtree(p, *a, **k))[1])
    save_checkpoint(dcfr, tmp_path)

    run = str(tmp_path)
    synced = [path for kind, path in events if kind == "fsync"]
    for name in ("state.pt", "adv0.npz", "adv1.npz", "strat.npz"):
        assert any(p.endswith(f"checkpoint.tmp/{name}") for p in synced), f"falta fsync de {name}"
    assert any(p.endswith("checkpoint.tmp") for p in synced), "falta fsync de la carpeta temporal"
    old_removed = next(i for i, (kind, path) in enumerate(events)
                       if kind == "rmtree" and path.endswith("checkpoint.old"))
    run_dir_syncs_before = [i for i, (kind, path) in enumerate(events[:old_removed])
                            if kind == "fsync" and path == run]
    assert len(run_dir_syncs_before) >= 2, "la carpeta de la corrida se sincroniza antes y después de los renombrados"
    last_file_sync = max(i for i, (kind, path) in enumerate(events[:old_removed])
                         if kind == "fsync" and "checkpoint.tmp" in path)
    assert last_file_sync < run_dir_syncs_before[0], "los archivos se sincronizan antes que la carpeta de la corrida"
    assert load_checkpoint(tmp_path, dcfr.cfg).iteration == 2
