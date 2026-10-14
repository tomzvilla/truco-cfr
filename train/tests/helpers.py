import dataclasses

from truco_train.config import Config


def tiny_truco_config(**overrides) -> Config:
    """Una corrida de truco que termina en segundos (para smoke tests)."""
    base = dataclasses.asdict(Config())
    base.update(
        game="truco", seed=3, iterations=2, traversals=40, threads=2, hidden=32, n_hidden=2,
        adv_capacity=50_000, strat_capacity=50_000, adv_steps=20, batch_size=128, strat_steps=20,
        eval_every=1, eval_pairs=3, checkpoint_every=1, final_pairs=3, device="cpu",
    )
    base.update(overrides)
    return Config.from_dict(base)
