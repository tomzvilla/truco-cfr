"""El puente con redes de verdad (usa `truco_train.model` y `truco_train.deepcfr`)."""
import numpy as np
import pytest
import torch
import truco_engine_py as eng

from truco_train.deepcfr import unpack
from truco_train.model import ScaledMlp


def truco_net(seed=0, hidden=16):
    torch.manual_seed(seed)
    _, _, scale = eng.game_info("truco")
    return ScaledMlp(scale, hidden, 2, 12)


def test_unpack_turns_the_bytes_into_numpy_arrays():
    batch = eng.traverse_batch("kuhn", 0, 7, 0, 100, None, None, 1)
    adv, strat, nodes = unpack(batch, 9, 2)
    assert adv[0].shape[1] == 9 and adv[1].shape[1] == 2
    assert len(adv[0]) == len(adv[1]) == len(adv[2]) > 0
    assert len(strat[0]) == len(strat[1]) == len(strat[2]) > 0
    assert nodes >= len(adv[0]) + len(strat[0])


def test_traversals_with_real_nets_do_not_depend_on_the_number_of_threads():
    net = truco_net().to_bytes()
    one = eng.traverse_batch("truco", 1, 11, 0, 90, net, net, 1)
    four = eng.traverse_batch("truco", 1, 11, 0, 90, net, net, 4)
    assert one == four


def test_rust_rejects_nets_that_do_not_fit_the_game():
    kuhn_net = ScaledMlp(np.ones(9, np.float32), 8, 1, 2).to_bytes()
    with pytest.raises(ValueError, match="net0"):
        eng.traverse_batch("truco", 0, 1, 0, 5, kuhn_net, None, 1)
    with pytest.raises(ValueError, match="net0"):
        eng.eval_duplicate("random", "strategy", kuhn_net, None, 1, 1, 1)


def test_exact_exploitability_of_a_net_policy():
    net = ScaledMlp(np.ones(9, np.float32), 8, 1, 2).to_bytes()
    assert eng.exploitability("kuhn", "strategy", net) > 0.0
    assert eng.exploitability("kuhn", "advantage", net, net) > 0.0


def test_eval_duplicate_counts_games():
    net = truco_net().to_bytes()
    wins, games = eng.eval_duplicate("random", "strategy", net, None, 4, 1, 2)
    assert games == 8 and 0 <= wins <= 8
    assert eng.eval_duplicate("heuristic", "advantage", net, net, 2, 1, 1)[1] == 4
