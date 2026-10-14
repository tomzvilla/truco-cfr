import numpy as np
import pytest

from truco_train.buffers import ReservoirBuffer


def batch(n, start=0, enc_size=4, width=2):
    ids = np.arange(start, start + n)
    enc = np.tile((ids % 256).astype(np.uint8)[:, None], (1, enc_size))
    values = np.tile(ids.astype(np.float32)[:, None], (1, width))
    return enc, values, np.full(n, 0b11, dtype=np.uint16)


def test_fills_in_order_until_capacity():
    buf = ReservoirBuffer(10, 4, 2, np.random.default_rng(0))
    buf.add(*batch(6), t=1)
    assert len(buf) == 6 and buf.seen == 6
    assert list(buf.values[:6, 0]) == [0, 1, 2, 3, 4, 5]
    buf.add(*batch(2, start=6), t=2)
    assert len(buf) == 8
    assert list(buf.t[:8]) == [1] * 6 + [2] * 2


def test_never_grows_past_capacity_and_counts_everything_seen():
    buf = ReservoirBuffer(10, 4, 2, np.random.default_rng(0))
    for i in range(5):
        buf.add(*batch(100, start=i * 100), t=i + 1)
    assert len(buf) == 10 and buf.seen == 500


def test_reservoir_is_uniform_over_the_whole_stream():
    # 10 lotes de 1000; capacidad 500: cada lote tiene que aportar cerca de 50 muestras.
    buf = ReservoirBuffer(500, 4, 2, np.random.default_rng(1))
    for i in range(10):
        buf.add(*batch(1000, start=i * 1000), t=i + 1)
    counts = np.bincount(buf.t, minlength=11)[1:]
    assert counts.sum() == 500
    assert counts.min() >= 25 and counts.max() <= 80, counts


def test_rejects_batches_with_mismatched_lengths():
    buf = ReservoirBuffer(10, 4, 2, np.random.default_rng(0))
    enc, values, masks = batch(5)
    with pytest.raises(ValueError):
        buf.add(enc, values[:4], masks, t=1)


def test_empty_batch_is_a_no_op():
    buf = ReservoirBuffer(10, 4, 2, np.random.default_rng(0))
    buf.add(*batch(0), t=1)
    assert len(buf) == 0 and buf.seen == 0


@pytest.mark.parametrize("compress", [True, False])
def test_save_and_load_roundtrip(tmp_path, compress):
    buf = ReservoirBuffer(50, 4, 2, np.random.default_rng(0))
    for i in range(4):
        buf.add(*batch(40, start=i * 40), t=i + 1)
    path = tmp_path / "buf.npz"
    buf.save(path, compress)
    other = ReservoirBuffer(50, 4, 2, np.random.default_rng(0))
    other.load(path)
    assert (other.size, other.seen) == (buf.size, buf.seen)
    for name in ("enc", "values", "masks", "t"):
        assert np.array_equal(getattr(other, name)[: other.size], getattr(buf, name)[: buf.size])


def test_load_rejects_a_checkpoint_bigger_than_the_capacity(tmp_path):
    buf = ReservoirBuffer(50, 4, 2, np.random.default_rng(0))
    buf.add(*batch(50), t=1)
    buf.save(tmp_path / "buf.npz")
    small = ReservoirBuffer(10, 4, 2, np.random.default_rng(0))
    with pytest.raises(ValueError, match="capacidad"):
        small.load(tmp_path / "buf.npz")


def test_load_rejects_a_checkpoint_with_different_widths(tmp_path):
    buf = ReservoirBuffer(50, 4, 2, np.random.default_rng(0))
    buf.add(*batch(20), t=1)
    buf.save(tmp_path / "buf.npz")
    for enc_size, width in ((5, 2), (4, 3)):
        other = ReservoirBuffer(50, enc_size, width, np.random.default_rng(0))
        with pytest.raises(ValueError, match="ancho"):
            other.load(tmp_path / "buf.npz")
