"""El puente Python <-> Rust, sin redes (no depende de `truco_train`)."""
import random

import numpy as np
import pytest
import truco_engine_py as eng

TRUCO_ENC = 304
ILLEGAL = "acción ilegal"


def legal_actions(mask):
    return [a for a in range(12) if mask & (1 << a)]


def unpack_block(enc, values, masks, enc_size, n_actions):
    return (
        np.frombuffer(enc, dtype=np.uint8).reshape(-1, enc_size),
        np.frombuffer(values, dtype="<f4").reshape(-1, n_actions),
        np.frombuffer(masks, dtype="<u2"),
    )


def test_traverse_batch_shapes_and_column_lengths():
    adv_enc, adv_val, adv_mask, st_enc, st_val, st_mask, nodes = eng.traverse_batch(
        "kuhn", 0, 7, 0, 100, None, None, 1
    )
    adv = unpack_block(adv_enc, adv_val, adv_mask, 9, 2)
    strat = unpack_block(st_enc, st_val, st_mask, 9, 2)
    assert len(adv[0]) == len(adv[1]) == len(adv[2]) > 0
    assert len(strat[0]) == len(strat[1]) == len(strat[2]) > 0
    assert nodes >= len(adv[0]) + len(strat[0])
    assert set(adv[2].tolist()) == {0b11}


def test_traverse_batch_with_uniform_policy_on_truco_has_valid_masks():
    out = eng.traverse_batch("truco", 1, 3, 0, 20, None, None, 2)
    adv = unpack_block(*out[:3], TRUCO_ENC, 12)
    assert len(adv[0]) >= 20 and (adv[2] != 0).all()
    # Los arrepentimientos de las acciones ilegales son exactamente 0.
    for row, mask in zip(adv[1], adv[2]):
        for a in range(12):
            if not mask & (1 << a):
                assert row[a] == 0.0


def test_traverse_batch_does_not_depend_on_the_number_of_threads():
    one = eng.traverse_batch("truco", 1, 11, 0, 90, None, None, 1)
    four = eng.traverse_batch("truco", 1, 11, 0, 90, None, None, 4)
    assert one == four


def test_traverse_batch_with_a_range_is_a_slice_of_the_whole():
    whole = eng.traverse_batch("kuhn", 0, 5, 0, 60, None, None, 2)
    a = eng.traverse_batch("kuhn", 0, 5, 0, 20, None, None, 2)
    b = eng.traverse_batch("kuhn", 0, 5, 20, 40, None, None, 2)
    assert whole[0] == a[0] + b[0]
    assert whole[6] == a[6] + b[6]


def test_traverse_batch_rejects_bad_arguments():
    with pytest.raises(ValueError, match="net1"):
        eng.traverse_batch("kuhn", 0, 1, 0, 5, None, b"basura", 1)
    with pytest.raises(ValueError, match="traverser"):
        eng.traverse_batch("kuhn", 2, 1, 0, 5, None, None, 1)
    with pytest.raises(ValueError, match="threads"):
        eng.traverse_batch("kuhn", 0, 1, 0, 5, None, None, 0)
    with pytest.raises(ValueError, match="desconocido"):
        eng.traverse_batch("poker", 0, 1, 0, 5, None, None, 1)


def test_exploitability_and_eval_validate_their_arguments_first():
    with pytest.raises(ValueError, match="modo"):
        eng.exploitability("kuhn", "mejor", b"x")
    with pytest.raises(ValueError, match="rival"):
        eng.eval_duplicate("marianogappa", "strategy", b"x", None, 1, 1, 1)
    with pytest.raises(ValueError, match="net0"):
        eng.exploitability("kuhn", "strategy", b"basura")
    with pytest.raises(ValueError, match="solo existe"):
        eng.exploitability("truco", "strategy", b"basura")


def test_mlp_forward_rejects_garbage():
    with pytest.raises(ValueError):
        eng.mlp_forward(b"basura", b"\x00" * 4)


def test_hand_rejects_illegal_actions_and_keeps_its_state():
    hand = eng.Hand(5)
    mask = hand.legal_mask()
    illegal = next(a for a in range(12) if not mask & (1 << a))
    with pytest.raises(ValueError, match=ILLEGAL):
        hand.apply(illegal)
    with pytest.raises(ValueError, match=ILLEGAL):
        hand.apply(99)
    assert hand.legal_mask() == mask, "una acción rechazada no puede cambiar el estado"


def test_hand_plays_to_the_end_with_random_legal_actions():
    rng = random.Random(0)
    for seed in range(50):
        hand = eng.Hand(seed)
        steps = 0
        while not hand.is_terminal():
            player = hand.current_player()
            assert player in (0, 1)
            assert len(hand.encode(player)) == TRUCO_ENC
            hand.apply(rng.choice(legal_actions(hand.legal_mask())))
            steps += 1
            assert steps < 100
        a, b = hand.returns()
        assert a == -b
        assert hand.current_player() is None
        with pytest.raises(ValueError, match="terminó"):
            hand.apply(0)


def test_hand_returns_and_encode_validate_their_arguments():
    hand = eng.Hand(1)
    with pytest.raises(ValueError, match="no terminó"):
        hand.returns()
    with pytest.raises(ValueError):
        hand.encode(2)
