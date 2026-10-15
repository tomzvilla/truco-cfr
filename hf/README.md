---
license: mit
library_name: onnx
tags:
  - game-ai
  - reinforcement-learning
  - counterfactual-regret-minimization
  - deep-cfr
  - card-games
  - truco
language:
  - es
---

# Truco CFR: a Deep CFR bot for Argentine truco

A small neural network (MLP, 304 → 256 → 256 → 256 → 12, about 850 KB) that plays heads-up Argentine
truco (to 30 points, no flor) with envido and truco. Trained from scratch by self-play with **Deep CFR**
(Brown et al., 2019) on a single RTX 5070 Ti: no human games, no LLM, no fine-tuning.

Play against it in the browser: see the project repository (link in the GitHub README).

## Files

| File | What it is |
|---|---|
| `model.onnx` | Full network. Input `features`: uint8[batch, 304] (the encoding in `engine/src/truco/encode.rs`). Output `logits`: float32[batch, 12]. |
| `model.safetensors` | Same weights for PyTorch (`ScaledMlp` in `train/truco_train/model.py`). |
| `strategy.tcfrw` | Same weights in the project's own format, read by the Rust engine (and the WASM build). |
| `config.json` | Sizes, action names and policy. |

**Policy:** softmax of the logits over the legal actions only. Actions, in order: `jugar0, jugar1, jugar2,
envido, realEnvido, faltaEnvido, truco, retruco, valeCuatro, quiero, noQuiero, mazo` (`jugar{i}` = play the
i-th card of the hand sorted from strongest to weakest).

**Parity:** PyTorch, Rust, ONNX Runtime and WebAssembly outputs agree within 1e-4 (tests in the repo).

## Results

Full matches to 30, duplicate format (each deal played twice with seats swapped):

| Opponent | Matches | Bot wins | 95% Wilson CI |
|---|---|---|---|
| Random legal moves | 2000 | 90.9 % | [89.6; 92.1] |
| Hand-written heuristic | 2000 | 63.4 % | [61.3; 65.5] |
| Claude Haiku (LLM reading the table as text) | 100 | 59.0 % | [49.2; 68.1] |

It learned to bluff: it calls envido with 7 points or less in 38 % of those hands, and 17 % of its truco
calls come with a hand in the weakest 30 % (the heuristic: 0 %). Details in `docs/eval-report.md`.

## Limitations

Heads-up only, no flor, house rules ("reglas de bar"). Evaluated against a heuristic and an LLM, not
against strong human players. The Claude Haiku sample is small (100 matches).

## License

Code and weights: MIT. Card art used by the web app is by Jose Angel Canabal and is **not** MIT.
