import pytest
import torch

# Con redes tan chicas, un solo hilo de torch es más rápido y además determinista.
torch.set_num_threads(1)


@pytest.fixture(scope="session")
def tiny_run(tmp_path_factory):
    """Una corrida completa de 2 iteraciones en truco, compartida por varios tests."""
    from truco_train.run import start

    from .helpers import tiny_truco_config

    runs = tmp_path_factory.mktemp("runs")
    return start(tiny_truco_config(), runs, run_id="tiny")
