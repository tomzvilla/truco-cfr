import pytest

from truco_train.config import Config


def test_defaults_are_valid_and_roundtrip_through_json():
    cfg = Config()
    cfg.validate()
    assert Config.from_json(cfg.to_json()) == cfg


def test_from_dict_rejects_unknown_keys():
    with pytest.raises(ValueError, match="claves desconocidas"):
        Config.from_dict({"traversalz": 5})


def test_from_dict_turns_integers_into_floats_for_float_fields():
    cfg = Config.from_dict({"adv_scale": 10})
    assert isinstance(cfg.adv_scale, float)


@pytest.mark.parametrize(
    "bad",
    [{"traversals": 0}, {"game": "poker"}, {"device": "tpu"}, {"lr": -1.0}, {"seed": -1},
     {"time_budget_s": -1.0}, {"grad_clip": 0.0}],
)
def test_validate_rejects_nonsense(bad):
    with pytest.raises(ValueError):
        Config.from_dict(bad)


def test_booleans_and_integers_are_not_interchangeable():
    with pytest.raises(ValueError):
        Config.from_dict({"warm_start": 1})
    with pytest.raises(ValueError):
        Config.from_dict({"traversals": 2.5})


@pytest.mark.parametrize("name", ["adv_scale", "lr", "strat_lr", "grad_clip", "time_budget_s"])
@pytest.mark.parametrize("bad", [float("nan"), float("inf")])
def test_validate_rejects_nan_and_infinite_floats(name, bad):
    with pytest.raises(ValueError, match="finito"):
        Config.from_dict({name: bad})
