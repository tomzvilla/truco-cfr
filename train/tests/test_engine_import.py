import pytest
import truco_engine_py as eng


def test_game_info_for_each_game():
    assert eng.game_info("kuhn")[:2] == (9, 2)
    assert eng.game_info("minitruco")[:2] == (26, 12)
    encoding_size, n_actions, scale = eng.game_info("truco")
    assert (encoding_size, n_actions, len(scale)) == (304, 12, 304)


def test_unknown_game_is_a_value_error():
    with pytest.raises(ValueError, match="desconocido"):
        eng.game_info("poker")
