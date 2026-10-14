import numpy as np
import pytest
import torch

from truco_train.buffers import ReservoirBuffer
from truco_train.model import ScaledMlp
from truco_train.training import _masked_cross_entropy, _masked_mse, train_advantage, train_strategy

DEVICES = ["cpu"] + (["cuda"] if torch.cuda.is_available() else [])


def one_hot_buffer(values_by_class, masks_by_class, t_by_class=None, copies=200):
    """Un buffer donde la entrada es un one-hot de clase y el objetivo depende de la clase."""
    n_classes = len(values_by_class)
    buf = ReservoirBuffer(n_classes * copies * 2, n_classes, len(values_by_class[0]),
                          np.random.default_rng(0))
    for c in range(n_classes):
        enc = np.zeros((copies, n_classes), dtype=np.uint8)
        enc[:, c] = 1
        values = np.tile(np.asarray(values_by_class[c], dtype=np.float32), (copies, 1))
        masks = np.full(copies, masks_by_class[c], dtype=np.uint16)
        buf.add(enc, values, masks, t=1 if t_by_class is None else t_by_class[c])
    return buf


def small_net(n_in, n_out, device):
    torch.manual_seed(0)
    return ScaledMlp(np.ones(n_in, dtype=np.float32), hidden=32, n_hidden=2, n_out=n_out).to(device)


def predict(net, n_in, c, device):
    x = torch.zeros(1, n_in, dtype=torch.uint8, device=device)
    x[0, c] = 1
    with torch.no_grad():
        return net(x)[0].cpu()


def test_masked_mse_ignores_illegal_actions():
    pred = torch.tensor([[1.0, 5.0, 3.0]])
    target = torch.tensor([[1.0, -99.0, 3.0]])
    legal = torch.tensor([[True, False, True]])
    assert _masked_mse(pred, target, legal).item() == 0.0
    legal = torch.tensor([[True, True, True]])
    assert _masked_mse(pred, target, legal).item() > 100


def test_masked_cross_entropy_is_the_entropy_when_the_net_matches():
    probs = torch.tensor([[0.7, 0.3, 0.0]])
    logits = torch.log(torch.tensor([[0.7, 0.3, 1e-9]]))  # la acción 2 es ilegal
    legal = torch.tensor([[True, True, False]])
    expected = -(0.7 * np.log(0.7) + 0.3 * np.log(0.3))
    assert _masked_cross_entropy(logits, probs, legal).item() == pytest.approx(expected, abs=1e-5)


@pytest.mark.parametrize("device", DEVICES)
def test_advantage_net_learns_per_class_regrets_and_ignores_illegal_slots(device):
    # Clase 0: acciones 0 y 1 legales, regrets (2, -2). Clase 1: legales 1 y 2, regrets (1, 3).
    # El valor del lugar ilegal es basura que no tiene que influir.
    buf = one_hot_buffer([[2.0, -2.0, 777.0], [555.0, 1.0, 3.0]], [0b011, 0b110])
    net = small_net(2, 3, device)
    train_advantage(net, buf, steps=400, batch_size=256, lr=0.01, grad_clip=1.0, adv_scale=1.0,
                    seed=1)
    p0, p1 = predict(net, 2, 0, device), predict(net, 2, 1, device)
    assert p0[:2].tolist() == pytest.approx([2.0, -2.0], abs=0.15)
    assert p1[1:].tolist() == pytest.approx([1.0, 3.0], abs=0.15)


@pytest.mark.parametrize("device", DEVICES)
def test_advantage_training_weights_samples_by_iteration(device):
    # La misma entrada con objetivo 0 (t=1) y objetivo 10 (t=9): el promedio ponderado es 9.
    buf = ReservoirBuffer(1000, 1, 1, np.random.default_rng(0))
    enc = np.ones((200, 1), dtype=np.uint8)
    buf.add(enc, np.zeros((200, 1), np.float32), np.full(200, 1, np.uint16), t=1)
    buf.add(enc, np.full((200, 1), 10.0, np.float32), np.full(200, 1, np.uint16), t=9)
    net = small_net(1, 1, device)
    train_advantage(net, buf, steps=600, batch_size=256, lr=0.01, grad_clip=1.0, adv_scale=1.0,
                    seed=1)
    assert predict(net, 1, 0, device)[0].item() == pytest.approx(9.0, abs=0.5)


@pytest.mark.parametrize("device", DEVICES)
def test_adv_scale_divides_the_targets_without_touching_the_buffer(device):
    buf = one_hot_buffer([[4.0, -4.0], [-4.0, 4.0]], [0b11, 0b11])
    before = buf.values.copy()
    net = small_net(2, 2, device)
    train_advantage(net, buf, steps=400, batch_size=256, lr=0.01, grad_clip=1.0, adv_scale=4.0,
                    seed=1)
    assert np.array_equal(buf.values, before)
    assert predict(net, 2, 0, device)[0].item() == pytest.approx(1.0, abs=0.1)


@pytest.mark.parametrize("device", DEVICES)
def test_strategy_net_learns_the_sampled_distribution(device):
    buf = one_hot_buffer([[0.7, 0.3, 0.0], [0.0, 0.5, 0.5]], [0b011, 0b110])
    net = small_net(2, 3, device)
    train_strategy(net, buf, steps=400, batch_size=256, lr=0.01, grad_clip=1.0, seed=1)
    logits = predict(net, 2, 0, device)
    probs = torch.softmax(logits[:2], dim=0)
    assert probs.tolist() == pytest.approx([0.7, 0.3], abs=0.05)


def test_training_on_an_empty_buffer_fails_loudly():
    buf = ReservoirBuffer(10, 2, 2, np.random.default_rng(0))
    net = small_net(2, 2, "cpu")
    with pytest.raises(ValueError, match="vacío"):
        train_advantage(net, buf, steps=1, batch_size=4, lr=0.01, grad_clip=1.0, adv_scale=1.0,
                        seed=0)
