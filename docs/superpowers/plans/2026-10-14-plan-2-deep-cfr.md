# Plan 2 — Deep CFR: entrenamiento del bot — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entrenar desde cero, con Deep CFR y juego contra sí mismo, la red de estrategia del bot de truco, y dejar como producto final `runs/<id>/strategy.tcfrw` (pesos en formato TCFRW1), las métricas de la corrida y un informe corto (`docs/training-report.md`).

**Architecture:** Los recorridos de Deep CFR (muestreo externo, ponderación lineal) corren en Rust sobre el motor del Plan 1: una función genérica sobre `Game`, de un solo hilo y determinista, que usa el forward del MLP (TCFRW1) para las dos redes de ventajas y devuelve muestras como bytes. Un crate nuevo `engine-py` (PyO3 + maturin, abi3) las paraleliza con rayon en 8 hilos y las entrega a Python, donde buffers de reservorio en numpy (el infoset guardado como los `u8` de la codificación) alimentan el entrenamiento en la GPU con PyTorch. Cada iteración exporta las redes a TCFRW1 y las vuelve a pasar a Rust; al final se entrena la red de estrategia promedio. La política (regret matching, softmax enmascarado, `MlpAgent`) vive en una sola función de `engine`, la misma que usará la web vía WASM.

**Tech Stack:** Rust stable (el crate `truco-engine` conserva `rand` como única dependencia); `engine-py` con `pyo3 0.25` (abi3-py312), `rayon`; Python 3.12 + uv, PyTorch 2.x con CUDA 12.8, numpy, pytest, maturin. Todo dentro de WSL Ubuntu.

**Spec:** `docs/superpowers/specs/2026-10-13-truco-cfr-design.md` (secciones 3.2, 4, 6 y 7). Plan anterior: `docs/superpowers/plans/2026-10-13-plan-1-motor-cfr.md` (motor, ya terminado y testeado).

## Global Constraints

- Todo comando corre en WSL Ubuntu: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && <comando>'`. Si se trabaja en un worktree, reemplazar `~/projects/truco-cfr` por la ruta del worktree. Los comandos de Python van desde `train/` (`cd ~/projects/truco-cfr/train && ...`), y las corridas escriben en `train/runs/<id>/` (ya está en `.gitignore`).
- **Costo de las pruebas (hook del usuario):** `pytest` se corre siempre sobre un archivo o un test (`uv run --no-sync pytest tests/test_x.py -q 2>&1 | tail -20`), nunca sobre toda la carpeta; los tests de Rust, sobre un binario (`cargo test -p truco-engine --test policy 2>&1 | tail -20`). La suite completa la corre una sola vez la sesión principal, al final, con `| tail`.
- Rust stable, edition 2021. **La única dependencia de `truco-engine` sigue siendo `rand = { version = "0.8", features = ["small_rng"] }`** (tiene que seguir compilando a `wasm32-unknown-unknown`). `rayon` y `pyo3` viven solo en `engine-py`.
- Cada tarea de Rust deja `cargo clippy -p truco-engine --all-targets -- -D warnings` y `cargo fmt --check` limpios; `engine-py` se chequea con `cargo clippy -p truco-engine-py --all-targets -- -D warnings`. Como `default-members = ["engine"]`, `cargo test` en la raíz prueba solo el motor.
- Python `>=3.12,<3.13` con uv. `torch>=2.7` del índice `https://download.pytorch.org/whl/cu128` (obligatorio para la RTX 5070 Ti). Siempre `uv run --no-sync ...` después del primer `uv sync` (así uv no toca el paquete de `engine-py` que instala maturin).
- **Índices de acciones fijos (0..11), compartidos con la web:** `jugar0, jugar1, jugar2, envido, realEnvido, faltaEnvido, truco, retruco, valeCuatro, quiero, noQuiero, mazo`. `ENCODING_SIZE` del truco = 304 bytes (`u8`), multiplicados por `feature_scale()` antes de entrar a la red.
- **Formato de pesos `TCFRW1`** (`docs/weights-format.md`): es el contrato con Rust y con el WASM del Plan 4. El escritor de Python tiene que producir exactamente los mismos bytes que el de referencia del documento.
- **Una sola política:** todo lo que convierte la salida de una red en probabilidades vive en `engine/src/policy.rs`. Ni Python ni la web la reimplementan.
- Toda acción que cruza la frontera Python → Rust se valida contra la máscara de legales y levanta `ValueError` (el `apply` del motor solo hace `debug_assert`).
- Los tests son deterministas (semillas fijas). Los umbrales del spec (Kuhn < 0,01) no se relajan: si un test no llega, se suben iteraciones o recorridos, nunca el umbral.
- Commits con mensajes convencionales y la línea final `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Los identificadores van en inglés, salvo los términos del dominio (envido, baza, mano, truco). Los comentarios, mensajes de error y la documentación, en español.

## Decisiones tomadas al planificar (desvíos y precisiones respecto del spec)

1. **ONNX se descarta.** La web corre nuestro MLP de Rust compilado a WASM, así que el test de paridad del spec (§4: PyTorch = Rust = ONNX = WASM) pasa a ser PyTorch = Rust (Tarea 7); el WASM lo cubre el Plan 4. La publicación en Hugging Face (§3.5) no incluye ONNX: va `strategy.tcfrw` (y safetensors, si se quiere).
2. **K = 5 000 recorridos por jugador y por iteración en la corrida larga, no 20 000.** La velocidad real de los recorridos con redes entrenadas (Tarea 9 y 10) es menor que la estimación de `docs/benchmarks.md` porque los recorridos de muestreo externo se ramifican en los nodos propios: con una red entrenada de 3×128 se midieron ~600 recorridos/s, no 2 470. La Tarea 10 explica cómo recalcular K.
3. **Dos redes de ventajas (una por jugador) y una sola red de estrategia promedio**, que sirve para los dos asientos porque la codificación es relativa al jugador (incluye "soy mano").
4. **La iteración `t` no viaja desde Rust:** es constante en cada lote, así que Python la agrega al insertar en el buffer (`buffer.add(enc, values, masks, t)`).
5. **`regret_matching` y `masked_softmax` reciben un `&[f32]`** (no `&[f32; 12]`) porque Kuhn tiene 2 acciones; devuelven `[f32; 12]` con ceros en las ilegales.
6. **Las redes viajan como bytes TCFRW1 en cada iteración** (Python → Rust). Así el formato de producción se ejercita en cada paso del entrenamiento.
7. **Los arrepentimientos se dividen por `adv_scale` al entrenar** (default 10) y el regret matching no se entera: es invariante a la escala. Las redes exportadas quedan en esa escala, sin deshacerla.
8. **El monitoreo usa partidos completos a 30 en formato duplicado** (`eval_pairs` pares = `2 × eval_pairs` partidos), no "1 000 manos": es la unidad que usa el torneo del Plan 3 y reutiliza `play_duplicate`.
9. **Deep CFR en Kuhn con redes llega a ~0,005–0,008** de explotabilidad exacta (medido con 4 semillas, 60 iteraciones y 20 000 recorridos por iteración, con una MLP de 2×64); el umbral del spec es 0,01. Es el piso del ruido de ajustar redes, no un bug: el margen es chico a propósito y la nota de la Tarea 7 dice qué mover si una máquina da peor.
10. **`pyo3` queda fijado en 0.25** (la API que usa el plan: `Bound`, `allow_threads`). Subirlo a una versión posterior exige revisar `allow_threads` (renombrado `detach` en versiones nuevas).
11. **RAM:** `docs/benchmarks.md` anota que WSL ve 15 GB (no 31). Los buffers de la corrida larga ocupan ~6 GB más ~3 GB de contexto de CUDA y torch: entra, pero conviene subir el límite de WSL (Tarea 11, paso de preparación).

## Review Focus

Entradas y condiciones que el spec no nombra y que pueden romper este software sin que ningún test del camino feliz lo note, de más a menos probable:

1. **Acciones ilegales o salidas de red absurdas (NaN, todo negativo, ventajas positivas en acciones ilegales):** la política nunca puede elegir una acción fuera de la máscara. → Tests `regret_matching_*` y `masked_softmax_*` (Tarea 1), `mlp_agent_only_plays_legal_moves_in_full_matches` (Tarea 3).
2. **Una acción ilegal que llega desde Python:** tiene que dar `ValueError` y dejar el estado intacto (en release, el motor no lo chequea). → Tests `test_hand_rejects_illegal_actions_and_keeps_its_state` y `test_hand_plays_to_the_end_with_random_legal_actions` (Tarea 4).
3. **Muestras del jugador equivocado:** si una muestra de ventaja se codifica desde el punto de vista del rival, o una de estrategia sale de un nodo propio, la red aprende mal sin que nada falle. → Test `kuhn_samples_belong_to_the_right_player` y el cálculo a mano `kuhn_regret_of_betting_with_a_king_matches_the_hand_computation` (Tarea 2).
4. **Reservorio sesgado:** si el buffer favorece las muestras recientes (o las viejas), la ponderación lineal por `t` deja de significar lo que dice. → Test `test_reservoir_is_uniform_over_the_whole_stream` (Tarea 5).
5. **Reanudar no es continuar:** un checkpoint que pierde buffers, estado del RNG o la iteración cambia el resultado de la noche entera sin avisar; un corte de luz a mitad del guardado no puede destruir el último checkpoint bueno. → Tests `test_a_restored_checkpoint_continues_exactly_like_the_original` y `test_saving_a_second_checkpoint_replaces_the_first` (Tarea 8).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `Cargo.toml` (modificar) | Agrega `engine-py` al workspace; `default-members = ["engine"]`. |
| `engine/src/policy.rs` (crear) | `regret_matching`, `masked_softmax`, `policy_probs`, `sample_action`, `PolicyKind`: la política compartida. |
| `engine/src/traversal.rs` (crear) | Recorrido de Deep CFR con muestreo externo, genérico sobre `Game`; `SampleBlock`, `TraversalOutput`, `run_traversals`. |
| `engine/src/mlp_agent.rs` (crear) | `MlpAgent`: juega al truco con redes (regret matching o softmax). |
| `engine/src/net_eval.rs` (crear) | `net_exploitability`: explotabilidad exacta de una política de redes en Kuhn/MiniTruco. |
| `engine-py/` (crear) | Crate PyO3: `game_info`, `traverse_batch` (rayon), `exploitability`, `eval_duplicate`, `mlp_forward`, `Hand`. |
| `train/pyproject.toml` (modificar) | Dependencias de desarrollo (pytest, maturin) y configuración de pytest. |
| `train/truco_train/config.py` | `Config`: parámetros de una corrida, leídos de TOML. |
| `train/truco_train/weights.py` | Escritor/lector TCFRW1 (idéntico al de referencia). |
| `train/truco_train/model.py` | `ScaledMlp`: entrada `u8 × feature_scale` → MLP. |
| `train/truco_train/buffers.py` | `ReservoirBuffer` (numpy, `u8`) con guardado/carga. |
| `train/truco_train/training.py` | Pérdidas (MSE enmascarado, entropía cruzada enmascarada) y bucles de entrenamiento en GPU. |
| `train/truco_train/deepcfr.py` | `DeepCfr`: una iteración = recorridos en Rust + entrenamiento; red de estrategia. |
| `train/truco_train/monitor.py` | Evaluación barata de la política actual; intervalo de Wilson. |
| `train/truco_train/checkpoint.py` | Guardado atómico y carga de checkpoints. |
| `train/truco_train/run.py` | `start`, `resume`, `drive`, `finalize`. |
| `train/truco_train/report.py` | Informe de entrenamiento en Markdown a partir de una corrida. |
| `train/truco_train/__main__.py` | CLI: `run`, `resume`, `report`. |
| `train/scripts/bench_traversal.py` | Medición de velocidad real y recomendación de K. |
| `train/configs/{smoke,short,overnight}.toml` | Configuraciones de la prueba de humo, la corrida corta y la larga. |
| `train/tests/*.py` | Tests de Python (uno por módulo, más convergencia, paridad y smoke). |
| `docs/benchmarks.md` (modificar) | Mediciones del Plan 2. |
| `docs/training-report.md` (crear, generado) | Informe final de la corrida larga. |

## Orden y paralelismo

```
T0 ─┬─ Pista A (Rust):   T1 → T2 → T3 → T4 ──┐
    └─ Pista B (Python): T5 → T6 ────────────┴→ T7 → T8 → T9 → T10 → T11
```

- Después de la T0, las pistas A y B tocan archivos distintos (`engine*` contra `train/truco_train`, `train/tests`) y pueden correr en paralelo (cada una en su worktree; los únicos archivos compartidos son los que crea la T0, que no se vuelven a tocar).
- La T7 (Deep CFR completo, convergencia en Kuhn/MiniTruco y paridad) necesita las dos pistas. De la T7 en adelante todo es secuencial: la T10 y la T11 son corridas largas de la GPU y usan los 8 hilos, así que no se superponen con nada.
- La T10 (corrida corta, ~30 min) y la T11 (corrida larga, 8–10 h) son tareas de *ejecución*: producen datos, no solo código. La T11 se lanza de noche.

---

### Task 0: Preparación — workspace, `engine-py` (esqueleto) y entorno de Python

**En criollo:** el entrenamiento necesita que Python le pida cosas al motor de Rust. Para eso armamos un "puente": un paquete de Python (`truco_engine_py`) escrito en Rust, que se compila con una herramienta llamada maturin y se instala dentro del entorno de Python del proyecto. Esta tarea monta el puente con una sola función de juguete (`game_info`, que dice cuántos bytes mide una situación y cuántas acciones hay) para comprobar que todo se compila, se instala y se importa. Las tareas siguientes le agregan las funciones de verdad. También acá se dejan listas las herramientas de prueba de Python.

**Files:**
- Modify: `Cargo.toml`
- Create: `engine-py/Cargo.toml`, `engine-py/pyproject.toml`, `engine-py/src/lib.rs`
- Modify: `train/pyproject.toml`
- Create: `train/tests/__init__.py`, `train/tests/conftest.py`
- Test: `train/tests/test_engine_import.py`

**Interfaces:**
- Consumes: `truco_engine::game::Game` (`ENCODING_SIZE`, `NUM_ACTIONS`, `feature_scale()`), `Kuhn`, `MiniTruco`, `TrucoGame`.
- Produces: módulo de Python `truco_engine_py` con `game_info(game: str) -> (int, int, list[float])` (tamaño de la codificación, cantidad de acciones, factor de escala por byte); `game` es `"kuhn"`, `"minitruco"` o `"truco"` (otro nombre → `ValueError`). Entorno `train/.venv` con `pytest` y `maturin`.

- [ ] **Step 1: Workspace de Cargo y dependencias de Python**

`Cargo.toml` (reemplazar):
```toml
[workspace]
resolver = "2"
members = ["engine", "engine-py"]
# `cargo test` / `cargo build` en la raíz tocan solo el motor; engine-py se compila con maturin.
default-members = ["engine"]

[profile.release]
debug = 1

[profile.test]
opt-level = 2
```

`engine-py/Cargo.toml`:
```toml
[package]
name = "truco-engine-py"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
name = "truco_engine_py"
crate-type = ["cdylib"]

[features]
# maturin lo enciende (ver pyproject.toml). Sin él, `cargo clippy` y `cargo build` linkean normal.
extension-module = ["pyo3/extension-module"]

[dependencies]
truco-engine = { path = "../engine" }
pyo3 = { version = "0.25", features = ["abi3-py312"] }
rayon = "1.10"
rand = { version = "0.8", features = ["small_rng"] }
```

`engine-py/pyproject.toml`:
```toml
[build-system]
requires = ["maturin>=1.7,<2.0"]
build-backend = "maturin"

[project]
name = "truco-engine-py"
version = "0.1.0"
requires-python = ">=3.12"

[tool.maturin]
features = ["extension-module"]
module-name = "truco_engine_py"
```

`train/pyproject.toml` (reemplazar):
```toml
[project]
name = "truco-train"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = ["torch>=2.7", "numpy>=2"]

[dependency-groups]
dev = ["pytest>=8", "maturin>=1.7,<2"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.uv.sources]
torch = [{ index = "pytorch-cu128" }]

[[tool.uv.index]]
name = "pytorch-cu128"
url = "https://download.pytorch.org/whl/cu128"
explicit = true
```

`train/tests/__init__.py`: archivo vacío.

`train/tests/conftest.py` (con redes tan chicas, un solo hilo de torch es más rápido y determinista):
```python
import torch

torch.set_num_threads(1)
```

- [ ] **Step 2: Escribir el test que falla**

`train/tests/test_engine_import.py`:
```python
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
```

- [ ] **Step 3: Instalar el entorno y ver que el test falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv sync 2>&1 | tail -5 && uv run --no-sync pytest tests/test_engine_import.py -q 2>&1 | tail -8'`
Expected: `uv sync` instala `pytest` y `maturin` (y no vuelve a bajar torch si ya estaba); el test falla en la importación con `ModuleNotFoundError: No module named 'truco_engine_py'`.

- [ ] **Step 4: El esqueleto del puente**

`engine-py/src/lib.rs`:
```rust
//! Puente Python <-> motor. Esqueleto: la Tarea 4 lo completa con el resto de las funciones.
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use truco_engine::game::Game;
use truco_engine::kuhn::Kuhn;
use truco_engine::minitruco::MiniTruco;
use truco_engine::truco::TrucoGame;

/// Ejecuta `$body` con `$G` = el juego pedido por nombre.
macro_rules! with_game {
    ($name:expr, $G:ident => $body:expr) => {
        match $name {
            "kuhn" => {
                type $G = Kuhn;
                $body
            }
            "minitruco" => {
                type $G = MiniTruco;
                $body
            }
            "truco" => {
                type $G = TrucoGame;
                $body
            }
            other => Err(PyValueError::new_err(format!(
                "juego desconocido: {other} (kuhn, minitruco o truco)"
            ))),
        }
    };
}

/// (tamaño de la codificación, cantidad de acciones, factor de escala de cada byte de entrada)
#[pyfunction]
fn game_info(game: &str) -> PyResult<(usize, usize, Vec<f32>)> {
    with_game!(game, G => Ok((G::ENCODING_SIZE, G::NUM_ACTIONS, G::feature_scale())))
}

#[pymodule]
fn truco_engine_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(game_info, m)?)?;
    Ok(())
}
```

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync maturin develop --release --uv -m ../engine-py/Cargo.toml 2>&1 | tail -8'`
Expected: la primera vez baja y compila `pyo3` y `rayon` (1–2 minutos); termina con `Built wheel for abi3 Python ≥ 3.12` y `Installed truco-engine-py-0.1.0`.

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_engine_import.py -q 2>&1 | tail -8'`
Expected: `2 passed`.

- [ ] **Step 6: Verificar que lo anterior sigue andando**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test kuhn_cfr 2>&1 | tail -5 && cargo clippy -p truco-engine-py --all-targets -- -D warnings 2>&1 | tail -3 && cargo fmt --check && cd train && uv run --no-sync python scripts/check_gpu.py 2>&1 | tail -4'`
Expected: los tests de `kuhn_cfr` pasan, clippy y fmt sin avisos, y `check_gpu.py` termina con `matmul OK`.

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml Cargo.lock engine-py train/pyproject.toml train/uv.lock train/tests
git commit -m "chore: engine-py skeleton (PyO3 + maturin) and Python test setup" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: La política compartida — regret matching, softmax enmascarado y muestreo

**En criollo:** una red neuronal, por sí sola, devuelve una lista de números. Para jugar hace falta convertirlos en probabilidades de cada jugada, respetando que algunas jugadas no se pueden hacer en ese momento (la "máscara"). Hay dos recetas. **Regret matching**: la red dice cuánto "se arrepintió" de no haber hecho cada jugada; se juega en proporción al arrepentimiento positivo, y si ninguno es positivo se juega la jugada con menos arrepentimiento negativo. **Softmax**: la red da una puntuación por jugada y se juega en proporción a `e^puntuación`. Estas recetas se escriben **una sola vez**, acá, y las usan el entrenamiento, el bot que juega partidos y, más adelante, la web. Si cada uno tuviera su copia, el bot de la web jugaría distinto del que se entrenó.

**Files:**
- Create: `engine/src/policy.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod policy;`)
- Test: `engine/tests/policy.rs`

**Interfaces:**
- Consumes: `game::{actions_of, Action, ActionMask}`, `mlp::Mlp` (`forward`, `output_size`).
- Produces: `MAX_ACTIONS: usize = 12`; `type Probs = [f32; MAX_ACTIONS]`; `enum PolicyKind { Advantage, Strategy }`; `uniform(mask: ActionMask) -> Probs`; `regret_matching(adv: &[f32], mask: ActionMask) -> Probs`; `masked_softmax(logits: &[f32], mask: ActionMask) -> Probs`; `policy_probs(net: Option<&Mlp>, kind: PolicyKind, enc: &[u8], mask: ActionMask) -> Probs` (sin red = uniforme); `sample_action(probs: &Probs, mask: ActionMask, rng: &mut dyn RngCore) -> Action`. Todas hacen `panic` con máscara vacía o con máscara que sale de las acciones de la red.

- [ ] **Step 1: Escribir los tests que fallan**

`engine/tests/policy.rs`:
```rust
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::game::bit;
use truco_engine::mlp::{Layer, Mlp};
use truco_engine::policy::{
    masked_softmax, policy_probs, regret_matching, sample_action, uniform, PolicyKind,
};

fn close(a: &[f32], b: &[f32]) {
    assert_eq!(a.len(), b.len());
    for (x, y) in a.iter().zip(b) {
        assert!((x - y).abs() < 1e-6, "{a:?} != {b:?}");
    }
}

#[test]
fn regret_matching_is_proportional_to_the_positive_part() {
    let adv = [2.0, -1.0, 6.0];
    let p = regret_matching(&adv, bit(0) | bit(1) | bit(2));
    close(&p[..3], &[0.25, 0.0, 0.75]);
    assert!(p[3..].iter().all(|&x| x == 0.0));
}

#[test]
fn regret_matching_ignores_illegal_actions_even_with_big_advantage() {
    let adv = [1.0, 100.0, 1.0];
    let p = regret_matching(&adv, bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn regret_matching_without_positive_regret_picks_the_best_legal_action() {
    let p = regret_matching(&[-3.0, -1.0, -2.0], bit(0) | bit(1) | bit(2));
    close(&p[..3], &[0.0, 1.0, 0.0]);
    // La acción 1 no es legal: gana la mejor de las legales (la 2).
    let p = regret_matching(&[-3.0, 5.0, -2.0], bit(0) | bit(2));
    close(&p[..3], &[0.0, 0.0, 1.0]);
}

#[test]
fn regret_matching_with_nan_is_uniform_over_legal() {
    let p = regret_matching(&[f32::NAN, f32::NAN, f32::NAN], bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn masked_softmax_is_uniform_for_equal_logits_and_zero_on_illegal() {
    let p = masked_softmax(&[0.0, 0.0, 0.0], bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn masked_softmax_is_stable_for_huge_logits() {
    let p = masked_softmax(&[1000.0, 999.0], bit(0) | bit(1));
    assert!(p.iter().all(|x| x.is_finite()));
    assert!((p[0] + p[1] - 1.0).abs() < 1e-6);
    assert!(p[0] > p[1]);
}

#[test]
#[should_panic(expected = "fuera de las")]
fn rejects_mask_outside_the_network_outputs() {
    regret_matching(&[1.0, 2.0], bit(5));
}

#[test]
#[should_panic(expected = "máscara vacía")]
fn rejects_empty_mask() {
    uniform(0);
}

#[test]
fn policy_probs_without_net_is_uniform() {
    let p = policy_probs(
        None,
        PolicyKind::Advantage,
        &[0u8; 304],
        bit(3) | bit(9) | bit(11),
    );
    close(&p[..12], &uniform(bit(3) | bit(9) | bit(11))[..12]);
}

#[test]
fn policy_probs_applies_the_requested_rule_to_the_net_output() {
    // Una sola capa con pesos 0: la salida es exactamente el sesgo.
    let bias: Vec<f32> = (0..12).map(|i| i as f32 - 4.0).collect();
    let net = Mlp::new(
        vec![Layer {
            inp: 304,
            out: 12,
            w: vec![0.0; 304 * 12],
            b: bias.clone(),
        }],
        vec![1.0; 304],
    );
    let mask = bit(2) | bit(5) | bit(6) | bit(9);
    let x = [0u8; 304];
    close(
        &policy_probs(Some(&net), PolicyKind::Advantage, &x, mask),
        &regret_matching(&bias, mask),
    );
    close(
        &policy_probs(Some(&net), PolicyKind::Strategy, &x, mask),
        &masked_softmax(&bias, mask),
    );
}

#[test]
fn sample_action_follows_the_probabilities_and_the_mask() {
    let mut rng = SmallRng::seed_from_u64(5);
    let mask = bit(0) | bit(2);
    let probs = regret_matching(&[1.0, 0.0, 3.0], mask);
    let mut counts = [0u32; 3];
    for _ in 0..20_000 {
        counts[sample_action(&probs, mask, &mut rng)] += 1;
    }
    assert_eq!(counts[1], 0, "acción ilegal elegida");
    let share = counts[2] as f64 / 20_000.0;
    assert!((share - 0.75).abs() < 0.02, "participación {share}");
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test policy 2>&1 | tail -8'`
Expected: error de compilación `unresolved import truco_engine::policy`.

- [ ] **Step 3: Implementar**

`engine/src/policy.rs`:
```rust
//! Política compartida por el entrenamiento (Deep CFR), `MlpAgent` y, más adelante, el WASM.
//! Todo lo que convierte la salida de una red en probabilidades vive acá, para que el
//! entrenamiento y la web jueguen exactamente igual.
use crate::game::{actions_of, Action, ActionMask};
use crate::mlp::Mlp;
use rand::{Rng, RngCore};

/// Cantidad máxima de acciones de cualquier juego (el truco usa las 12).
pub const MAX_ACTIONS: usize = 12;

/// Probabilidad de cada acción; las acciones ilegales valen 0.
pub type Probs = [f32; MAX_ACTIONS];

/// De dónde sale la política a partir de la salida de la red.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PolicyKind {
    /// La red predice ventajas (arrepentimientos): se juega con regret matching.
    Advantage,
    /// La red predice logits de la estrategia promedio: se juega con softmax.
    Strategy,
}

/// Uniforme sobre las acciones legales.
pub fn uniform(mask: ActionMask) -> Probs {
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    let n = actions_of(mask).count() as f32;
    let mut out = [0.0; MAX_ACTIONS];
    for a in actions_of(mask) {
        out[a] = 1.0 / n;
    }
    out
}

fn check(len: usize, mask: ActionMask) {
    assert!(len <= MAX_ACTIONS, "demasiadas acciones: {len}");
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    assert_eq!(
        (mask as u32) >> len,
        0,
        "la máscara {mask:#b} tiene acciones fuera de las {len} de la red"
    );
}

/// Regret matching sobre las acciones legales: proporcional a la parte positiva de la ventaja.
/// Si ninguna ventaja es positiva, toda la probabilidad va a la acción legal con mayor ventaja
/// (como en Brown et al., 2019).
pub fn regret_matching(adv: &[f32], mask: ActionMask) -> Probs {
    check(adv.len(), mask);
    let mut out = [0.0; MAX_ACTIONS];
    let total: f32 = actions_of(mask).map(|a| adv[a].max(0.0)).sum();
    if total > 0.0 && total.is_finite() {
        for a in actions_of(mask) {
            out[a] = adv[a].max(0.0) / total;
        }
        return out;
    }
    let mut best: Option<Action> = None;
    for a in actions_of(mask) {
        if adv[a].is_finite() && best.is_none_or(|b| adv[a] > adv[b]) {
            best = Some(a);
        }
    }
    match best {
        Some(a) => out[a] = 1.0,
        None => return uniform(mask),
    }
    out
}

/// Softmax sobre las acciones legales (numéricamente estable).
pub fn masked_softmax(logits: &[f32], mask: ActionMask) -> Probs {
    check(logits.len(), mask);
    let max = actions_of(mask)
        .map(|a| logits[a])
        .filter(|x| x.is_finite())
        .fold(f32::NEG_INFINITY, f32::max);
    if max == f32::NEG_INFINITY {
        return uniform(mask);
    }
    let mut out = [0.0; MAX_ACTIONS];
    let mut total = 0.0;
    for a in actions_of(mask) {
        out[a] = if logits[a].is_finite() {
            (logits[a] - max).exp()
        } else {
            0.0
        };
        total += out[a];
    }
    for a in actions_of(mask) {
        out[a] /= total;
    }
    out
}

/// Política de una red sobre una codificación. Sin red (`None`) es uniforme: así arranca la
/// iteración 1 de Deep CFR, cuando todavía no hay ventajas.
pub fn policy_probs(net: Option<&Mlp>, kind: PolicyKind, enc: &[u8], mask: ActionMask) -> Probs {
    let Some(net) = net else {
        return uniform(mask);
    };
    let n = net.output_size();
    assert!(
        n <= MAX_ACTIONS,
        "la red tiene {n} salidas (máximo {MAX_ACTIONS})"
    );
    let mut raw = [0.0f32; MAX_ACTIONS];
    net.forward(enc, &mut raw[..n]);
    match kind {
        PolicyKind::Advantage => regret_matching(&raw[..n], mask),
        PolicyKind::Strategy => masked_softmax(&raw[..n], mask),
    }
}

/// Elige una acción legal según `probs`.
pub fn sample_action(probs: &Probs, mask: ActionMask, rng: &mut dyn RngCore) -> Action {
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    let r: f32 = rng.gen();
    let mut acc = 0.0;
    let mut last = 0;
    for a in actions_of(mask) {
        acc += probs[a];
        last = a;
        if r < acc {
            return a;
        }
    }
    // El error de redondeo puede dejar `acc` apenas debajo de 1: la última acción legal.
    last
}
```

En `engine/src/lib.rs` agregar `pub mod policy;` (el archivo completo queda como en el paso 3 de la Tarea 3).

- [ ] **Step 4: Correr y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test policy 2>&1 | tail -8'`
Expected: `10 passed`.

- [ ] **Step 5: Clippy y fmt**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo clippy -p truco-engine --all-targets -- -D warnings 2>&1 | tail -3 && cargo fmt --check && echo FMT_OK'`
Expected: sin avisos y `FMT_OK`.

- [ ] **Step 6: Commit**

```bash
git add engine
git commit -m "feat(engine): shared mask-aware policy (regret matching, masked softmax)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Recorrido de Deep CFR con muestreo externo

**En criollo:** acá está el corazón del aprendizaje. Para entrenar, la IA juega miles de manos contra sí misma, pero de una manera especial. Elegimos a uno de los dos jugadores, el "recorredor". En **cada decisión del recorredor** no elige una sola jugada: *prueba todas las legales* y mira cómo le habría ido con cada una (siguiendo la partida hasta el final). La diferencia entre lo que le habría ido con cada jugada y lo que le va "en promedio" con su estrategia actual es el **arrepentimiento**: si una jugada habría sido mucho mejor que el promedio, el recorredor se "arrepiente" de no jugarla más. Cada decisión del recorredor produce una **muestra de ventaja** (situación + arrepentimientos). En **cada decisión del rival**, en cambio, se juega *una sola jugada al azar* según su estrategia actual, y se guarda esa estrategia como **muestra de estrategia** (las servirán al final para armar la estrategia promedio, que es la que se publica). Estos recorridos son lentos y se hacen de a miles, así que van en Rust. Esta función es de un solo hilo y totalmente determinista (misma semilla, mismos resultados); el paralelismo se agrega después, afuera.

**Files:**
- Create: `engine/src/traversal.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod traversal;`)
- Test: `engine/tests/traversal.rs`

**Interfaces:**
- Consumes: `Game` (`root`, `node`, `sample_chance`, `legal_actions`, `apply`, `returns`, `encode`, `NUM_ACTIONS`, `ENCODING_SIZE`), `Mlp`, `policy::{policy_probs, sample_action, PolicyKind, MAX_ACTIONS}`. `TrucoGame::sample_chance` ya muestrea el puntaje de inicio (30% en 0–0, el resto uniforme en [0, 29]²), así que no hace falta API nueva.
- Produces: `SampleBlock { width, enc: Vec<u8>, values: Vec<f32>, masks: Vec<u16> }` con `new(width)`, `len`, `is_empty`, `push(enc, values, mask)`, `append(other)` (columnas: `enc` = n × `ENCODING_SIZE`, `values` = n × `width`, `masks` = n); `TraversalOutput { adv: SampleBlock, strat: SampleBlock, nodes: u64 }` con `new(width)` y `append`; `run_traversals<G: Game>(nets: [Option<&Mlp>; 2], traverser: Player, seed: u64, first: u64, count: u64) -> TraversalOutput`. `nets[p]` es la red de ventajas del jugador `p` (`None` = uniforme). Cada recorrido `i` usa un RNG derivado de `seed` e `i`: dividir `first..first+count` en pedazos no cambia el resultado.

- [ ] **Step 1: Escribir los tests que fallan**

`engine/tests/traversal.rs`:
```rust
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::game::{bit, Game};
use truco_engine::kuhn::Kuhn;
use truco_engine::mlp::Mlp;
use truco_engine::traversal::run_traversals;
use truco_engine::truco::{feature_scale, TrucoGame, ENCODING_SIZE, NUM_ACTIONS};

#[test]
fn kuhn_uniform_traversal_has_consistent_samples() {
    let out = run_traversals::<Kuhn>([None, None], 0, 7, 0, 200);
    assert!(!out.adv.is_empty() && !out.strat.is_empty());
    assert_eq!(out.adv.enc.len(), out.adv.len() * Kuhn::ENCODING_SIZE);
    assert_eq!(out.adv.values.len(), out.adv.len() * 2);
    assert_eq!(out.strat.values.len(), out.strat.len() * 2);
    assert!(out.nodes >= (out.adv.len() + out.strat.len()) as u64);
    for (i, &m) in out.adv.masks.iter().enumerate() {
        assert_eq!(m, 0b11);
        // Con estrategia uniforme, sum(prob * arrepentimiento) = 0.
        let r = &out.adv.values[i * 2..i * 2 + 2];
        assert!((r[0] + r[1]).abs() < 1e-5, "arrepentimientos {r:?}");
    }
    for i in 0..out.strat.len() {
        let p = &out.strat.values[i * 2..i * 2 + 2];
        assert!((p[0] - 0.5).abs() < 1e-6 && (p[1] - 0.5).abs() < 1e-6);
    }
}

#[test]
fn kuhn_regret_of_betting_with_a_king_matches_the_hand_computation() {
    // Jugador 0 con K, primer turno, todos uniformes: apostar vale 1.5, pasar vale 0.75,
    // valor del nodo 1.125 => arrepentimiento de apostar +0.375 y de pasar -0.375.
    let out = run_traversals::<Kuhn>([None, None], 0, 11, 0, 6000);
    let (mut n, mut bet, mut pass) = (0.0f64, 0.0f64, 0.0f64);
    for i in 0..out.adv.len() {
        let e = &out.adv.enc[i * 9..(i + 1) * 9];
        let is_root_with_king = e[2] == 1 && e[3] == 1 && e[6] == 1;
        if is_root_with_king {
            n += 1.0;
            pass += out.adv.values[i * 2] as f64;
            bet += out.adv.values[i * 2 + 1] as f64;
        }
    }
    assert!(n > 500.0, "muy pocas muestras: {n}");
    assert!((bet / n - 0.375).abs() < 0.05, "apostar: {}", bet / n);
    assert!((pass / n + 0.375).abs() < 0.05, "pasar: {}", pass / n);
}

#[test]
fn traversals_are_deterministic_and_independent_of_chunking() {
    let whole = run_traversals::<Kuhn>([None, None], 1, 3, 0, 40);
    let again = run_traversals::<Kuhn>([None, None], 1, 3, 0, 40);
    assert_eq!(whole.adv.enc, again.adv.enc);
    assert_eq!(whole.adv.values, again.adv.values);
    let mut parts = run_traversals::<Kuhn>([None, None], 1, 3, 0, 25);
    parts.append(run_traversals::<Kuhn>([None, None], 1, 3, 25, 15));
    assert_eq!(whole.adv.enc, parts.adv.enc);
    assert_eq!(whole.adv.values, parts.adv.values);
    assert_eq!(whole.strat.enc, parts.strat.enc);
    assert_eq!(whole.strat.masks, parts.strat.masks);
    assert_eq!(whole.nodes, parts.nodes);
    let other = run_traversals::<Kuhn>([None, None], 1, 4, 0, 40);
    assert_ne!(whole.adv.enc, other.adv.enc, "otra semilla, otras manos");
}

#[test]
fn truco_traversal_with_random_nets_emits_valid_samples() {
    let mut rng = SmallRng::seed_from_u64(1);
    let a = Mlp::random(&[ENCODING_SIZE, 32, NUM_ACTIONS], feature_scale(), &mut rng);
    let b = Mlp::random(&[ENCODING_SIZE, 32, NUM_ACTIONS], feature_scale(), &mut rng);
    let out = run_traversals::<TrucoGame>([Some(&a), Some(&b)], 1, 5, 0, 30);
    assert!(
        out.adv.len() >= 30,
        "cada recorrido tiene al menos una decisión propia"
    );
    assert!(!out.strat.is_empty());
    assert_eq!(out.adv.enc.len(), out.adv.len() * ENCODING_SIZE);
    for blk in [&out.adv, &out.strat] {
        assert_eq!(blk.width, NUM_ACTIONS);
        for i in 0..blk.len() {
            let m = blk.masks[i];
            assert_ne!(m, 0);
            let v = &blk.values[i * NUM_ACTIONS..(i + 1) * NUM_ACTIONS];
            for (act, &x) in v.iter().enumerate() {
                if m & bit(act) == 0 {
                    assert_eq!(x, 0.0, "valor distinto de cero en una acción ilegal");
                }
            }
        }
    }
    for i in 0..out.strat.len() {
        let p = &out.strat.values[i * NUM_ACTIONS..(i + 1) * NUM_ACTIONS];
        assert!((p.iter().sum::<f32>() - 1.0).abs() < 1e-4);
    }
}

#[test]
fn kuhn_samples_belong_to_the_right_player() {
    // El jugador 0 decide con la historia vacía o con 2 jugadas; el jugador 1, con 1 jugada.
    // Con 1 jugada, el primer lugar de la historia está ocupado y el segundo vacío.
    let out = run_traversals::<Kuhn>([None, None], 0, 21, 0, 300);
    for i in 0..out.adv.len() {
        let e = &out.adv.enc[i * 9..(i + 1) * 9];
        assert!(
            !(e[3] == 0 && e[6] == 1),
            "muestra de ventaja en un nodo del rival"
        );
    }
    for i in 0..out.strat.len() {
        let e = &out.strat.enc[i * 9..(i + 1) * 9];
        assert!(
            e[3] == 0 && e[6] == 1,
            "muestra de estrategia fuera de un nodo del rival"
        );
    }
}

#[test]
fn truco_start_scores_follow_the_training_distribution() {
    let mut rng = SmallRng::seed_from_u64(4);
    let n = 4000;
    let mut zero_zero = 0;
    let mut seen = std::collections::HashSet::new();
    for _ in 0..n {
        let g = TrucoGame::root().sample_chance(&mut rng);
        let s = g.state();
        let scores = [s.score(0), s.score(1)];
        assert!(
            scores.iter().all(|&x| x < 30),
            "puntaje de inicio {scores:?}"
        );
        if scores == [0, 0] {
            zero_zero += 1;
        }
        seen.insert(scores[0]);
    }
    let share = zero_zero as f64 / n as f64;
    assert!((share - 0.3).abs() < 0.03, "el 0-0 aparece el {share:.3}");
    assert_eq!(
        seen.len(),
        30,
        "los puntajes 0..29 tienen que aparecer todos"
    );
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test traversal 2>&1 | tail -8'`
Expected: error de compilación `unresolved import truco_engine::traversal`.

- [ ] **Step 3: Implementar**

`engine/src/traversal.rs`:
```rust
//! Recorrido de Deep CFR con muestreo externo (external sampling), genérico sobre `Game`.
//! Un solo hilo y determinista: el resultado depende solo de las redes, la semilla y los
//! índices de recorrido. El paralelismo (rayon) vive en `engine-py`.
use crate::game::{actions_of, Game, Node, Player};
use crate::mlp::Mlp;
use crate::policy::{policy_probs, sample_action, PolicyKind, MAX_ACTIONS};
use rand::rngs::SmallRng;
use rand::SeedableRng;

/// Muestras en columnas: `enc` (n × `ENCODING_SIZE` bytes), `values` (n × `width` floats:
/// arrepentimientos o probabilidades) y `masks` (n máscaras de acciones legales).
#[derive(Clone, Debug, Default)]
pub struct SampleBlock {
    pub width: usize,
    pub enc: Vec<u8>,
    pub values: Vec<f32>,
    pub masks: Vec<u16>,
}

impl SampleBlock {
    pub fn new(width: usize) -> SampleBlock {
        SampleBlock {
            width,
            ..SampleBlock::default()
        }
    }

    pub fn len(&self) -> usize {
        self.masks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.masks.is_empty()
    }

    pub fn push(&mut self, enc: &[u8], values: &[f32], mask: u16) {
        debug_assert_eq!(values.len(), self.width);
        self.enc.extend_from_slice(enc);
        self.values.extend_from_slice(values);
        self.masks.push(mask);
    }

    pub fn append(&mut self, other: SampleBlock) {
        debug_assert_eq!(self.width, other.width);
        self.enc.extend(other.enc);
        self.values.extend(other.values);
        self.masks.extend(other.masks);
    }
}

#[derive(Clone, Debug)]
pub struct TraversalOutput {
    /// Muestras de ventaja del jugador que recorre: (codificación, arrepentimientos, máscara).
    pub adv: SampleBlock,
    /// Muestras de estrategia de los nodos del rival: (codificación, probabilidades, máscara).
    pub strat: SampleBlock,
    /// Nodos de decisión visitados (para medir velocidad).
    pub nodes: u64,
}

impl TraversalOutput {
    pub fn new(width: usize) -> TraversalOutput {
        TraversalOutput {
            adv: SampleBlock::new(width),
            strat: SampleBlock::new(width),
            nodes: 0,
        }
    }

    pub fn append(&mut self, other: TraversalOutput) {
        self.adv.append(other.adv);
        self.strat.append(other.strat);
        self.nodes += other.nodes;
    }
}

struct Ctx<'a> {
    nets: [Option<&'a Mlp>; 2],
    traverser: Player,
    rng: SmallRng,
    out: TraversalOutput,
}

/// Corre los recorridos `first .. first + count`. Cada uno usa su propio RNG, derivado de
/// `seed` y de su índice, así que partir el trabajo en pedazos (o en hilos) no cambia el resultado.
/// `nets[p]` es la red de ventajas del jugador `p` (`None` = política uniforme).
pub fn run_traversals<G: Game>(
    nets: [Option<&Mlp>; 2],
    traverser: Player,
    seed: u64,
    first: u64,
    count: u64,
) -> TraversalOutput {
    assert!(traverser < 2, "jugador inválido: {traverser}");
    let mut total = TraversalOutput::new(G::NUM_ACTIONS);
    for i in first..first + count {
        let mut ctx = Ctx {
            nets,
            traverser,
            rng: SmallRng::seed_from_u64(seed.wrapping_add(i.wrapping_mul(0x9E37_79B9_7F4A_7C15))),
            out: TraversalOutput::new(G::NUM_ACTIONS),
        };
        recurse(&mut ctx, &G::root());
        total.append(ctx.out);
    }
    total
}

fn recurse<G: Game>(ctx: &mut Ctx, s: &G) -> f32 {
    match s.node() {
        Node::Terminal => s.returns()[ctx.traverser],
        Node::Chance => {
            let next = s.sample_chance(&mut ctx.rng);
            recurse(ctx, &next)
        }
        Node::Decision(q) => {
            ctx.out.nodes += 1;
            let mask = s.legal_actions();
            let mut enc = vec![0u8; G::ENCODING_SIZE];
            s.encode(q, &mut enc);
            let probs = policy_probs(ctx.nets[q], PolicyKind::Advantage, &enc, mask);
            if q == ctx.traverser {
                let mut values = [0.0f32; MAX_ACTIONS];
                let mut node_value = 0.0;
                for a in actions_of(mask) {
                    let mut child = s.clone();
                    child.apply(a);
                    values[a] = recurse(ctx, &child);
                    node_value += probs[a] * values[a];
                }
                let mut regrets = [0.0f32; MAX_ACTIONS];
                for a in actions_of(mask) {
                    regrets[a] = values[a] - node_value;
                }
                ctx.out.adv.push(&enc, &regrets[..G::NUM_ACTIONS], mask);
                node_value
            } else {
                ctx.out.strat.push(&enc, &probs[..G::NUM_ACTIONS], mask);
                let a = sample_action(&probs, mask, &mut ctx.rng);
                let mut child = s.clone();
                child.apply(a);
                recurse(ctx, &child)
            }
        }
    }
}
```

En `engine/src/lib.rs` agregar `pub mod traversal;`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test traversal 2>&1 | tail -12'`
Expected: `6 passed`. (`kuhn_regret_of_betting_with_a_king_matches_the_hand_computation` verifica un arrepentimiento calculado a mano: con K, apostar vale 1,5 y pasar 0,75 si todos juegan al azar, así que apostar da +0,375 y pasar −0,375.)

- [ ] **Step 5: Clippy y fmt**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo clippy -p truco-engine --all-targets -- -D warnings 2>&1 | tail -3 && cargo fmt --check && echo FMT_OK'`
Expected: sin avisos y `FMT_OK`.

- [ ] **Step 6: Commit**

```bash
git add engine
git commit -m "feat(engine): external-sampling Deep CFR traversal, generic over Game" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `MlpAgent` y explotabilidad exacta de redes

**En criollo:** dos usos más de las redes. (1) Un **agente** que juega partidos de truco con redes: se le da una situación de la mesa y devuelve una jugada, igual que el bot al azar y el heurístico del Plan 1. Con él medimos qué tan bien juega lo que se está entrenando. (2) En los juegos chicos (Kuhn y MiniTruco) se puede calcular **exactamente** cuánto se le puede ganar a una estrategia: eso es la *explotabilidad* (0 = perfecta). Ahora que la estrategia la define una red, necesitamos poder medirla; reutilizamos el cálculo exacto del Plan 1.

**Files:**
- Create: `engine/src/mlp_agent.rs`, `engine/src/net_eval.rs`
- Modify: `engine/src/lib.rs` (completar los módulos del Plan 2)
- Test: `engine/tests/mlp_agent.rs`

**Interfaces:**
- Consumes: `agents::Agent`, `truco::{encode, Observation, ENCODING_SIZE}`, `policy::{policy_probs, sample_action, PolicyKind, Probs}`, `exact::exploitability`, `ExactGame`.
- Produces: `MlpAgent::new(nets: [Arc<Mlp>; 2], kind: PolicyKind, label: &str)` (una red por asiento) y `MlpAgent::shared(net: Arc<Mlp>, kind, label)`; `MlpAgent::probabilities(&self, obs: &Observation) -> Probs`; `impl Agent for MlpAgent`. `net_exploitability<G: ExactGame>(nets: [&Mlp; 2], kind: PolicyKind) -> f64`.

- [ ] **Step 1: Escribir los tests que fallan**

`engine/tests/mlp_agent.rs`:
```rust
use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::sync::Arc;
use truco_engine::agents::RandomAgent;
use truco_engine::exact::exploitability;
use truco_engine::game::{bit, Player};
use truco_engine::kuhn::Kuhn;
use truco_engine::match_runner::play_duplicate;
use truco_engine::mlp::{Layer, Mlp};
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::net_eval::net_exploitability;
use truco_engine::policy::PolicyKind;
use truco_engine::truco::{deal, feature_scale, TrucoState, ENCODING_SIZE, NUM_ACTIONS};

fn random_net(seed: u64) -> Arc<Mlp> {
    let mut rng = SmallRng::seed_from_u64(seed);
    Arc::new(Mlp::random(
        &[ENCODING_SIZE, 32, NUM_ACTIONS],
        feature_scale(),
        &mut rng,
    ))
}

#[test]
fn mlp_agent_only_plays_legal_moves_in_full_matches() {
    // play_match hace panic si el agente elige una acción ilegal.
    for kind in [PolicyKind::Advantage, PolicyKind::Strategy] {
        let mut agent = MlpAgent::new([random_net(1), random_net(2)], kind, "net");
        let mut rival = RandomAgent;
        let mut rng = SmallRng::seed_from_u64(9);
        for seed in 0..8 {
            play_duplicate(&mut agent, &mut rival, seed, &mut rng);
        }
    }
}

#[test]
fn probabilities_are_a_distribution_over_the_legal_actions() {
    let mut rng = SmallRng::seed_from_u64(3);
    let agent = MlpAgent::shared(random_net(4), PolicyKind::Strategy, "net");
    let state = TrucoState::new_hand(deal(&mut rng), 0, [0, 0]);
    let obs = state.observation(0);
    assert_ne!(obs.legal, 0);
    let p = agent.probabilities(&obs);
    assert!((p.iter().sum::<f32>() - 1.0).abs() < 1e-5);
    for (a, &x) in p.iter().enumerate() {
        if obs.legal & bit(a) == 0 {
            assert_eq!(x, 0.0);
        }
    }
}

#[test]
fn net_exploitability_matches_the_closure_version_on_kuhn() {
    // Una red con pesos 0 y sesgos iguales da logits iguales: política uniforme.
    let net = Mlp::new(
        vec![Layer {
            inp: 9,
            out: 2,
            w: vec![0.0; 18],
            b: vec![0.0; 2],
        }],
        vec![1.0; 9],
    );
    let via_net = net_exploitability::<Kuhn>([&net, &net], PolicyKind::Strategy);
    let uniform = |_: &Kuhn, _: Player| vec![0.5, 0.5];
    let direct = exploitability::<Kuhn>(&uniform);
    assert!(via_net > 0.1);
    assert!((via_net - direct).abs() < 1e-6, "{via_net} vs {direct}");
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test mlp_agent 2>&1 | tail -8'`
Expected: error de compilación `unresolved import truco_engine::mlp_agent`.

- [ ] **Step 3: Implementar**

`engine/src/mlp_agent.rs`:
```rust
//! Agente de truco que juega con redes entrenadas (la misma política que usará la web).
use crate::agents::Agent;
use crate::game::Action;
use crate::mlp::Mlp;
use crate::policy::{policy_probs, sample_action, PolicyKind, Probs};
use crate::truco::{encode, Observation, ENCODING_SIZE};
use rand::RngCore;
use std::sync::Arc;

pub struct MlpAgent {
    /// Una red por asiento (las redes de ventajas son una por jugador). Para la red de
    /// estrategia promedio, las dos son la misma.
    nets: [Arc<Mlp>; 2],
    kind: PolicyKind,
    label: String,
}

impl MlpAgent {
    pub fn new(nets: [Arc<Mlp>; 2], kind: PolicyKind, label: &str) -> MlpAgent {
        for net in &nets {
            assert_eq!(net.input_size(), ENCODING_SIZE, "la red no es de truco");
        }
        MlpAgent {
            nets,
            kind,
            label: label.to_string(),
        }
    }

    /// La misma red en los dos asientos.
    pub fn shared(net: Arc<Mlp>, kind: PolicyKind, label: &str) -> MlpAgent {
        MlpAgent::new([net.clone(), net], kind, label)
    }

    /// Probabilidad de cada acción en esta situación (para el "modo rayos X" de la web).
    pub fn probabilities(&self, obs: &Observation) -> Probs {
        let mut enc = [0u8; ENCODING_SIZE];
        encode(obs, &mut enc);
        policy_probs(Some(&self.nets[obs.me]), self.kind, &enc, obs.legal)
    }
}

impl Agent for MlpAgent {
    fn name(&self) -> String {
        self.label.clone()
    }

    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action {
        sample_action(&self.probabilities(obs), obs.legal, rng)
    }
}
```

`engine/src/net_eval.rs`:
```rust
//! Explotabilidad exacta de una política definida por redes, en los juegos chicos.
use crate::exact::exploitability;
use crate::game::{ExactGame, Player};
use crate::mlp::Mlp;
use crate::policy::{policy_probs, PolicyKind};

/// Explotabilidad exacta cuando el jugador `p` juega con `nets[p]` (según `kind`).
/// Para una red de estrategia promedio compartida, pasar la misma red dos veces.
pub fn net_exploitability<G: ExactGame>(nets: [&Mlp; 2], kind: PolicyKind) -> f64 {
    let policy = |s: &G, p: Player| -> Vec<f64> {
        let mut enc = vec![0u8; G::ENCODING_SIZE];
        s.encode(p, &mut enc);
        let probs = policy_probs(Some(nets[p]), kind, &enc, s.legal_actions());
        probs[..G::NUM_ACTIONS].iter().map(|&x| x as f64).collect()
    };
    exploitability::<G>(&policy)
}
```

`engine/src/lib.rs` (reemplazar; deja registrados los cuatro módulos nuevos del Plan 2):
```rust
//! Motor de truco argentino 1 contra 1 y algoritmos CFR.
pub mod agents;
pub mod cards;
pub mod cfr;
pub mod envido;
pub mod exact;
pub mod game;
pub mod kuhn;
pub mod match_runner;
pub mod minitruco;
pub mod mlp;
pub mod mlp_agent;
pub mod net_eval;
pub mod policy;
pub mod traversal;
pub mod truco;
```

- [ ] **Step 4: Correr y ver que pasa, y que el resto del motor sigue verde**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --test mlp_agent 2>&1 | tail -8 && cargo test -p truco-engine --test policy --test traversal 2>&1 | grep "test result"'`
Expected: `3 passed` en `mlp_agent`, y `10 passed` / `6 passed` en `policy` y `traversal`.

- [ ] **Step 5: Clippy y fmt**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo clippy -p truco-engine --all-targets -- -D warnings 2>&1 | tail -3 && cargo fmt --check && echo FMT_OK'`
Expected: sin avisos y `FMT_OK`.

- [ ] **Step 6: Commit**

```bash
git add engine
git commit -m "feat(engine): MlpAgent and exact exploitability of net-defined policies" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: El puente completo — `engine-py`

**En criollo:** ahora le damos al puente todas sus funciones. Las más importantes: `traverse_batch` (le decimos "hacé 10 000 recorridos para este jugador con estas redes" y los reparte entre los 8 núcleos de la CPU con una librería llamada rayon; devuelve las muestras como bloques de bytes), `exploitability` y `eval_duplicate` (miden la calidad de una red), y `Hand` (una mano de truco que Python puede jugar paso a paso; sirve para pruebas y para el análisis posterior). Hay una regla de seguridad importante: el motor de Rust *no revisa* en las versiones "release" si una jugada es legal, así que **todo lo que viene de Python se revisa acá** y, si es ilegal, se levanta un error de Python (`ValueError`) sin tocar el estado de la mano. Las redes viajan como bytes en el mismo formato de archivo que usará la web (TCFRW1), y el resultado de los recorridos no depende de cuántos hilos se usen.

**Files:**
- Modify: `engine-py/src/lib.rs` (reemplazar el esqueleto)
- Test: `train/tests/test_engine_bridge.py`

**Interfaces:**
- Consumes: `traversal::{run_traversals, TraversalOutput}`, `net_eval::net_exploitability`, `MlpAgent`, `Mlp::{from_bytes, forward}`, `match_runner::play_duplicate`, `agents::{HeuristicAgent, RandomAgent}`, `TrucoGame`.
- Produces (módulo `truco_engine_py`):
  - `game_info(game) -> (int, int, list[float])`.
  - `traverse_batch(game, traverser, seed, first, count, net0=None, net1=None, threads=1) -> (adv_enc, adv_regrets, adv_masks, strat_enc, strat_probs, strat_masks, nodes)`: seis `bytes` (`u8` de n × ENCODING_SIZE; `f32` little-endian de n × NUM_ACTIONS; `u16` little-endian de n) y un `int`. `net0`/`net1`: `bytes` TCFRW1 de las redes de ventajas de los jugadores 0 y 1, o `None`. Errores (`ValueError`): juego desconocido, `traverser` fuera de {0, 1}, `threads == 0`, red ilegible o que no encaja con el juego.
  - `exploitability(game, mode, net0, net1=None) -> float` (solo `"kuhn"` y `"minitruco"`; `mode` = `"advantage"` o `"strategy"`; sin `net1`, los dos jugadores usan `net0`).
  - `eval_duplicate(opponent, mode, net0, net1=None, pairs=100, seed=0, threads=1) -> (victorias_de_la_red, partidos_jugados)` con `opponent` = `"random"` o `"heuristic"`; cada par son 2 partidos a 30.
  - `mlp_forward(net: bytes, x: bytes) -> bytes` (n entradas seguidas → n × salidas `f32` little-endian).
  - `class Hand(seed)`: `is_terminal()`, `current_player() -> int | None`, `legal_mask() -> int`, `apply(action)` (`ValueError` si la acción es ilegal o la mano terminó), `encode(player) -> bytes` (304), `returns() -> (float, float)` (solo con la mano terminada).

- [ ] **Step 1: Escribir los tests que fallan**

`train/tests/test_engine_bridge.py`:
```python
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
```

(Este archivo no importa nada de `truco_train`, así que esta tarea no depende de la pista de Python. Los tests que usan redes reales están en `test_engine_bridge_nets.py`, Tarea 7.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_engine_bridge.py -q 2>&1 | tail -12'`
Expected: falla con `AttributeError: module 'truco_engine_py' has no attribute 'traverse_batch'` (el esqueleto de la Tarea 0 solo tiene `game_info`).

- [ ] **Step 3: Implementar el puente**

`engine-py/src/lib.rs`:
```rust
//! Puente Python <-> motor. Python solo ve bytes y números: las redes viajan como archivos
//! TCFRW1 en memoria y las muestras vuelven como bytes que `numpy.frombuffer` lee sin copiar.
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::PyBytes;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use rayon::prelude::*;
use std::sync::Arc;
use truco_engine::agents::{Agent, HeuristicAgent, RandomAgent};
use truco_engine::game::{bit, Game, Node};
use truco_engine::kuhn::Kuhn;
use truco_engine::match_runner::play_duplicate;
use truco_engine::minitruco::MiniTruco;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::net_eval::net_exploitability;
use truco_engine::policy::PolicyKind;
use truco_engine::traversal::{run_traversals, TraversalOutput};
use truco_engine::truco::{TrucoGame, NUM_ACTIONS};

/// Ejecuta `$body` con `$G` = el juego pedido por nombre.
macro_rules! with_game {
    ($name:expr, $G:ident => $body:expr) => {
        match $name {
            "kuhn" => {
                type $G = Kuhn;
                $body
            }
            "minitruco" => {
                type $G = MiniTruco;
                $body
            }
            "truco" => {
                type $G = TrucoGame;
                $body
            }
            other => Err(PyValueError::new_err(format!(
                "juego desconocido: {other} (kuhn, minitruco o truco)"
            ))),
        }
    };
}

/// Igual, pero solo para los juegos chicos que se pueden recorrer enteros.
macro_rules! with_exact_game {
    ($name:expr, $G:ident => $body:expr) => {
        match $name {
            "kuhn" => {
                type $G = Kuhn;
                $body
            }
            "minitruco" => {
                type $G = MiniTruco;
                $body
            }
            other => Err(PyValueError::new_err(format!(
                "la explotabilidad exacta solo existe para kuhn y minitruco, no para {other}"
            ))),
        }
    };
}

fn parse_kind(mode: &str) -> PyResult<PolicyKind> {
    match mode {
        "advantage" => Ok(PolicyKind::Advantage),
        "strategy" => Ok(PolicyKind::Strategy),
        other => Err(PyValueError::new_err(format!(
            "modo desconocido: {other} (advantage o strategy)"
        ))),
    }
}

/// Lee una red TCFRW1 y verifica que encaje con el juego (entrada y salidas).
fn parse_net<G: Game>(bytes: &Bound<'_, PyBytes>, label: &str) -> PyResult<Mlp> {
    let net = Mlp::from_bytes(bytes.as_bytes())
        .map_err(|e| PyValueError::new_err(format!("{label}: {e}")))?;
    if net.input_size() != G::ENCODING_SIZE || net.output_size() != G::NUM_ACTIONS {
        return Err(PyValueError::new_err(format!(
            "{label}: la red es de {}→{} y el juego necesita {}→{}",
            net.input_size(),
            net.output_size(),
            G::ENCODING_SIZE,
            G::NUM_ACTIONS
        )));
    }
    Ok(net)
}

fn parse_optional_net<G: Game>(
    bytes: &Option<Bound<'_, PyBytes>>,
    label: &str,
) -> PyResult<Option<Mlp>> {
    bytes.as_ref().map(|b| parse_net::<G>(b, label)).transpose()
}

fn floats_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn masks_to_bytes(v: &[u16]) -> Vec<u8> {
    v.iter().flat_map(|m| m.to_le_bytes()).collect()
}

fn pool(threads: usize) -> PyResult<rayon::ThreadPool> {
    if threads == 0 {
        return Err(PyValueError::new_err("threads tiene que ser al menos 1"));
    }
    rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

/// (tamaño de la codificación, cantidad de acciones, factor de escala de cada byte de entrada)
#[pyfunction]
fn game_info(game: &str) -> PyResult<(usize, usize, Vec<f32>)> {
    with_game!(game, G => Ok((G::ENCODING_SIZE, G::NUM_ACTIONS, G::feature_scale())))
}

type Batch<'py> = (
    Bound<'py, PyBytes>, // adv_enc: n × ENCODING_SIZE u8
    Bound<'py, PyBytes>, // adv_regrets: n × NUM_ACTIONS f32 (little-endian)
    Bound<'py, PyBytes>, // adv_masks: n u16 (little-endian)
    Bound<'py, PyBytes>, // strat_enc
    Bound<'py, PyBytes>, // strat_probs
    Bound<'py, PyBytes>, // strat_masks
    u64,                 // nodos de decisión visitados
);

/// Corre los recorridos `first .. first + count` de Deep CFR para el jugador `traverser`,
/// repartidos en `threads` hilos. El resultado no depende de `threads`.
#[pyfunction]
#[pyo3(signature = (game, traverser, seed, first, count, net0=None, net1=None, threads=1))]
#[allow(clippy::too_many_arguments)]
fn traverse_batch<'py>(
    py: Python<'py>,
    game: &str,
    traverser: usize,
    seed: u64,
    first: u64,
    count: u64,
    net0: Option<Bound<'py, PyBytes>>,
    net1: Option<Bound<'py, PyBytes>>,
    threads: usize,
) -> PyResult<Batch<'py>> {
    if traverser > 1 {
        return Err(PyValueError::new_err("traverser tiene que ser 0 o 1"));
    }
    let out: TraversalOutput = with_game!(game, G => {
        let nets = [
            parse_optional_net::<G>(&net0, "net0")?,
            parse_optional_net::<G>(&net1, "net1")?,
        ];
        let pool = pool(threads)?;
        Ok(py.allow_threads(|| {
            const CHUNK: u64 = 32;
            let chunks: Vec<(u64, u64)> = (0..count.div_ceil(CHUNK))
                .map(|c| (first + c * CHUNK, CHUNK.min(count - c * CHUNK)))
                .collect();
            let parts: Vec<TraversalOutput> = pool.install(|| {
                chunks
                    .par_iter()
                    .map(|&(a, n)| {
                        run_traversals::<G>(
                            [nets[0].as_ref(), nets[1].as_ref()],
                            traverser,
                            seed,
                            a,
                            n,
                        )
                    })
                    .collect()
            });
            let mut total = TraversalOutput::new(G::NUM_ACTIONS);
            for p in parts {
                total.append(p);
            }
            total
        }))
    })?;
    Ok((
        PyBytes::new(py, &out.adv.enc),
        PyBytes::new(py, &floats_to_bytes(&out.adv.values)),
        PyBytes::new(py, &masks_to_bytes(&out.adv.masks)),
        PyBytes::new(py, &out.strat.enc),
        PyBytes::new(py, &floats_to_bytes(&out.strat.values)),
        PyBytes::new(py, &masks_to_bytes(&out.strat.masks)),
        out.nodes,
    ))
}

/// Explotabilidad exacta (Kuhn o MiniTruco) cuando cada jugador juega con su red.
/// `mode`: "advantage" (regret matching) o "strategy" (softmax). Sin `net1`, los dos usan `net0`.
#[pyfunction]
#[pyo3(signature = (game, mode, net0, net1=None))]
fn exploitability(
    game: &str,
    mode: &str,
    net0: Bound<'_, PyBytes>,
    net1: Option<Bound<'_, PyBytes>>,
) -> PyResult<f64> {
    let kind = parse_kind(mode)?;
    with_exact_game!(game, G => {
        let a = parse_net::<G>(&net0, "net0")?;
        let b = match &net1 {
            Some(bytes) => parse_net::<G>(bytes, "net1")?,
            None => a.clone(),
        };
        Ok(net_exploitability::<G>([&a, &b], kind))
    })
}

/// Juega `pairs` partidos duplicados (2 partidos a 30 cada uno) de la red contra `opponent`
/// ("random" o "heuristic"). Devuelve (partidos ganados por la red, partidos jugados).
#[pyfunction]
#[pyo3(signature = (opponent, mode, net0, net1=None, pairs=100, seed=0, threads=1))]
#[allow(clippy::too_many_arguments)]
fn eval_duplicate(
    py: Python<'_>,
    opponent: &str,
    mode: &str,
    net0: Bound<'_, PyBytes>,
    net1: Option<Bound<'_, PyBytes>>,
    pairs: u64,
    seed: u64,
    threads: usize,
) -> PyResult<(u64, u64)> {
    let kind = parse_kind(mode)?;
    let heuristic = match opponent {
        "random" => false,
        "heuristic" => true,
        other => {
            return Err(PyValueError::new_err(format!(
                "rival desconocido: {other} (random o heuristic)"
            )))
        }
    };
    let a = Arc::new(parse_net::<TrucoGame>(&net0, "net0")?);
    let b = match &net1 {
        Some(bytes) => Arc::new(parse_net::<TrucoGame>(bytes, "net1")?),
        None => a.clone(),
    };
    let pool = pool(threads)?;
    let wins: u64 = py.allow_threads(|| {
        pool.install(|| {
            (0..pairs)
                .into_par_iter()
                .map(|i| {
                    let mut rng =
                        SmallRng::seed_from_u64(seed ^ i.wrapping_mul(0xD1B5_4A32_D192_ED03));
                    let deal_seed = seed.wrapping_mul(31).wrapping_add(i);
                    let mut agent = MlpAgent::new([a.clone(), b.clone()], kind, "net");
                    let mut rival: Box<dyn Agent> = if heuristic {
                        Box::new(HeuristicAgent)
                    } else {
                        Box::new(RandomAgent)
                    };
                    play_duplicate(&mut agent, &mut *rival, deal_seed, &mut rng).a_wins() as u64
                })
                .sum()
        })
    });
    Ok((wins, pairs * 2))
}

/// Forward de una red TCFRW1 sobre `n` entradas de `input_size` bytes seguidas.
/// Devuelve n × output_size floats little-endian. Sirve para el test de paridad con PyTorch.
#[pyfunction]
fn mlp_forward<'py>(
    py: Python<'py>,
    net: Bound<'py, PyBytes>,
    x: Bound<'py, PyBytes>,
) -> PyResult<Bound<'py, PyBytes>> {
    let net = Mlp::from_bytes(net.as_bytes()).map_err(PyValueError::new_err)?;
    let x = x.as_bytes();
    let n_in = net.input_size();
    if x.is_empty() || x.len() % n_in != 0 {
        return Err(PyValueError::new_err(format!(
            "x tiene {} bytes, que no es un múltiplo de {n_in}",
            x.len()
        )));
    }
    let mut out = vec![0f32; x.len() / n_in * net.output_size()];
    for (row, dst) in x
        .chunks_exact(n_in)
        .zip(out.chunks_exact_mut(net.output_size()))
    {
        net.forward(row, dst);
    }
    Ok(PyBytes::new(py, &floats_to_bytes(&out)))
}

/// Una mano de truco que Python puede jugar paso a paso. Toda acción se valida contra la
/// máscara de acciones legales: una acción ilegal levanta `ValueError` y no toca el estado.
#[pyclass]
struct Hand {
    game: TrucoGame,
}

#[pymethods]
impl Hand {
    /// Reparte una mano al azar (con puntajes de inicio muestreados como en el entrenamiento).
    #[new]
    fn new(seed: u64) -> Hand {
        let mut rng = SmallRng::seed_from_u64(seed);
        Hand {
            game: TrucoGame::root().sample_chance(&mut rng),
        }
    }

    fn is_terminal(&self) -> bool {
        self.game.node() == Node::Terminal
    }

    /// Jugador al que le toca decidir, o `None` si la mano terminó.
    fn current_player(&self) -> Option<usize> {
        match self.game.node() {
            Node::Decision(p) => Some(p),
            _ => None,
        }
    }

    fn legal_mask(&self) -> u16 {
        self.game.legal_actions()
    }

    fn apply(&mut self, action: usize) -> PyResult<()> {
        if self.is_terminal() {
            return Err(PyValueError::new_err("la mano ya terminó"));
        }
        if action >= NUM_ACTIONS || self.game.legal_actions() & bit(action) == 0 {
            return Err(PyValueError::new_err(format!(
                "acción ilegal: {action} (máscara legal {:#014b})",
                self.game.legal_actions()
            )));
        }
        self.game.apply(action);
        Ok(())
    }

    /// Lo que ve el jugador `player`, como 304 bytes.
    fn encode<'py>(&self, py: Python<'py>, player: usize) -> PyResult<Bound<'py, PyBytes>> {
        if player > 1 {
            return Err(PyValueError::new_err("player tiene que ser 0 o 1"));
        }
        let mut buf = vec![0u8; TrucoGame::ENCODING_SIZE];
        self.game.encode(player, &mut buf);
        Ok(PyBytes::new(py, &buf))
    }

    /// Puntos netos de cada jugador; solo cuando la mano terminó.
    fn returns(&self) -> PyResult<(f32, f32)> {
        if !self.is_terminal() {
            return Err(PyValueError::new_err("la mano todavía no terminó"));
        }
        let r = self.game.returns();
        Ok((r[0], r[1]))
    }
}

#[pymodule]
fn truco_engine_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(game_info, m)?)?;
    m.add_function(wrap_pyfunction!(traverse_batch, m)?)?;
    m.add_function(wrap_pyfunction!(exploitability, m)?)?;
    m.add_function(wrap_pyfunction!(eval_duplicate, m)?)?;
    m.add_function(wrap_pyfunction!(mlp_forward, m)?)?;
    m.add_class::<Hand>()?;
    Ok(())
}
```

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync maturin develop --release --uv -m ../engine-py/Cargo.toml 2>&1 | tail -5'`
Expected: `Installed truco-engine-py-0.1.0`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_engine_bridge.py -q 2>&1 | tail -12'`
Expected: `10 passed`.

- [ ] **Step 5: Clippy y fmt**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo clippy -p truco-engine-py --all-targets -- -D warnings 2>&1 | tail -3 && cargo fmt --check && echo FMT_OK'`
Expected: sin avisos y `FMT_OK`.

- [ ] **Step 6: Commit**

```bash
git add engine-py train/tests/test_engine_bridge.py
git commit -m "feat(engine-py): traverse_batch (rayon), exploitability, eval_duplicate, mlp_forward, Hand" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Python base — configuración, pesos TCFRW1, red y buffer de reservorio

**En criollo:** cuatro piezas chicas de Python que no necesitan el motor de Rust. (1) `Config`: todos los "botones" de una corrida (cuántos recorridos, tamaño de la red, etc.) leídos de un archivo de texto, con validación para que un error de tipeo no te arruine la noche. (2) El **escritor de pesos**: guarda una red de PyTorch en el formato binario propio (TCFRW1) que lee Rust, *byte por byte igual* al ejemplo de `docs/weights-format.md`. (3) `ScaledMlp`: la red neuronal, que recibe bytes y los multiplica por los factores de escala antes de calcular, igual que hace el MLP de Rust. (4) El **buffer de reservorio**: una memoria de tamaño fijo donde se guardan muestras; cuando se llena, cada muestra nueva reemplaza a una vieja al azar, de modo que lo guardado es siempre una muestra *uniforme* de todo lo que pasó (no solo de lo último). Las muestras se guardan como los 304 bytes originales, no como números decimales: 4 millones ocupan ~1,2 GB en vez de ~5 GB.

**Files:**
- Create: `train/truco_train/__init__.py`, `train/truco_train/config.py`, `train/truco_train/weights.py`, `train/truco_train/model.py`, `train/truco_train/buffers.py`
- Test: `train/tests/test_config.py`, `train/tests/test_weights.py`, `train/tests/test_buffers.py`

**Interfaces:**
- Consumes: nada del motor (esta pista es independiente de las Tareas 1–4).
- Produces:
  - `Config` (dataclass inmutable): campos `game, seed, iterations, traversals, threads, hidden, n_hidden, adv_capacity, strat_capacity, adv_steps, batch_size, lr, grad_clip, adv_scale, warm_start, strat_steps, strat_lr, eval_every, eval_pairs, checkpoint_every, compress_checkpoints, final_pairs, time_budget_s, device`; `Config.from_dict(dict)`, `Config.from_toml(path)`, `Config.from_json(str)`, `cfg.to_json() -> str`, `cfg.validate()` (todos levantan `ValueError` ante claves desconocidas o valores absurdos).
  - `tcfrw1_bytes(linears, input_scale) -> bytes`, `write_tcfrw1(path, linears, input_scale)`, `read_tcfrw1(data) -> (list[(w, b)], scale)`.
  - `ScaledMlp(input_scale, hidden, n_hidden, n_out)`: `nn.Module` con `forward(x_u8) -> Tensor`, `linears()`, `to_bytes() -> bytes`.
  - `ReservoirBuffer(capacity, enc_size, width, rng)`: atributos `enc, values, masks, t, size, seen`; `add(enc, values, masks, t)`, `save(path, compress=True)`, `load(path)`, `len()`.

- [ ] **Step 1: Escribir los tests que fallan**

`train/tests/test_config.py`:
```python
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
    [{"traversals": 0}, {"game": "poker"}, {"device": "tpu"}, {"lr": -1.0}, {"seed": -1}],
)
def test_validate_rejects_nonsense(bad):
    with pytest.raises(ValueError):
        Config.from_dict(bad)


def test_booleans_and_integers_are_not_interchangeable():
    with pytest.raises(ValueError):
        Config.from_dict({"warm_start": 1})
    with pytest.raises(ValueError):
        Config.from_dict({"traversals": 2.5})
```

`train/tests/test_weights.py`:
```python
import struct

import numpy as np
import torch

from truco_train.model import ScaledMlp
from truco_train.weights import MAGIC, read_tcfrw1, tcfrw1_bytes


def reference_writer(linears, input_scale) -> bytes:
    """El escritor de referencia de docs/weights-format.md, copiado tal cual."""
    import io

    f = io.BytesIO()
    f.write(b"TCFRW1\0\0")
    f.write(struct.pack("<II", len(linears), len(input_scale)))
    f.write(np.asarray(input_scale, dtype="<f4").tobytes())
    for lin in linears:
        w = lin.weight.detach().cpu().numpy().astype("<f4")
        b = lin.bias.detach().cpu().numpy().astype("<f4")
        f.write(struct.pack("<II", w.shape[1], w.shape[0]))
        f.write(w.tobytes(order="C"))
        f.write(b.tobytes())
    return f.getvalue()


def make_net() -> ScaledMlp:
    torch.manual_seed(0)
    scale = np.linspace(0.1, 2.0, 7, dtype=np.float32)
    return ScaledMlp(scale, hidden=5, n_hidden=2, n_out=3)


def test_writer_matches_the_documented_reference_byte_for_byte():
    net = make_net()
    assert net.to_bytes() == reference_writer(net.linears(), net.scale.numpy())


def test_header_layout():
    data = make_net().to_bytes()
    assert data[:8] == MAGIC
    assert struct.unpack_from("<II", data, 8) == (3, 7)  # 3 capas lineales, entrada de 7
    n_in, n_out = struct.unpack_from("<II", data, 16 + 4 * 7)
    assert (n_in, n_out) == (7, 5)


def test_read_back_gives_the_same_weights():
    net = make_net()
    layers, scale = read_tcfrw1(net.to_bytes())
    assert np.array_equal(scale, net.scale.numpy())
    for (w, b), lin in zip(layers, net.linears()):
        assert np.array_equal(w, lin.weight.detach().numpy())
        assert np.array_equal(b, lin.bias.detach().numpy())


def test_tcfrw1_bytes_accepts_any_iterable_of_linears():
    net = make_net()
    assert tcfrw1_bytes(iter(net.linears()), net.scale.numpy()) == net.to_bytes()
```

`train/tests/test_buffers.py`:
```python
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
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_config.py -q 2>&1 | tail -6'`
Expected: error de colección `ModuleNotFoundError: No module named 'truco_train'`.

- [ ] **Step 3: Implementar**

`train/truco_train/__init__.py`:
```python
"""Entrenamiento Deep CFR del bot de truco."""
```

`train/truco_train/config.py`:
```python
"""Configuración de una corrida de entrenamiento (se lee de un archivo TOML)."""
from __future__ import annotations

import json
import tomllib
from dataclasses import asdict, dataclass, fields
from pathlib import Path

GAMES = ("kuhn", "minitruco", "truco")


@dataclass(frozen=True)
class Config:
    game: str = "truco"
    seed: int = 0
    iterations: int = 100
    # K: recorridos por jugador y por iteración.
    traversals: int = 10_000
    threads: int = 8
    # Red: `n_hidden` capas ocultas de `hidden` neuronas con ReLU.
    hidden: int = 256
    n_hidden: int = 3
    # Buffers de reservorio (muestras de ventaja por jugador, y de estrategia).
    adv_capacity: int = 4_000_000
    strat_capacity: int = 8_000_000
    # Entrenamiento de la red de ventajas en cada iteración.
    adv_steps: int = 2_000
    batch_size: int = 4_096
    lr: float = 1e-3
    grad_clip: float = 1.0
    # Los arrepentimientos se dividen por esto antes de entrenar (el regret matching no
    # cambia si todas las ventajas se escalan igual, así que no hace falta deshacerlo).
    adv_scale: float = 10.0
    # True: cada iteración sigue desde los pesos anteriores. False: arranca de cero (como el paper).
    warm_start: bool = True
    # Red de estrategia promedio, al final.
    strat_steps: int = 20_000
    strat_lr: float = 1e-3
    # Monitoreo y checkpoints (en iteraciones).
    eval_every: int = 5
    eval_pairs: int = 100
    checkpoint_every: int = 10
    compress_checkpoints: bool = True
    # Evaluación final de la red de estrategia (pares de partidos duplicados).
    final_pairs: int = 500
    # Si es > 0, la corrida termina sola cuando se cumple este tiempo (segundos).
    time_budget_s: float = 0.0
    device: str = "cuda"

    def validate(self) -> None:
        if self.game not in GAMES:
            raise ValueError(f"game tiene que ser uno de {GAMES}, no {self.game!r}")
        if self.device not in ("cuda", "cpu"):
            raise ValueError(f"device tiene que ser 'cuda' o 'cpu', no {self.device!r}")
        for name in (
            "iterations", "traversals", "threads", "hidden", "n_hidden", "adv_capacity",
            "strat_capacity", "adv_steps", "batch_size", "strat_steps", "eval_every",
            "eval_pairs", "checkpoint_every", "final_pairs",
        ):
            if getattr(self, name) < 1:
                raise ValueError(f"{name} tiene que ser al menos 1")
        if not (0 <= self.seed < 2**31):
            raise ValueError("seed tiene que estar entre 0 y 2**31 - 1")
        if self.adv_scale <= 0 or self.lr <= 0 or self.strat_lr <= 0:
            raise ValueError("adv_scale, lr y strat_lr tienen que ser positivos")

    @classmethod
    def from_dict(cls, data: dict) -> Config:
        defaults = cls()
        names = {f.name for f in fields(cls)}
        unknown = set(data) - names
        if unknown:
            raise ValueError(f"claves desconocidas en la configuración: {sorted(unknown)}")
        clean = {}
        for key, value in data.items():
            default = getattr(defaults, key)
            if isinstance(default, bool):
                if not isinstance(value, bool):
                    raise ValueError(f"{key} tiene que ser true o false")
            elif isinstance(default, float):
                value = float(value)
            elif isinstance(default, int) and (isinstance(value, bool) or not isinstance(value, int)):
                raise ValueError(f"{key} tiene que ser un entero")
            clean[key] = value
        cfg = cls(**clean)
        cfg.validate()
        return cfg

    @classmethod
    def from_toml(cls, path: str | Path) -> Config:
        with open(path, "rb") as f:
            return cls.from_dict(tomllib.load(f))

    @classmethod
    def from_json(cls, text: str) -> Config:
        return cls.from_dict(json.loads(text))

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True)
```

`train/truco_train/weights.py`:
```python
"""Escritura y lectura de pesos en formato TCFRW1 (ver docs/weights-format.md)."""
from __future__ import annotations

import struct
from collections.abc import Iterable
from pathlib import Path

import numpy as np

MAGIC = b"TCFRW1\0\0"


def tcfrw1_bytes(linears: Iterable, input_scale) -> bytes:
    """Serializa capas `torch.nn.Linear` (ReLU entre capas, la última lineal) a TCFRW1."""
    linears = list(linears)
    scale = np.asarray(input_scale, dtype="<f4")
    out = [MAGIC, struct.pack("<II", len(linears), len(scale)), scale.tobytes()]
    for lin in linears:
        w = lin.weight.detach().cpu().numpy().astype("<f4")
        b = lin.bias.detach().cpu().numpy().astype("<f4")
        out.append(struct.pack("<II", w.shape[1], w.shape[0]))
        out.append(np.ascontiguousarray(w).tobytes(order="C"))
        out.append(b.tobytes())
    return b"".join(out)


def write_tcfrw1(path: str | Path, linears: Iterable, input_scale) -> None:
    Path(path).write_bytes(tcfrw1_bytes(linears, input_scale))


def read_tcfrw1(data: bytes):
    """Devuelve (capas, input_scale), con capas = [(w[out, in], b[out]), ...]. Para tests."""
    if data[:8] != MAGIC:
        raise ValueError("no es un archivo TCFRW1")
    n_layers, input_size = struct.unpack_from("<II", data, 8)
    pos = 16
    scale = np.frombuffer(data, dtype="<f4", count=input_size, offset=pos)
    pos += 4 * input_size
    layers = []
    for _ in range(n_layers):
        n_in, n_out = struct.unpack_from("<II", data, pos)
        pos += 8
        w = np.frombuffer(data, dtype="<f4", count=n_in * n_out, offset=pos).reshape(n_out, n_in)
        pos += 4 * n_in * n_out
        b = np.frombuffer(data, dtype="<f4", count=n_out, offset=pos)
        pos += 4 * n_out
        layers.append((w, b))
    if pos != len(data):
        raise ValueError("sobran bytes al final")
    return layers, scale
```

`train/truco_train/model.py`:
```python
"""La red neuronal: entrada u8 × feature_scale -> MLP con ReLU."""
from __future__ import annotations

import numpy as np
import torch
from torch import nn

from .weights import tcfrw1_bytes


class ScaledMlp(nn.Module):
    """Igual que el MLP de Rust: `x_u8 * input_scale`, `n_hidden` capas ocultas con ReLU y una
    capa final lineal."""

    def __init__(self, input_scale, hidden: int, n_hidden: int, n_out: int):
        super().__init__()
        scale = torch.as_tensor(np.asarray(input_scale, dtype=np.float32))
        self.register_buffer("scale", scale)
        layers: list[nn.Module] = []
        n_in = len(scale)
        for _ in range(n_hidden):
            layers += [nn.Linear(n_in, hidden), nn.ReLU()]
            n_in = hidden
        layers.append(nn.Linear(n_in, n_out))
        self.net = nn.Sequential(*layers)

    def forward(self, x_u8: torch.Tensor) -> torch.Tensor:
        return self.net(x_u8.float() * self.scale)

    def linears(self) -> list[nn.Linear]:
        return [m for m in self.net if isinstance(m, nn.Linear)]

    def to_bytes(self) -> bytes:
        return tcfrw1_bytes(self.linears(), self.scale.detach().cpu().numpy())
```

`train/truco_train/buffers.py`:
```python
"""Buffer de reservorio: guarda una muestra uniforme de todo lo que le llegó, en numpy.

El infoset se guarda comprimido como los `u8` de la codificación (304 bytes en truco), no
como floats: 4 M de muestras ocupan unos 1,2 GB.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np


class ReservoirBuffer:
    def __init__(self, capacity: int, enc_size: int, width: int, rng: np.random.Generator):
        self.capacity = capacity
        self.enc = np.zeros((capacity, enc_size), dtype=np.uint8)
        self.values = np.zeros((capacity, width), dtype=np.float32)
        self.masks = np.zeros(capacity, dtype=np.uint16)
        self.t = np.zeros(capacity, dtype=np.int32)
        self.size = 0  # cuántas ranuras están ocupadas
        self.seen = 0  # cuántas muestras pasaron por el buffer en total
        self.rng = rng

    def __len__(self) -> int:
        return self.size

    def add(self, enc: np.ndarray, values: np.ndarray, masks: np.ndarray, t: int) -> None:
        """Agrega un lote (muestreo de reservorio, algoritmo R)."""
        m = len(masks)
        if not (len(enc) == len(values) == m):
            raise ValueError("enc, values y masks tienen que tener el mismo largo")
        if m == 0:
            return
        position = self.seen + np.arange(m, dtype=np.int64)  # lugar de cada muestra en el flujo
        slot = np.where(position < self.capacity, position, -1)
        full = slot < 0
        if full.any():
            # La muestra número k (desde 0) entra con probabilidad capacity / (k + 1).
            j = self.rng.integers(0, position[full] + 1)
            slot[full] = np.where(j < self.capacity, j, -1)
        keep = slot >= 0
        idx = slot[keep]
        # Si dos muestras eligen la misma ranura, gana la última (como en el algoritmo secuencial).
        self.enc[idx] = enc[keep]
        self.values[idx] = values[keep]
        self.masks[idx] = masks[keep]
        self.t[idx] = t
        self.seen += m
        self.size = min(self.capacity, self.seen)

    def save(self, path: str | Path, compress: bool = True) -> None:
        save = np.savez_compressed if compress else np.savez
        save(
            path,
            enc=self.enc[: self.size],
            values=self.values[: self.size],
            masks=self.masks[: self.size],
            t=self.t[: self.size],
            seen=np.array(self.seen, dtype=np.int64),
        )

    def load(self, path: str | Path) -> None:
        with np.load(path) as data:
            n = len(data["masks"])
            if n > self.capacity:
                raise ValueError(
                    f"el checkpoint tiene {n} muestras y la capacidad es {self.capacity}"
                )
            self.enc[:n] = data["enc"]
            self.values[:n] = data["values"]
            self.masks[:n] = data["masks"]
            self.t[:n] = data["t"]
            self.size = n
            self.seen = int(data["seen"])
```

- [ ] **Step 4: Correr y ver que pasan**

Run (uno por vez, cada uno con su archivo):
`wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_config.py -q 2>&1 | tail -6'` → `9 passed`.
`wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_weights.py -q 2>&1 | tail -6'` → `4 passed`.
`wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_buffers.py -q 2>&1 | tail -6'` → `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add train/truco_train train/tests
git commit -m "feat(train): config, TCFRW1 writer, ScaledMlp and reservoir buffer" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Entrenamiento de las redes en la GPU

**En criollo:** ahora que hay muestras, hay que enseñarle a la red. Hay dos tipos de entrenamiento. **Red de ventajas**: dada una situación, tiene que predecir cuánto "se arrepiente" de cada jugada; el error se mide solo sobre las jugadas legales (las ilegales no existen) y las muestras de iteraciones más nuevas pesan más (esto es lo que se llama CFR lineal: lo viejo se olvida de a poco, porque era de cuando la IA jugaba peor). **Red de estrategia**: dada una situación, tiene que reproducir las probabilidades de jugada que se muestrearon; el error es la "entropía cruzada" (qué tan sorprendida queda la red cuando ve la jugada real). El buffer entero se copia a la memoria de la placa de video, que alcanza de sobra (1,2 GB), y los lotes se arman allá adentro: sin cuello de botella.

**Files:**
- Create: `train/truco_train/training.py`
- Test: `train/tests/test_training.py`

**Interfaces:**
- Consumes: `ReservoirBuffer` (`enc`, `values`, `masks`, `t`, `size`), `ScaledMlp`.
- Produces: `train_advantage(model, buf, *, steps, batch_size, lr, grad_clip, adv_scale, seed) -> float` (pérdida promedio del último 10% de pasos); `train_strategy(model, buf, *, steps, batch_size, lr, grad_clip, seed) -> float`. Ambos usan el dispositivo del modelo, bajan el learning rate linealmente hasta el 5%, ponderan por `t` y levantan `ValueError("... vacío ...")` con un buffer vacío. `train_advantage` divide los objetivos por `adv_scale` sin tocar el buffer. Internas probadas: `_masked_mse`, `_masked_cross_entropy`.

- [ ] **Step 1: Escribir los tests que fallan**

`train/tests/test_training.py`:
```python
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
```

- [ ] **Step 2: Correr y ver que falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_training.py -q 2>&1 | tail -6'`
Expected: error de colección `ImportError: cannot import name ... from 'truco_train.training'` (o `No module named 'truco_train.training'`).

- [ ] **Step 3: Implementar**

`train/truco_train/training.py`:
```python
"""Entrenamiento de las redes con los datos de un buffer (todo el buffer vive en la GPU)."""
from __future__ import annotations

import torch

from .buffers import ReservoirBuffer
from .model import ScaledMlp


class _GpuData:
    """Copia del buffer en el dispositivo de entrenamiento (4 M × 304 bytes caben de sobra)."""

    def __init__(self, buf: ReservoirBuffer, device: torch.device):
        n = len(buf)
        if n == 0:
            raise ValueError("el buffer está vacío: no hay con qué entrenar")
        self.n = n
        self.enc = torch.from_numpy(buf.enc[:n]).to(device)
        self.values = torch.from_numpy(buf.values[:n]).to(device)
        # torch no desplaza bits de uint16: las máscaras viajan como int32.
        self.masks = torch.from_numpy(buf.masks[:n].astype("int32")).to(device)
        self.t = torch.from_numpy(buf.t[:n].astype("float32")).to(device)
        self.bits = torch.arange(self.values.shape[1], device=device, dtype=torch.int32)

    def batch(self, size: int, gen: torch.Generator):
        idx = torch.randint(0, self.n, (size,), device=self.enc.device, generator=gen)
        legal = ((self.masks[idx].unsqueeze(1) >> self.bits) & 1).bool()
        return self.enc[idx], self.values[idx], legal, self.t[idx]


def _run(model: ScaledMlp, data: _GpuData, loss_fn, steps: int, batch_size: int, lr: float,
         grad_clip: float, seed: int, decay: bool = False) -> float:
    device = data.enc.device
    gen = torch.Generator(device=device)
    gen.manual_seed(seed)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    tail = max(1, steps // 10)
    recent: list[float] = []
    for step in range(steps):
        if decay:  # el learning rate baja linealmente hasta el 5% al final
            for group in opt.param_groups:
                group["lr"] = lr * (1 - 0.95 * step / steps)
        x, y, legal, t = data.batch(batch_size, gen)
        per_sample = loss_fn(model(x), y, legal)
        # Ponderación lineal de CFR: las muestras de iteraciones tardías pesan más.
        loss = (t * per_sample).sum() / t.sum()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        opt.step()
        if step >= steps - tail:
            recent.append(loss.detach())
    return float(torch.stack(recent).mean())


def _masked_mse(pred, target, legal):
    """Error cuadrático medio solo sobre las acciones legales."""
    sq = (pred - target) ** 2 * legal
    return sq.sum(1) / legal.sum(1).clamp(min=1)


def _masked_cross_entropy(logits, target_probs, legal):
    """Entropía cruzada entre la estrategia muestreada y el softmax sobre las acciones legales."""
    logp = torch.log_softmax(logits.masked_fill(~legal, -1e9), dim=1)
    return -(target_probs * logp).sum(1)


def train_advantage(model: ScaledMlp, buf: ReservoirBuffer, *, steps: int, batch_size: int,
                    lr: float, grad_clip: float, adv_scale: float, seed: int) -> float:
    """MSE ponderado por t y enmascarado, sobre los arrepentimientos divididos por `adv_scale`."""
    data = _GpuData(buf, next(model.parameters()).device)
    data.values = data.values / adv_scale  # copia nueva: en CPU el tensor comparte memoria con el buffer
    return _run(model, data, _masked_mse, steps, batch_size, lr, grad_clip, seed, decay=True)


def train_strategy(model: ScaledMlp, buf: ReservoirBuffer, *, steps: int, batch_size: int,
                   lr: float, grad_clip: float, seed: int) -> float:
    """Entropía cruzada ponderada por t entre las estrategias muestreadas y la red."""
    data = _GpuData(buf, next(model.parameters()).device)
    return _run(model, data, _masked_cross_entropy, steps, batch_size, lr, grad_clip, seed,
                decay=True)
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_training.py -q 2>&1 | tail -6'`
Expected: `11 passed` con GPU (sin GPU se saltean los casos `cuda` y pasan 7). Tarda unos 20 segundos la primera vez por la inicialización de CUDA.

- [ ] **Step 5: Commit**

```bash
git add train/truco_train/training.py train/tests/test_training.py
git commit -m "feat(train): masked, t-weighted advantage and strategy training on GPU" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Deep CFR completo — circuito, convergencia en Kuhn y MiniTruco, y paridad con Rust

**En criollo:** juntamos todo. `DeepCfr.step()` hace una iteración completa: para cada jugador, le pide a Rust miles de recorridos, guarda las muestras en los buffers y entrena su red de ventajas, que se exporta a bytes para que Rust la use en el siguiente recorrido. Y la prueba de fuego: antes de gastar una noche entera de GPU en el truco, comprobamos que **el algoritmo converge en juegos chicos donde sabemos la respuesta**. En Kuhn poker (3 cartas) la explotabilidad exacta de la estrategia aprendida tiene que bajar de 0,01 (el spec lo exige); en MiniTruco tiene que bajar claramente. "Explotabilidad" es cuánto le puede ganar un rival *perfecto* a lo que aprendió la IA: 0 es juego perfecto. También se comprueba la **paridad**: la red de PyTorch y el forward de Rust (el que correrá en la web) dan el mismo resultado hasta 4 decimales. Si esta paridad fallara, el bot de la web jugaría distinto del que entrenaste.

**Files:**
- Create: `train/truco_train/deepcfr.py`
- Test: `train/tests/test_engine_bridge_nets.py`, `train/tests/test_parity.py`, `train/tests/test_deepcfr_convergence.py`

**Interfaces:**
- Consumes: `truco_engine_py.{game_info, traverse_batch, exploitability, eval_duplicate, mlp_forward, Hand}` (Tarea 4); `Config`, `ScaledMlp`, `ReservoirBuffer`, `train_advantage`, `train_strategy` (Tareas 5 y 6).
- Produces: `unpack(batch, enc_size, n_actions) -> (adv, strat, nodes)` con `adv`/`strat` = `(enc u8[n, enc_size], values f32[n, n_actions], masks u16[n])`; `class DeepCfr(cfg)` con atributos `cfg, enc_size, n_actions, scale, device, rng, adv_nets (2 × ScaledMlp), adv_bufs (2 × ReservoirBuffer), strat_buf, net_bytes (list[bytes | None]), iteration, elapsed_s, last_strategy_loss`; `seed_for(t, p, stream=0) -> int` (< 2**63); `step() -> dict` (claves `iter, traversal_s, train_s, nodes, adv_loss[2], buf_adv[2], buf_strat`); `train_strategy_net(steps=None) -> ScaledMlp`.

- [ ] **Step 1: Escribir los tests que fallan**

`train/tests/test_engine_bridge_nets.py` (el puente con redes de verdad):
```python
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
```

`train/tests/test_parity.py`:
```python
"""Paridad entre el forward de PyTorch y el de Rust (el mismo que correrá el WASM)."""
import random

import numpy as np
import pytest
import torch
import truco_engine_py as eng

from truco_train.model import ScaledMlp


def real_encodings(n):
    """Codificaciones reales de situaciones de truco (de jugadas al azar)."""
    rng = random.Random(0)
    rows = []
    seed = 0
    while len(rows) < n:
        hand = eng.Hand(seed)
        seed += 1
        while not hand.is_terminal() and len(rows) < n:
            rows.append(hand.encode(hand.current_player()))
            mask = hand.legal_mask()
            hand.apply(rng.choice([a for a in range(12) if mask & (1 << a)]))
    return np.frombuffer(b"".join(rows), dtype=np.uint8).reshape(n, 304)


@pytest.mark.parametrize("hidden,n_hidden", [(32, 2), (128, 3)])
def test_pytorch_and_rust_forward_agree(hidden, n_hidden):
    torch.manual_seed(1)
    _, _, scale = eng.game_info("truco")
    net = ScaledMlp(scale, hidden, n_hidden, 12)
    # Pesos más grandes que el default, para que la comparación no sea trivial.
    for p in net.parameters():
        torch.nn.init.normal_(p, std=0.3)
    x = real_encodings(200)
    with torch.no_grad():
        expected = net(torch.from_numpy(x.copy())).numpy()
    got = np.frombuffer(eng.mlp_forward(net.to_bytes(), x.tobytes()), dtype="<f4").reshape(200, 12)
    assert np.abs(got - expected).max() < 1e-4
    assert np.abs(expected).max() > 0.1, "la salida no puede ser casi cero"


def test_mlp_forward_rejects_bad_input():
    net = ScaledMlp(np.ones(4, np.float32), 4, 1, 2).to_bytes()
    with pytest.raises(ValueError, match="múltiplo"):
        eng.mlp_forward(net, b"\x00" * 5)
    with pytest.raises(ValueError):
        eng.mlp_forward(b"basura", b"\x00" * 4)
```

`train/tests/test_deepcfr_convergence.py`:
```python
"""Validación de Deep CFR en los juegos chicos (spec 3.2, etapas 1 y 2).

Son los tests lentos de verdad (30 a 60 segundos cada uno, en CPU y con un solo hilo).
Si en otra máquina el de Kuhn da entre 0,01 y 0,02, subir `iterations` (nunca el umbral).
"""
import dataclasses

import truco_engine_py as eng

from truco_train.config import Config
from truco_train.deepcfr import DeepCfr


def small_game_config(game: str, **overrides) -> Config:
    base = dataclasses.asdict(Config())
    base.update(
        game=game, seed=1, threads=1, hidden=64, n_hidden=2, adv_capacity=2_000_000,
        strat_capacity=2_000_000, adv_steps=100, batch_size=2048, lr=2e-3, adv_scale=2.0,
        strat_steps=2000, device="cpu",
    )
    base.update(overrides)
    return Config.from_dict(base)


def strategy_exploitability(dcfr: DeepCfr) -> float:
    net = dcfr.train_strategy_net()
    return eng.exploitability(dcfr.cfg.game, "strategy", net.to_bytes())


def test_deep_cfr_reaches_exploitability_below_0_01_on_kuhn():
    dcfr = DeepCfr(small_game_config("kuhn", traversals=20_000))
    for _ in range(60):
        dcfr.step()
    expl = strategy_exploitability(dcfr)
    assert expl < 0.01, f"explotabilidad de la red de estrategia en Kuhn: {expl:.4f}"


def test_deep_cfr_exploitability_decreases_on_minitruco():
    dcfr = DeepCfr(small_game_config("minitruco", traversals=5_000))
    for _ in range(10):
        dcfr.step()
    early = strategy_exploitability(dcfr)
    for _ in range(30):
        dcfr.step()
    late = strategy_exploitability(dcfr)
    assert late < early / 2, f"early={early:.4f} late={late:.4f}"
    assert late < 0.05, f"explotabilidad final en MiniTruco: {late:.4f}"
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_engine_bridge_nets.py -q 2>&1 | tail -6'`
Expected: error de colección `ModuleNotFoundError: No module named 'truco_train.deepcfr'`.

- [ ] **Step 3: Implementar**

`train/truco_train/deepcfr.py`:
```python
"""El circuito de Deep CFR: recorridos en Rust, buffers en numpy, redes en PyTorch."""
from __future__ import annotations

import time

import numpy as np
import torch
import truco_engine_py as eng

from .buffers import ReservoirBuffer
from .config import Config
from .model import ScaledMlp
from .training import train_advantage, train_strategy


def unpack(batch, enc_size: int, n_actions: int):
    """Convierte los bytes que devuelve `traverse_batch` en arrays de numpy (sin copiar)."""
    adv_enc, adv_val, adv_mask, st_enc, st_val, st_mask, nodes = batch
    return (
        (
            np.frombuffer(adv_enc, dtype=np.uint8).reshape(-1, enc_size),
            np.frombuffer(adv_val, dtype="<f4").reshape(-1, n_actions),
            np.frombuffer(adv_mask, dtype="<u2"),
        ),
        (
            np.frombuffer(st_enc, dtype=np.uint8).reshape(-1, enc_size),
            np.frombuffer(st_val, dtype="<f4").reshape(-1, n_actions),
            np.frombuffer(st_mask, dtype="<u2"),
        ),
        nodes,
    )


class DeepCfr:
    def __init__(self, cfg: Config):
        cfg.validate()
        self.cfg = cfg
        self.enc_size, self.n_actions, self.scale = eng.game_info(cfg.game)
        self.device = torch.device(cfg.device)
        torch.manual_seed(cfg.seed)
        self.rng = np.random.default_rng(cfg.seed)
        self.adv_nets = [self._new_net().to(self.device) for _ in range(2)]
        self.adv_bufs = [
            ReservoirBuffer(cfg.adv_capacity, self.enc_size, self.n_actions, self.rng)
            for _ in range(2)
        ]
        self.strat_buf = ReservoirBuffer(cfg.strat_capacity, self.enc_size, self.n_actions, self.rng)
        # TCFRW1 de cada red de ventajas; None = todavía no hay (política uniforme).
        self.net_bytes: list[bytes | None] = [None, None]
        self.iteration = 0
        self.elapsed_s = 0.0
        self.last_strategy_loss: float | None = None

    def _new_net(self) -> ScaledMlp:
        return ScaledMlp(self.scale, self.cfg.hidden, self.cfg.n_hidden, self.n_actions)

    def seed_for(self, t: int, p: int, stream: int = 0) -> int:
        """Semilla determinista (menor que 2**63) para la iteración `t`, el jugador `p`."""
        ss = np.random.SeedSequence([self.cfg.seed, t, p, stream])
        return int(ss.generate_state(1, dtype=np.uint64)[0] >> np.uint64(1))

    def step(self) -> dict:
        """Una iteración de Deep CFR: para cada jugador, recorridos + entrenamiento."""
        cfg = self.cfg
        t = self.iteration + 1
        started = time.perf_counter()
        stats: dict = {"iter": t, "traversal_s": 0.0, "train_s": 0.0, "nodes": 0,
                       "adv_loss": [None, None]}
        for p in (0, 1):
            t0 = time.perf_counter()
            batch = eng.traverse_batch(
                cfg.game, p, self.seed_for(t, p), 0, cfg.traversals,
                self.net_bytes[0], self.net_bytes[1], cfg.threads,
            )
            adv, strat, nodes = unpack(batch, self.enc_size, self.n_actions)
            self.adv_bufs[p].add(*adv, t)
            self.strat_buf.add(*strat, t)
            stats["nodes"] += nodes
            t1 = time.perf_counter()
            if not cfg.warm_start:
                self.adv_nets[p] = self._new_net().to(self.device)
            stats["adv_loss"][p] = train_advantage(
                self.adv_nets[p], self.adv_bufs[p], steps=cfg.adv_steps,
                batch_size=cfg.batch_size, lr=cfg.lr, grad_clip=cfg.grad_clip,
                adv_scale=cfg.adv_scale, seed=self.seed_for(t, p, 1),
            )
            self.net_bytes[p] = self.adv_nets[p].to_bytes()
            stats["traversal_s"] += t1 - t0
            stats["train_s"] += time.perf_counter() - t1
        self.iteration = t
        self.elapsed_s += time.perf_counter() - started
        stats["buf_adv"] = [len(b) for b in self.adv_bufs]
        stats["buf_strat"] = len(self.strat_buf)
        return stats

    def train_strategy_net(self, steps: int | None = None) -> ScaledMlp:
        """Entrena la red de estrategia promedio con el buffer de estrategia."""
        cfg = self.cfg
        net = self._new_net().to(self.device)
        self.last_strategy_loss = train_strategy(
            net, self.strat_buf, steps=steps or cfg.strat_steps, batch_size=cfg.batch_size,
            lr=cfg.strat_lr, grad_clip=cfg.grad_clip, seed=self.seed_for(self.iteration, 0, 2),
        )
        return net
```

- [ ] **Step 4: Correr el puente con redes y la paridad**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_engine_bridge_nets.py -q 2>&1 | tail -6'` → `5 passed`.
Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_parity.py -q 2>&1 | tail -6'` → `3 passed`.

- [ ] **Step 5: Correr la convergencia (los tests lentos, ~1 minuto en total)**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_deepcfr_convergence.py -q 2>&1 | tail -8'`
Expected: `2 passed in ~55s`. Valores medidos al planificar (CPU, un hilo): Kuhn, explotabilidad de la red de estrategia ≈ 0,005 con la semilla 1 (0,0052 / 0,0075 / 0,0056 / 0,0080 con las semillas 1–4 a las 60 iteraciones); MiniTruco ≈ 0,13 a las 10 iteraciones y ≈ 0,02 a las 40.

**Si el de Kuhn da entre 0,01 y 0,02 en otra máquina** (el ruido de ajustar redes pone un piso cerca de 0,005–0,01): subir `iterations` de 60 a 100 o `traversals` de 20 000 a 40 000, en ese orden. No se toca el umbral de 0,01 (es el criterio de éxito del spec). Si hace falta más margen, `adv_steps` de 100 a 200 con `batch_size` 4096.

- [ ] **Step 6: Commit**

```bash
git add train/truco_train/deepcfr.py train/tests/test_engine_bridge_nets.py train/tests/test_parity.py train/tests/test_deepcfr_convergence.py
git commit -m "feat(train): DeepCfr loop; Kuhn/MiniTruco convergence and PyTorch-Rust parity tests" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Corridas — monitoreo, checkpoints, reanudación, exportación e informe

**En criollo:** hasta ahora hay un circuito que sabe dar *un* paso. Esta tarea lo convierte en una **corrida** que puede durar toda la noche sin que tengas que cuidarla: itera, cada tanto mide qué tan bien juega la política actual (partidos contra el bot al azar y contra el heurístico) y lo anota en `runs/<id>/metrics.jsonl`, y cada tanto guarda un **checkpoint** (pesos, buffers, estado del azar, número de iteración) de forma segura: si se corta la luz mientras guarda, el checkpoint anterior queda intacto. Si se corta, `resume` retoma desde ahí *como si nada*: los resultados son idénticos a los de una corrida sin cortes (hay un test que lo demuestra). Al terminar entrena la red de estrategia promedio, la exporta a `strategy.tcfrw` y arma `final.json`. Un comando `report` convierte todo eso en el informe en Markdown.

**Files:**
- Create: `train/truco_train/monitor.py`, `train/truco_train/checkpoint.py`, `train/truco_train/run.py`, `train/truco_train/report.py`, `train/truco_train/__main__.py`
- Create: `train/tests/helpers.py`
- Modify: `train/tests/conftest.py`
- Test: `train/tests/test_smoke_truco.py`, `train/tests/test_resume.py`, `train/tests/test_report.py`

**Interfaces:**
- Consumes: `DeepCfr` y `unpack` (Tarea 7), `Config` (Tarea 5), `truco_engine_py.{eval_duplicate, exploitability}`.
- Produces:
  - `wilson(wins, n, z=1.96) -> (lo, hi)`; `duplicate_vs(cfg, opponent, mode, net0, net1, pairs, seed) -> {"wins", "games", "rate", "lo", "hi"}`; `evaluate(cfg, net_bytes, seed) -> dict` (truco: `{"heuristic": ..., "random": ...}`; Kuhn/MiniTruco: `{"exploitability_current": float}`; `{}` si todavía no hay redes).
  - `save_checkpoint(dcfr, run_dir)`, `load_checkpoint(run_dir, cfg) -> DeepCfr`, `has_checkpoint(run_dir) -> bool` (carpeta `run_dir/checkpoint/` con `state.pt`, `adv0.npz`, `adv1.npz`, `strat.npz`; el guardado es atómico).
  - `start(cfg, runs_dir, run_id=None, name="run", config_toml=None) -> Path`, `resume(run_dir, iterations=None) -> Path`, `drive(dcfr, run_dir)`, `finalize(dcfr, run_dir) -> dict`. Archivos de una corrida: `config.json`, `config.toml` (si se dio), `metrics.jsonl`, `checkpoint/`, `strategy.tcfrw`, `final.json` (`game, iterations, elapsed_s, strategy_bytes, strategy_sha256, strategy_loss` y `vs_heuristic`/`vs_random` o `exploitability`).
  - `build_report(run_dir) -> str`.
  - CLI: `python -m truco_train run --config C [--runs-dir D] [--run-id ID]`, `resume RUN_DIR [--iterations N]`, `report RUN_DIR [--out F]`.
  - Test helpers: `tiny_truco_config(**overrides) -> Config`; fixture de sesión `tiny_run`.

- [ ] **Step 1: Escribir los helpers y los tests que fallan**

`train/tests/helpers.py`:
```python
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
```

`train/tests/conftest.py` (reemplazar; agrega la corrida mínima compartida):
```python
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
```

`train/tests/test_smoke_truco.py`:
```python
"""Smoke test: 2 iteraciones de Deep CFR en el truco completo, de punta a punta."""
import json

import pytest
import torch
import truco_engine_py as eng

from truco_train.run import start
from truco_train.weights import read_tcfrw1

from .helpers import tiny_truco_config


def test_two_iterations_produce_every_artifact(tiny_run):
    metrics = [json.loads(line) for line in (tiny_run / "metrics.jsonl").read_text().splitlines()]
    assert [m["iter"] for m in metrics] == [1, 2]
    for m in metrics:
        assert m["nodes"] > 0 and m["buf_strat"] > 0 and min(m["buf_adv"]) > 0
        assert all(loss == loss for loss in m["adv_loss"]), "pérdida NaN"
    # eval_every=1: desde la iteración 1 hay resultados contra heurístico y azar.
    for m in metrics:
        for opp in ("heuristic", "random"):
            r = m["eval"][opp]
            assert r["games"] == 6 and 0 <= r["wins"] <= 6 and r["lo"] <= r["rate"] <= r["hi"]
    final = json.loads((tiny_run / "final.json").read_text())
    assert final["iterations"] == 2 and final["vs_heuristic"]["games"] == 6
    assert len(final["strategy_sha256"]) == 64
    assert (tiny_run / "config.json").exists()
    assert (tiny_run / "checkpoint" / "state.pt").exists()


def test_exported_strategy_is_a_valid_tcfrw1_that_rust_can_play(tiny_run):
    data = (tiny_run / "strategy.tcfrw").read_bytes()
    layers, scale = read_tcfrw1(data)
    assert len(scale) == 304 and layers[0][0].shape[1] == 304 and layers[-1][0].shape[0] == 12
    wins, games = eng.eval_duplicate("random", "strategy", data, None, 2, 0, 1)
    assert games == 4


@pytest.mark.skipif(not torch.cuda.is_available(), reason="sin GPU")
def test_the_same_smoke_run_works_on_the_gpu(tmp_path):
    run_dir = start(tiny_truco_config(device="cuda"), tmp_path, run_id="gpu")
    assert (run_dir / "strategy.tcfrw").exists()
```

`train/tests/test_resume.py`:
```python
import json

import numpy as np
import pytest

from truco_train.checkpoint import has_checkpoint, load_checkpoint, save_checkpoint
from truco_train.deepcfr import DeepCfr
from truco_train.run import resume, start

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
```

`train/tests/test_report.py`:
```python
import pytest

from truco_train.monitor import wilson
from truco_train.report import build_report


def test_wilson_interval_known_values():
    lo, hi = wilson(50, 100)
    assert lo == pytest.approx(0.4038, abs=1e-3) and hi == pytest.approx(0.5962, abs=1e-3)
    assert wilson(0, 0) == (0.0, 1.0)
    lo, hi = wilson(100, 100)
    assert hi == pytest.approx(1.0) and lo > 0.95


def test_report_contains_the_run_facts(tiny_run):
    text = build_report(tiny_run)
    assert text.startswith("# Informe de entrenamiento")
    assert "`tiny`" in text and "Heurístico" in text and "Azar" in text
    assert "| 2 |" in text, "la curva de aprendizaje tiene que incluir la iteración 2"
    assert "$" not in text, "quedó un campo de la plantilla sin llenar"


def test_report_on_an_unfinished_run_says_so(tiny_run, tmp_path):
    import shutil

    partial = tmp_path / "partial"
    partial.mkdir()
    shutil.copy(tiny_run / "config.json", partial / "config.json")
    shutil.copy(tiny_run / "metrics.jsonl", partial / "metrics.jsonl")
    assert "todavía no terminó" in build_report(partial)
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_report.py -q 2>&1 | tail -6'`
Expected: error de colección `ModuleNotFoundError: No module named 'truco_train.monitor'` (o `.report`).

- [ ] **Step 3: Implementar**

`train/truco_train/monitor.py`:
```python
"""Monitoreo: qué tan bien juega la política actual (barato) y el intervalo de Wilson."""
from __future__ import annotations

import math

import truco_engine_py as eng

from .config import Config


def wilson(wins: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Intervalo de Wilson al 95% para una proporción."""
    if n == 0:
        return (0.0, 1.0)
    p = wins / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, center - half), min(1.0, center + half))


def duplicate_vs(cfg: Config, opponent: str, mode: str, net0: bytes, net1: bytes | None,
                 pairs: int, seed: int) -> dict:
    wins, games = eng.eval_duplicate(opponent, mode, net0, net1, pairs, seed, cfg.threads)
    lo, hi = wilson(wins, games)
    return {"wins": wins, "games": games, "rate": wins / games, "lo": lo, "hi": hi}


def evaluate(cfg: Config, net_bytes: list[bytes | None], seed: int) -> dict:
    """Política actual por regret matching. En truco: partidos duplicados contra el
    heurístico y el azar. En los juegos chicos: explotabilidad exacta de la política actual
    (que no es la promedio, así que es ruidosa)."""
    if net_bytes[0] is None or net_bytes[1] is None:
        return {}
    if cfg.game == "truco":
        return {
            opp: duplicate_vs(cfg, opp, "advantage", net_bytes[0], net_bytes[1],
                              cfg.eval_pairs, seed)
            for opp in ("heuristic", "random")
        }
    return {"exploitability_current": eng.exploitability(cfg.game, "advantage",
                                                         net_bytes[0], net_bytes[1])}
```

`train/truco_train/checkpoint.py`:
```python
"""Checkpoints: pesos, buffers, estado de los generadores aleatorios y número de iteración."""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
import torch

from .config import Config
from .deepcfr import DeepCfr

DIR = "checkpoint"


def save_checkpoint(dcfr: DeepCfr, run_dir: Path) -> None:
    """Escribe en una carpeta temporal y recién después reemplaza la anterior, así un corte
    de luz a mitad del guardado no destruye el último checkpoint bueno."""
    final = run_dir / DIR
    tmp = run_dir / f"{DIR}.tmp"
    old = run_dir / f"{DIR}.old"
    for d in (tmp, old):
        if d.exists():
            shutil.rmtree(d)
    tmp.mkdir(parents=True)
    compress = dcfr.cfg.compress_checkpoints
    for p in (0, 1):
        dcfr.adv_bufs[p].save(tmp / f"adv{p}.npz", compress)
    dcfr.strat_buf.save(tmp / "strat.npz", compress)
    state = {
        "iteration": dcfr.iteration,
        "elapsed_s": dcfr.elapsed_s,
        "adv_nets": [net.state_dict() for net in dcfr.adv_nets],
        "np_rng": dcfr.rng.bit_generator.state,
        "torch_rng": torch.get_rng_state(),
    }
    torch.save(state, tmp / "state.pt")
    if final.exists():
        final.rename(old)
    tmp.rename(final)
    if old.exists():
        shutil.rmtree(old)


def has_checkpoint(run_dir: Path) -> bool:
    return (run_dir / DIR / "state.pt").exists()


def load_checkpoint(run_dir: Path, cfg: Config) -> DeepCfr:
    """Reconstruye un `DeepCfr` exactamente como estaba al guardar."""
    src = run_dir / DIR
    dcfr = DeepCfr(cfg)
    state = torch.load(src / "state.pt", weights_only=False, map_location=dcfr.device)
    dcfr.iteration = state["iteration"]
    dcfr.elapsed_s = state["elapsed_s"]
    for p in (0, 1):
        dcfr.adv_nets[p].load_state_dict(state["adv_nets"][p])
        dcfr.net_bytes[p] = dcfr.adv_nets[p].to_bytes() if dcfr.iteration > 0 else None
        dcfr.adv_bufs[p].load(src / f"adv{p}.npz")
    dcfr.strat_buf.load(src / "strat.npz")
    dcfr.rng.bit_generator.state = state["np_rng"]
    torch.set_rng_state(state["torch_rng"].cpu())
    return dcfr
```

`train/truco_train/run.py`:
```python
"""Corridas: `run` (empezar), `resume` (retomar), `finalize` (red de estrategia + exportación)."""
from __future__ import annotations

import hashlib
import json
import shutil
import time
from datetime import datetime
from pathlib import Path

import truco_engine_py as eng

from .checkpoint import has_checkpoint, load_checkpoint, save_checkpoint
from .config import Config
from .deepcfr import DeepCfr
from .monitor import duplicate_vs, evaluate


def _append(path: Path, record: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def _short(stats: dict) -> str:
    parts = [f"iter {stats['iter']:>4}", f"recorridos {stats['traversal_s']:.1f}s",
             f"entrenamiento {stats['train_s']:.1f}s",
             f"pérdida {stats['adv_loss'][0]:.4f}/{stats['adv_loss'][1]:.4f}"]
    for opp, r in stats.get("eval", {}).items():
        if isinstance(r, dict):
            parts.append(f"vs {opp} {r['rate']:.0%} [{r['lo']:.0%}, {r['hi']:.0%}]")
        else:
            parts.append(f"{opp} {r:.4f}")
    return " | ".join(parts)


def start(cfg: Config, runs_dir: Path, run_id: str | None = None, name: str = "run",
          config_toml: Path | None = None) -> Path:
    """Crea `runs/<id>/` y corre el entrenamiento completo. Si se da `config_toml`, lo copia
    junto a la corrida."""
    run_id = run_id or f"{name}-{datetime.now():%Y%m%d-%H%M%S}"
    run_dir = runs_dir / run_id
    if run_dir.exists():
        raise FileExistsError(f"ya existe {run_dir}: usá `resume` o cambiá --run-id")
    run_dir.mkdir(parents=True)
    (run_dir / "config.json").write_text(cfg.to_json(), encoding="utf-8")
    if config_toml is not None:
        shutil.copy(config_toml, run_dir / "config.toml")
    drive(DeepCfr(cfg), run_dir)
    return run_dir


def resume(run_dir: Path, iterations: int | None = None) -> Path:
    """Retoma una corrida desde su último checkpoint. `iterations` extiende el objetivo."""
    cfg = Config.from_json((run_dir / "config.json").read_text(encoding="utf-8"))
    if iterations is not None:
        data = json.loads(cfg.to_json())
        data["iterations"] = iterations
        cfg = Config.from_dict(data)
        (run_dir / "config.json").write_text(cfg.to_json(), encoding="utf-8")
    if not has_checkpoint(run_dir):
        raise FileNotFoundError(f"{run_dir} no tiene checkpoint: todavía no se guardó ninguno")
    dcfr = load_checkpoint(run_dir, cfg)
    print(f"retomando {run_dir.name} desde la iteración {dcfr.iteration}")
    drive(dcfr, run_dir)
    return run_dir


def drive(dcfr: DeepCfr, run_dir: Path) -> None:
    """Itera hasta `cfg.iterations` (o hasta agotar `time_budget_s`), guardando métricas y
    checkpoints. Con Ctrl-C guarda un checkpoint y sale sin finalizar (se puede retomar)."""
    cfg = dcfr.cfg
    metrics = run_dir / "metrics.jsonl"
    began = time.monotonic()
    try:
        while dcfr.iteration < cfg.iterations:
            stats = dcfr.step()
            t = dcfr.iteration
            if t % cfg.eval_every == 0:
                stats["eval"] = evaluate(cfg, dcfr.net_bytes, dcfr.seed_for(t, 0, 3))
            stats["elapsed_s"] = dcfr.elapsed_s
            _append(metrics, stats)
            print(_short(stats), flush=True)
            if t % cfg.checkpoint_every == 0:
                save_checkpoint(dcfr, run_dir)
            if cfg.time_budget_s > 0 and time.monotonic() - began >= cfg.time_budget_s:
                print("se cumplió time_budget_s: termina la corrida", flush=True)
                break
    except KeyboardInterrupt:
        save_checkpoint(dcfr, run_dir)
        print(f"interrumpido en la iteración {dcfr.iteration}; retomá con: "
              f"python -m truco_train resume {run_dir}", flush=True)
        return
    save_checkpoint(dcfr, run_dir)
    finalize(dcfr, run_dir)


def finalize(dcfr: DeepCfr, run_dir: Path) -> dict:
    """Entrena la red de estrategia promedio, la exporta a `strategy.tcfrw` y la evalúa."""
    cfg = dcfr.cfg
    net = dcfr.train_strategy_net()
    data = net.to_bytes()
    (run_dir / "strategy.tcfrw").write_bytes(data)
    final: dict = {
        "game": cfg.game,
        "iterations": dcfr.iteration,
        "elapsed_s": dcfr.elapsed_s,
        "strategy_bytes": len(data),
        "strategy_sha256": hashlib.sha256(data).hexdigest(),
        "strategy_loss": dcfr.last_strategy_loss,
    }
    if cfg.game == "truco":
        for opp in ("heuristic", "random"):
            final[f"vs_{opp}"] = duplicate_vs(cfg, opp, "strategy", data, None, cfg.final_pairs,
                                              dcfr.seed_for(dcfr.iteration, 0, 4))
    else:
        final["exploitability"] = eng.exploitability(cfg.game, "strategy", data)
    (run_dir / "final.json").write_text(json.dumps(final, indent=2), encoding="utf-8")
    print("listo: " + json.dumps(final), flush=True)
    return final
```

`train/truco_train/report.py`:
```python
"""Arma el informe de entrenamiento (docs/training-report.md) a partir de una corrida."""
from __future__ import annotations

import json
from pathlib import Path
from string import Template

TEMPLATE = Template(
    """# Informe de entrenamiento

Corrida `$run_id`. Generado por `python -m truco_train report`.

## Qué se entrenó

- Algoritmo: Deep CFR con muestreo externo y ponderación lineal por iteración.
- Juego: `$game`. Red: $n_hidden capas ocultas de $hidden neuronas (ReLU), entrada de bytes por `feature_scale`.
- $iterations iteraciones, $traversals recorridos por jugador y por iteración (K), semilla $seed.
- Buffers de reservorio: $adv_capacity muestras de ventaja por jugador, $strat_capacity de estrategia.
- Arranque de cada iteración: $warm_start.
- Tiempo total de entrenamiento: $hours horas. Archivo de pesos: `strategy.tcfrw` ($kib KiB, SHA-256 `$sha`).

## Resultados de la red de estrategia promedio

$final_table

Los intervalos son de Wilson al 95%, sobre partidos completos a 30 en formato duplicado.

## Curva de aprendizaje

Política actual (regret matching sobre las redes de ventajas), medida durante el entrenamiento.

$curve_table

## Limitaciones

- La explotabilidad exacta solo se calcula en Kuhn y MiniTruco. En el truco completo no se calcula;
  la medida de fuerza es el rendimiento contra el heurístico propio y contra el azar.
- Es una sola corrida con una sola semilla: no hay intervalos de confianza entre corridas.
- Todos los números de este informe salen de `runs/$run_id/metrics.jsonl` y `final.json`.
"""
)


def _rate(r: dict) -> str:
    return f"{r['rate']:.1%} [{r['lo']:.1%}, {r['hi']:.1%}] ({r['wins']}/{r['games']})"


def build_report(run_dir: Path) -> str:
    cfg = json.loads((run_dir / "config.json").read_text(encoding="utf-8"))
    final_path = run_dir / "final.json"
    final = json.loads(final_path.read_text(encoding="utf-8")) if final_path.exists() else {}
    rows = [json.loads(line) for line in (run_dir / "metrics.jsonl").read_text(encoding="utf-8").splitlines() if line]

    if "vs_heuristic" in final:
        final_table = "| Rival | Partidos ganados |\n|---|---|\n" + "\n".join(
            f"| {name} | {_rate(final['vs_' + key])} |"
            for key, name in (("heuristic", "Heurístico"), ("random", "Azar"))
        )
    elif "exploitability" in final:
        final_table = f"Explotabilidad exacta: **{final['exploitability']:.4f}**."
    else:
        final_table = "_La corrida todavía no terminó (falta `final.json`)._"

    evals = [r for r in rows if r.get("eval")]
    if evals and "heuristic" in evals[0]["eval"]:
        curve = "| Iteración | vs heurístico | vs azar |\n|---|---|---|\n" + "\n".join(
            f"| {r['iter']} | {_rate(r['eval']['heuristic'])} | {_rate(r['eval']['random'])} |"
            for r in evals
        )
    elif evals:
        curve = "| Iteración | Explotabilidad (política actual) |\n|---|---|\n" + "\n".join(
            f"| {r['iter']} | {r['eval']['exploitability_current']:.4f} |" for r in evals
        )
    else:
        curve = "_Sin mediciones todavía._"

    elapsed = final.get("elapsed_s", rows[-1]["elapsed_s"] if rows else 0.0)
    return TEMPLATE.substitute(
        run_id=run_dir.name,
        game=cfg["game"],
        n_hidden=cfg["n_hidden"],
        hidden=cfg["hidden"],
        iterations=final.get("iterations", rows[-1]["iter"] if rows else 0),
        traversals=f"{cfg['traversals']:,}".replace(",", " "),
        seed=cfg["seed"],
        adv_capacity=f"{cfg['adv_capacity']:,}".replace(",", " "),
        strat_capacity=f"{cfg['strat_capacity']:,}".replace(",", " "),
        warm_start="desde los pesos anteriores" if cfg["warm_start"] else "desde cero",
        hours=f"{elapsed / 3600:.2f}",
        kib=f"{final.get('strategy_bytes', 0) / 1024:.0f}",
        sha=final.get("strategy_sha256", "n/d"),
        final_table=final_table,
        curve_table=curve,
    )
```

`train/truco_train/__main__.py`:
```python
"""Línea de comandos.

    uv run python -m truco_train run --config configs/smoke.toml
    uv run python -m truco_train resume runs/<id> [--iterations N]
    uv run python -m truco_train report runs/<id> --out ../docs/training-report.md
"""
from __future__ import annotations

import argparse
from pathlib import Path

from .config import Config
from .report import build_report
from .run import resume, start


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="truco_train")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="empezar una corrida nueva")
    p_run.add_argument("--config", type=Path, required=True)
    p_run.add_argument("--runs-dir", type=Path, default=Path("runs"))
    p_run.add_argument("--run-id", default=None)

    p_res = sub.add_parser("resume", help="retomar una corrida desde su último checkpoint")
    p_res.add_argument("run_dir", type=Path)
    p_res.add_argument("--iterations", type=int, default=None, help="nuevo objetivo de iteraciones")

    p_rep = sub.add_parser("report", help="armar el informe de una corrida")
    p_rep.add_argument("run_dir", type=Path)
    p_rep.add_argument("--out", type=Path, default=None)

    args = parser.parse_args(argv)
    if args.command == "run":
        cfg = Config.from_toml(args.config)
        start(cfg, args.runs_dir, args.run_id, name=args.config.stem, config_toml=args.config)
    elif args.command == "resume":
        resume(args.run_dir, args.iterations)
    else:
        text = build_report(args.run_dir)
        if args.out:
            args.out.write_text(text, encoding="utf-8")
            print(f"informe escrito en {args.out}")
        else:
            print(text)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_report.py -q 2>&1 | tail -6'` → `3 passed`.
Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_smoke_truco.py -q 2>&1 | tail -6'` → `3 passed` con GPU (`2 passed, 1 skipped` sin GPU). Es el smoke test del spec: 2 iteraciones de truco de punta a punta.
Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_resume.py -q 2>&1 | tail -6'` → `6 passed`.

- [ ] **Step 5: Probar la línea de comandos a mano**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python -m truco_train --help 2>&1 | tail -12'`
Expected: lista los subcomandos `run`, `resume` y `report`.

- [ ] **Step 6: Commit**

```bash
git add train/truco_train train/tests
git commit -m "feat(train): runs with monitoring, atomic checkpoints, resume, export and report" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Medición de velocidad, configuraciones entregables y notas de rendimiento

**En criollo:** antes de lanzar la corrida de toda la noche hay que saber *cuánto tarda cada cosa*, para elegir cuántos recorridos por iteración (K) caben. Esta tarea agrega un script que mide dos números: cuántos recorridos por segundo hace Rust con 8 hilos y cuántos pasos por segundo hace la placa de video entrenando; con eso calcula K para el tiempo por iteración que quieras. También deja escritos los tres archivos de configuración (`smoke`: 1 minuto; `short`: 30 minutos; `overnight`: 8 a 10 horas), con un test que verifica que todos se pueden leer y que los buffers de la noche entran en la memoria de WSL.

**Files:**
- Create: `train/scripts/bench_traversal.py`, `train/configs/smoke.toml`, `train/configs/short.toml`, `train/configs/overnight.toml`
- Test: `train/tests/test_configs_shipped.py`
- Modify: `docs/benchmarks.md` (agregar al final)

**Interfaces:**
- Consumes: `DeepCfr`, `unpack`, `load_checkpoint`, `train_advantage`, `Config`, `traverse_batch`.
- Produces: script `python scripts/bench_traversal.py [--hidden H] [--n-hidden N] [--threads T] [--k K] [--batch-size B] [--adv-steps S] [--device D] [--target-iter-seconds X] [--checkpoint RUN_DIR]` que imprime recorridos/s, nodos por recorrido, muestras por recorrido, pasos/s de entrenamiento, el K recomendado y una config sugerida. Tres configs válidas.

- [ ] **Step 1: Escribir el test que falla**

`train/tests/test_configs_shipped.py`:
```python
"""Los archivos de `configs/` que se entregan tienen que ser válidos."""
from pathlib import Path

import pytest

from truco_train.config import Config

CONFIGS = sorted((Path(__file__).resolve().parent.parent / "configs").glob("*.toml"))


def test_the_three_shipped_configs_exist():
    assert {p.stem for p in CONFIGS} == {"smoke", "short", "overnight"}


@pytest.mark.parametrize("path", CONFIGS, ids=lambda p: p.stem)
def test_every_shipped_config_parses_and_validates(path):
    cfg = Config.from_toml(path)
    assert cfg.game == "truco"
    assert cfg.traversals >= 1000


def test_overnight_fits_in_the_wsl_memory_budget():
    cfg = Config.from_toml(next(p for p in CONFIGS if p.stem == "overnight"))
    # u8 (304) + f32 (12 * 4) + u16 + i32 por muestra; la estrategia usa lo mismo.
    per_sample = 304 + 12 * 4 + 2 + 4
    gb = (2 * cfg.adv_capacity + cfg.strat_capacity) * per_sample / 1e9
    assert gb < 8.0, f"los buffers ocupan {gb:.1f} GB"
```

- [ ] **Step 2: Correr y ver que falla**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_configs_shipped.py -q 2>&1 | tail -6'`
Expected: falla `assert {...} == {"smoke", "short", "overnight"}` (la carpeta `configs/` no existe todavía) y los otros casos no se generan.

- [ ] **Step 3: Crear las configuraciones y el script**

`train/configs/smoke.toml`:
```toml
# Prueba de humo en la GPU (~1 minuto): verifica que todo el circuito anda con la red real.
game = "truco"
seed = 1
iterations = 3
traversals = 1000
threads = 8
hidden = 128
n_hidden = 3
adv_capacity = 500_000
strat_capacity = 1_000_000
adv_steps = 300
strat_steps = 1000
eval_every = 1
eval_pairs = 50
checkpoint_every = 1
final_pairs = 100
device = "cuda"
```

`train/configs/short.toml`:
```toml
# Corrida corta (~30 minutos). K y la red salen de scripts/bench_traversal.py (ver Tarea 9).
game = "truco"
seed = 1
iterations = 120
traversals = 5_000
threads = 8
hidden = 128
n_hidden = 3
adv_capacity = 2_000_000
strat_capacity = 4_000_000
adv_steps = 1_000
batch_size = 4_096
lr = 0.001
adv_scale = 10.0
warm_start = true
strat_steps = 10_000
eval_every = 5
eval_pairs = 200
checkpoint_every = 25
compress_checkpoints = false
final_pairs = 500
time_budget_s = 1800
device = "cuda"
```

`train/configs/overnight.toml`:
```toml
# Corrida larga (8-10 horas, de noche). Ajustar K con scripts/bench_traversal.py --checkpoint.
game = "truco"
seed = 2
iterations = 600
traversals = 5_000
threads = 8
hidden = 256
n_hidden = 3
adv_capacity = 4_000_000
strat_capacity = 8_000_000
adv_steps = 2_000
batch_size = 4_096
lr = 0.001
adv_scale = 10.0
warm_start = true
strat_steps = 30_000
eval_every = 10
eval_pairs = 200
checkpoint_every = 50
compress_checkpoints = true
final_pairs = 1_000
time_budget_s = 32_400
device = "cuda"
```

`train/scripts/bench_traversal.py`:
```python
"""Mide la velocidad real de los recorridos (Rust, 8 hilos) y del entrenamiento (GPU) en truco
completo, y recomienda `traversals` (K) para un tiempo de iteración objetivo.

    uv run --no-sync python scripts/bench_traversal.py --hidden 256 --threads 8 --k 2000
    uv run --no-sync python scripts/bench_traversal.py --checkpoint runs/<id>   # con redes entrenadas

Con redes recién inicializadas los recorridos son más rápidos o más lentos que con redes
entrenadas (cambia cuántas jugadas se exploran): repetir con `--checkpoint` cuando haya uno.
"""
from __future__ import annotations

import argparse
import dataclasses
import time
from pathlib import Path

import truco_engine_py as eng

from truco_train.buffers import ReservoirBuffer
from truco_train.checkpoint import load_checkpoint
from truco_train.config import Config
from truco_train.deepcfr import DeepCfr, unpack
from truco_train.training import train_advantage


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--n-hidden", type=int, default=3)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--k", type=int, default=2000, help="recorridos a medir")
    ap.add_argument("--batch-size", type=int, default=4096)
    ap.add_argument("--adv-steps", type=int, default=2000)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--target-iter-seconds", type=float, default=40.0)
    ap.add_argument("--checkpoint", type=Path, default=None, help="carpeta de una corrida")
    args = ap.parse_args()

    cfg = Config.from_dict(dict(
        hidden=args.hidden, n_hidden=args.n_hidden, threads=args.threads,
        batch_size=args.batch_size, adv_steps=args.adv_steps, device=args.device,
    ))
    if args.checkpoint:
        dcfr = load_checkpoint(args.checkpoint, Config.from_json((args.checkpoint / "config.json").read_text()))
        cfg = dcfr.cfg
        nets = dcfr.net_bytes
        origin = f"redes del checkpoint (iteración {dcfr.iteration})"
    else:
        dcfr = DeepCfr(cfg)
        nets = [n.to_bytes() for n in dcfr.adv_nets]
        origin = "redes recién inicializadas"

    eng.traverse_batch("truco", 0, 1, 0, args.threads * 4, nets[0], nets[1], args.threads)  # calentar
    t0 = time.perf_counter()
    batch = eng.traverse_batch("truco", 0, 2, 0, args.k, nets[0], nets[1], args.threads)
    secs = time.perf_counter() - t0
    adv, strat, nodes = unpack(batch, dcfr.enc_size, dcfr.n_actions)

    trav_per_s = args.k / secs
    print(f"Recorridos ({origin}, red {cfg.n_hidden}x{cfg.hidden}, {args.threads} hilos):")
    print(f"  {trav_per_s:,.0f} recorridos/s  ({secs:.1f} s para {args.k})")
    print(f"  {nodes / args.k:.0f} nodos de decisión por recorrido, "
          f"{secs * args.threads * 1e6 / nodes:.1f} µs por nodo y por hilo")
    print(f"  {len(adv[2]) / args.k:.1f} muestras de ventaja y {len(strat[2]) / args.k:.1f} de estrategia por recorrido")

    buf = ReservoirBuffer(max(len(adv[2]), 1), dcfr.enc_size, dcfr.n_actions, dcfr.rng)
    buf.add(*adv, 1)
    net = dcfr._new_net().to(dcfr.device)
    train_advantage(net, buf, steps=5, batch_size=cfg.batch_size, lr=cfg.lr, grad_clip=cfg.grad_clip,
                    adv_scale=cfg.adv_scale, seed=0)  # calentar la GPU
    t0 = time.perf_counter()
    train_advantage(net, buf, steps=cfg.adv_steps, batch_size=cfg.batch_size, lr=cfg.lr,
                    grad_clip=cfg.grad_clip, adv_scale=cfg.adv_scale, seed=0)
    train_s = time.perf_counter() - t0
    print(f"Entrenamiento: {cfg.adv_steps} pasos de {cfg.batch_size} en {train_s:.1f} s "
          f"({cfg.adv_steps / train_s:,.0f} pasos/s)")

    k_target = max(100, int(trav_per_s * (args.target_iter_seconds - 2 * train_s) / 2))
    adv_per_iter = len(adv[2]) / args.k * k_target
    print(f"Para una iteración de ~{args.target_iter_seconds:.0f} s (2 jugadores):")
    print(f"  traversals (K) = {k_target:,}")
    print(f"  el buffer de ventajas ({cfg.adv_capacity:,}) se llena en {cfg.adv_capacity / adv_per_iter:.1f} iteraciones")
    print(f"  iteraciones en 30 min: {1800 / args.target_iter_seconds:.0f}; en 9 h: {32400 / args.target_iter_seconds:.0f}")
    print("config sugerida: " + str(dataclasses.asdict(dataclasses.replace(cfg, traversals=k_target))))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_configs_shipped.py -q 2>&1 | tail -6'`
Expected: `5 passed`.

- [ ] **Step 5: Medir con redes recién inicializadas (referencia, no definitiva)**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python scripts/bench_traversal.py --hidden 256 --k 2000 2>&1 | tail -12'`
Expected (valores medidos al planificar en esta máquina; los tuyos deberían estar dentro de ±30 %):
```
Recorridos (redes recién inicializadas, red 3x256, 8 hilos):
  1,516 recorridos/s  (1.3 s para 2000)
  59 nodos de decisión por recorrido, 89.8 µs por nodo y por hilo
  15.7 muestras de ventaja y 43.1 de estrategia por recorrido
Entrenamiento: 2000 pasos de 4096 en 3.1 s (640 pasos/s)
```
Con `--hidden 128`: ~1 980 recorridos/s, 134 nodos por recorrido, 30 µs por nodo. Estos números **no sirven para elegir K** porque una red sin entrenar juega partidas cortas (pocas ramas); el valor real se mide en la Tarea 10 con `--checkpoint`.

- [ ] **Step 6: Anotar las mediciones en `docs/benchmarks.md`**

Agregar al final del archivo (usar el editor, o `cat >> docs/benchmarks.md` con este texto):
```markdown

## Mediciones reales de Deep CFR (Plan 2)

Redes recién inicializadas, 8 hilos, truco completo (`train/scripts/bench_traversal.py`):

| Red | Recorridos/s | Nodos por recorrido | µs por nodo y por hilo |
|-----|--------------|---------------------|------------------------|
| 3×128 | 1 979 | 134 | 30 |
| 3×256 | 1 516 | 59 | 90 |

Entrenamiento en la GPU: ~640 pasos/s con lotes de 4 096 (3×128 y 3×256 por igual: lo limita el lanzamiento de kernels, no la aritmética).

Con redes ya entrenadas (3×128, corrida corta de 22 iteraciones) los recorridos son más largos y la velocidad baja a ~600 recorridos/s: **la estimación de la sección anterior (2 470 y 795) es optimista**. Fórmula para elegir K (recorridos por jugador y por iteración):

`K = recorridos_por_s × (segundos_por_iteración − 2 × segundos_de_entrenamiento) / 2`

Volver a medir con `scripts/bench_traversal.py --checkpoint runs/<id>` cuando exista una corrida corta.
```

- [ ] **Step 7: Commit**

```bash
git add train/scripts train/configs train/tests/test_configs_shipped.py docs/benchmarks.md
git commit -m "feat(train): traversal benchmark, shipped run configs and measurements" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Ejecución — prueba de humo en la GPU y corrida corta de 30 minutos

**En criollo:** esta tarea no escribe código: es *correr* lo construido, mirar si la IA aprende de verdad y decidir los parámetros de la noche con datos reales. Primero la prueba de humo (1 minuto) para comprobar que la placa de video y todo el circuito andan. Después la corrida corta de 30 minutos: tenés que ver que la IA le va ganando cada vez más al bot al azar y que le empieza a pelear al heurístico (el bot "tonto pero razonable" del Plan 1). Con los resultados se vuelve a medir la velocidad con redes entrenadas, se recalcula K y se elige el tamaño de red para la noche. Si algo no anda, la tabla de síntomas dice qué botón tocar.

**Files:**
- Modify (si hace falta): `train/configs/overnight.toml`, `docs/benchmarks.md`
- Create (no se commitea): `train/runs/smoke-*/`, `train/runs/short-1/`

**Interfaces:**
- Consumes: todo lo anterior; la GPU.
- Produces: una corrida corta con `strategy.tcfrw`, `metrics.jsonl` y `final.json`; los parámetros definitivos de `configs/overnight.toml`.

- [ ] **Step 1: Prueba de humo (~30 s a 1 min)**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python scripts/check_gpu.py 2>&1 | tail -4'`
Expected: nombra la RTX 5070 Ti y dice que CUDA está disponible. Si dice que no: `uv sync` otra vez (instala torch con el índice cu128) y revisar `nvidia-smi` dentro de WSL.

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python -m truco_train run --config configs/smoke.toml --run-id smoke-1 2>&1 | tail -12'`
Expected: 3 líneas de iteración y al final una línea `listo: {...}` con `strategy_sha256`, `vs_heuristic` y `vs_random` (el azar debería rondar 60-90 %, el heurístico 15-45 %: son solo 3 iteraciones). Tarda unos 30 segundos (medido: 28 s).

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && ls -la runs/smoke-1 && uv run --no-sync python -m truco_train report runs/smoke-1 --out runs/smoke-1/report.md 2>&1 | tail -3'`
Expected: carpeta con `config.json`, `config.toml`, `metrics.jsonl`, `checkpoint/`, `strategy.tcfrw` (unos 295 KB con la red 3×128), `final.json`, `report.md`.

- [ ] **Step 2: Lanzar la corrida corta (30 minutos) en segundo plano**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && nohup uv run --no-sync python -m truco_train run --config configs/short.toml --run-id short-1 > runs-short-1.log 2>&1 &'`
(El `nohup` y el `&` la dejan corriendo aunque se cierre la terminal. `time_budget_s = 1800` la corta sola a los 30 minutos: con unos 20 s por iteración, caen unas 85-90 iteraciones, menos que las 120 configuradas.)

Para mirar el avance, cuando quieras:
`wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && tail -n 3 runs/short-1/metrics.jsonl'`

- [ ] **Step 3: Qué tiene que pasar (criterios de aceptación)**

Los valores medidos al planificar, corriendo esta misma configuración 7 minutos (iteraciones 3 a 22), fueron (política actual de regret matching, 200 pares = 400 partidos por medición):

| Iteración | vs azar | vs heurístico |
|-----------|---------|---------------|
| 3 | 88 % | 34 % |
| 6 | 92 % | 46 % |
| 9 | 86-92 % | 49 % |
| 12-18 | 86-88 % | 43-44 % |

Y la red de estrategia final tras 22 iteraciones (1 000 partidos): **83 % contra el azar, 41,5 % contra el heurístico**. Criterios para considerar la corrida corta sana:

1. Sin `NaN`: `grep -ci nan runs/short-1/metrics.jsonl` da 0.
2. Contra el azar, la tasa de victorias supera 80 % desde la iteración 10 y no cae por debajo de 75 %.
3. Contra el heurístico, supera 35 % de forma sostenida (la meseta de 43-49 % de la prueba es normal: el heurístico es fuerte y el truco tiene mucha suerte; el objetivo de la noche es pasar de ahí).
4. La pérdida de ventajas por jugador (`adv_loss` en `metrics.jsonl`) no explota: no debe crecer más de 10 veces entre iteraciones consecutivas.
5. El tiempo por iteración es estable (la primera es más rápida porque las redes están sin entrenar; después se estabiliza en torno a 17-23 s).
6. `final.json` trae `vs_heuristic` y `vs_random` con el intervalo de Wilson, y la red de estrategia es comparable a la política actual (no más de ~8 puntos peor contra el heurístico).

- [ ] **Step 4: Diagnóstico si algo no cumple**

| Síntoma | Causa probable | Qué tocar |
|---------|----------------|-----------|
| Contra el azar no pasa de 60 % | Los buffers no se llenan con datos útiles o la pérdida no baja | subir `adv_steps` (1 000 → 2 000) y `traversals`; revisar que `adv_loss` baje dentro de cada iteración |
| Contra el heurístico se estanca por debajo de 30 % | muy pocos datos por iteración, o red chica | subir `traversals` a 8 000; probar `hidden = 256` |
| `adv_loss` salta o aparece `nan` | learning rate alto o escala mala | bajar `lr` a 0,0005; probar `adv_scale = 20` |
| La estrategia final juega peor que la política actual | la red de estrategia está sub-entrenada | subir `strat_steps` (10 000 → 30 000) |
| La política actual se vuelve peor con las iteraciones (baja de 49 % a 40 %) | ruido de ajuste de la red; los pesos de las primeras iteraciones dominan o el buffer cambia demasiado | `warm_start = false` o más `adv_steps`; es normal ver ±5 puntos de oscilación |
| Una iteración tarda el doble de lo medido | otra cosa usa la CPU o la GPU | cerrar otros programas; `nvidia-smi`; `threads = 8` |
| Se queda sin memoria (`Killed`) | el límite de RAM de WSL | ver `.wslconfig` en la Tarea 11 o bajar `adv_capacity`/`strat_capacity` |

Cuando se cambia un parámetro hay que relanzar la corrida corta con otro `--run-id` (`short-2`): las corridas son baratas.

- [ ] **Step 5: Medir velocidad con las redes entrenadas y decidir K y el tamaño de red**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python scripts/bench_traversal.py --checkpoint runs/short-1 --k 2000 --target-iter-seconds 55 2>&1 | tail -14'`
Expected (aproximado, con una 3×128 entrenada): ~600-770 recorridos/s, más de 130 nodos por recorrido.

Para decidir la red de la noche (`3×256` o `3×128`): repetir con redes de 256 no es posible sin una corrida de 256 entrenada, así que se usa la regla medida: los nodos por recorrido de una red entrenada rondan 3 veces los de una recién iniciada y el costo por nodo de la 3×256 es 3 veces el de la 3×128 (90 µs contra 30 µs). Estimación para la 3×256 entrenada: unos 200-250 recorridos/s, y con K = 5 000 por jugador una iteración dura unos 55 s (≈ 2 × 5 000 / 220 + 2 × 3 s de entrenamiento), o sea unas 590 iteraciones en 9 horas.

Regla de decisión, con `T = recorridos/s` medidos con `--checkpoint` y 55 s de iteración objetivo:
- Si una 3×256 entrenada hace **150 recorridos/s o más** (correr una corrida corta de 5 minutos con `hidden = 256`, `--run-id probe-256`, y medir con `--checkpoint runs/probe-256`): dejar `hidden = 256` en `overnight.toml`.
- Si hace menos de 150: poner `hidden = 128` y subir K con la fórmula `K = T × (55 − 2 × 3,5) / 2` (con T ≈ 650, K ≈ 15 000 por jugador; aun así no pasar de 10 000: más datos por iteración con pocas iteraciones aprende peor que más iteraciones).

En ambos casos `iterations` = (32 400 s) / (segundos por iteración medidos), redondeado hacia abajo. El tiempo total manda: `time_budget_s = 32400` (9 h) corta la corrida aunque falten iteraciones.

- [ ] **Step 6: Ajustar `overnight.toml` (solo si cambió algo)**

Editar `train/configs/overnight.toml` con los valores decididos y correr el test de configs:

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_configs_shipped.py -q 2>&1 | tail -4'`
Expected: `5 passed`.

Anotar en `docs/benchmarks.md` las velocidades con redes entrenadas medidas y el K elegido (tres líneas).

- [ ] **Step 7: Commit**

```bash
git add train/configs docs/benchmarks.md
git commit -m "chore(train): tune overnight config from the 30-minute run measurements" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
(Si no hubo cambios: `git status` y no hay nada que commitear; seguir con la Tarea 11.)

---

### Task 11: La corrida de toda la noche, el informe y la verificación final

**En criollo:** esta es la tarea que produce el bot de verdad. Se lanza antes de dormir, corre unas 9 horas sola, y por la mañana hay que mirar si salió bien. Si se corta la luz o se cae algo, `resume` la retoma desde el último checkpoint sin perder lo hecho. Al final se genera el informe en Markdown (`docs/training-report.md`) con las curvas y los números, que es lo que se muestra como "resultado" del proyecto. Los *pesos* del bot (`strategy.tcfrw`) no se suben al repositorio todavía: eso lo decide el Plan 4/5 (publicación en Hugging Face y la web).

**Files:**
- Create: `docs/training-report.md` (generado por el comando `report`)
- No se commitea: `train/runs/`, `*.tcfrw` (ya están en `.gitignore`)

**Interfaces:**
- Consumes: la configuración `configs/overnight.toml` decidida en la Tarea 10.
- Produces: `train/runs/overnight-1/{strategy.tcfrw, metrics.jsonl, final.json, checkpoint/}` y `docs/training-report.md`.

- [ ] **Step 1: Chequeos previos (2 minutos)**

1. Espacio en disco: `wsl -d Ubuntu --exec bash -lc 'df -h ~ | tail -2'`. Hacen falta al menos 15 GB libres (con `compress_checkpoints = true` el checkpoint ronda 2-4 GB; se guarda uno solo, y el anterior se borra recién después de escribir el nuevo, así que por un momento hay dos).
2. Memoria: `wsl -d Ubuntu --exec bash -lc 'free -g | head -2'`. Los buffers de la noche (4 M + 4 M ventajas y 8 M de estrategia, ~370 bytes por muestra) ocupan ~6 GB, más ~3 GB de CUDA y torch: con 15 GB visibles entra, pero sin margen para hacer otras cosas pesadas. Para dar margen, crear `C:\Users\tomzv\.wslconfig`:
   ```
   [wsl2]
   memory=24GB
   ```
   y reiniciar WSL (`wsl --shutdown`, a mano, con nada importante abierto dentro).
3. La placa: `wsl -d Ubuntu --exec bash -lc 'nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv'` con casi nada usado.
4. Suspensión: desactivar la suspensión de Windows y cerrar los programas pesados (navegador con muchas pestañas, juegos).
5. La suite de tests de Python al día, archivo por archivo (el rápido): `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_resume.py -q 2>&1 | tail -4'` → `6 passed`.

- [ ] **Step 2: Lanzar**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && nohup uv run --no-sync python -m truco_train run --config configs/overnight.toml --run-id overnight-1 > runs-overnight-1.log 2>&1 &'`
Expected: vuelve enseguida. A los 2 minutos: `tail -n 3 runs-overnight-1.log` muestra la primera iteración (la primera iteración dura menos que las siguientes).

- [ ] **Step 3: Controlar durante la corrida (cuando quieras, sin apuro)**

- Avance: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && tail -n 2 runs/overnight-1/metrics.jsonl'`
- La corrida está viva: `wsl -d Ubuntu --exec bash -lc 'pgrep -af truco_train | head -2; nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv'`
- Memoria: `wsl -d Ubuntu --exec bash -lc 'free -g | head -2'` (el uso crece hasta que los buffers se llenan, unas decenas de iteraciones, y después queda fijo; si se acerca al límite de WSL, cortar con Ctrl-C, que guarda un checkpoint, subir el límite y usar `resume`).
- Qué esperar: la tasa contra el azar debería estabilizarse en 85-95 % y contra el heurístico subir por encima de la meseta de la corrida corta (43-49 %). Si a las 2 horas (≈ 130 iteraciones) la tasa contra el heurístico está por debajo del 40 %, vale la pena parar y revisar la tabla de síntomas de la Tarea 10.
- Es normal que un checkpoint comprimido tarde 1-3 minutos. Si tarda más de 3, poner `compress_checkpoints = false` y reanudar (`resume` lee el `config.json` guardado en la corrida; ver el Step siguiente para cambiar una config).

- [ ] **Step 4: Si se corta (luz, reinicio, Ctrl-C, OOM)**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && nohup uv run --no-sync python -m truco_train resume runs/overnight-1 > runs-overnight-1-resume.log 2>&1 &'`
Expected: imprime `retomando overnight-1 desde la iteración N` y sigue. Lo que se pierde es, como mucho, el trabajo desde el último checkpoint (`checkpoint_every = 50` iteraciones ≈ 45 minutos). Detalles:
- El presupuesto de tiempo (`time_budget_s`) se cuenta de nuevo en cada invocación, así que tras un corte la corrida puede pasar de 9 horas. Para fijar el final, pasar `--iterations N` (el total de iteraciones deseado) a `resume`.
- Si el checkpoint quedó a medio escribir por el corte, no hay problema: el guardado es atómico, queda el anterior.
- Si la corrida terminó sola (`final.json` existe), no hace falta nada.

- [ ] **Step 5: Verificar el resultado final**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && cat runs/overnight-1/final.json && ls -la runs/overnight-1/strategy.tcfrw'`
Expected: `final.json` con `iterations` cercano al objetivo, `vs_heuristic` y `vs_random` de 1 000 partidos con el intervalo de Wilson, y `strategy.tcfrw` de ~1,1 MB para una 3×256 (~295 KB para la 3×128).

Criterios de éxito del spec para el truco (los de Kuhn y MiniTruco ya los verifican los tests de la Tarea 7): la red de estrategia le gana al azar con claridad (más de 85 %) y se mide contra el heurístico con intervalo de confianza. Si le gana al heurístico (límite inferior del intervalo > 50 %) es un gran resultado; si queda entre 40 y 50 %, se reporta tal cual en el informe: es información valiosa, no un fracaso.

Verificar que Rust carga el archivo (el mismo formato que usará la web):

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python -c "import truco_engine_py as e, pathlib; d=pathlib.Path(\"runs/overnight-1/strategy.tcfrw\").read_bytes(); print(len(e.mlp_forward(d, bytes(304))) // 4, \"salidas\")"'`
Expected: `12 salidas`.

- [ ] **Step 6: Generar el informe**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync python -m truco_train report runs/overnight-1 --out ../docs/training-report.md 2>&1 | tail -3'`
Expected: escribe `docs/training-report.md`. Abrirlo, leerlo, y completar a mano (en lenguaje simple) las dos o tres frases de la sección de "Observaciones" si el informe las deja vacías.

- [ ] **Step 7: Verificación final de todo el trabajo de este plan**

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo fmt --check && echo FMT_OK && cargo clippy --all-targets -- -D warnings 2>&1 | tail -3 && cargo clippy -p truco-engine-py --all-targets -- -D warnings 2>&1 | tail -3'`
Expected: `FMT_OK` y sin avisos.

Run: `wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr && cargo test -p truco-engine --release --test policy --test traversal --test mlp_agent 2>&1 | tail -8'`
Expected: `11 passed`, `6 passed` y `3 passed` (más los del Plan 1: `cargo test -p truco-engine --release` completo, una vez, debe seguir pasando).

Python, un archivo por vez, cada uno con su `| tail -6`: `test_config.py` (9), `test_weights.py` (4), `test_buffers.py` (8), `test_training.py` (11), `test_engine_bridge.py` (10), `test_engine_bridge_nets.py` (5), `test_parity.py` (3), `test_deepcfr_convergence.py` (2), `test_smoke_truco.py` (3), `test_resume.py` (6), `test_report.py` (3), `test_configs_shipped.py` (5), `test_engine_import.py` (2). Ejemplo:
`wsl -d Ubuntu --exec bash -lc 'cd ~/projects/truco-cfr/train && uv run --no-sync pytest tests/test_parity.py -q 2>&1 | tail -6'` → `3 passed`.

- [ ] **Step 8: Commit del informe**

```bash
git add docs/training-report.md
git commit -m "docs: training report of the overnight Deep CFR run" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Los pesos (`strategy.tcfrw`) **no** se commitean (`*.tcfrw` está en `.gitignore`); guardar una copia de `train/runs/overnight-1/` aparte hasta que el Plan 4/5 defina dónde se publica.

---

## Self-review

**Cobertura del spec (§3.2 y §4).**
- Paso 1 (recorridos de muestreo externo, redes de ventajas por jugador, uniforme si falta la red): Tareas 1, 2 y 7.
- Paso 2 (buffers de reservorio, ponderación lineal por iteración, MSE enmascarado ponderado, re-entrenamiento con arranque en caliente por defecto): Tareas 5, 6 y 7 (`warm_start` en `Config`; `warm_start = false` entrena desde cero).
- Paso 3 (red de estrategia promedio, entropía cruzada ponderada sobre softmax enmascarado): Tareas 6 y 7 (`train_strategy_net`) y 8 (`finalize`).
- Paso 4 / artefacto final (`strategy.tcfrw` en formato TCFRW1 con entrada u8 × feature_scale): Tareas 5 (escritor byte a byte contra `docs/weights-format.md`), 7 (paridad PyTorch-Rust < 1e-4) y 8.
- Puntajes iniciales (30 % en 0-0, 70 % uniforme en [0, 29]²): ya los hace `TrucoGame::sample_chance` del Plan 1; la Tarea 2 lo verifica con `truco_start_scores_follow_the_training_distribution`.
- Checkpoints (pesos, buffers comprimidos, estado del azar, iteración) y `resume`: Tarea 8, con test de determinismo de la reanudación.
- Monitoreo cada N iteraciones a `metrics.jsonl`: Tarea 8 (`monitor.py`).
- Validación 1 a 4 (Kuhn < 0,01; MiniTruco decreciente; humo de truco de 2 iteraciones; paridad): Tareas 7 y 8 como tests automáticos. Desvío del spec §4: se descarta ONNX (ver "Decisiones tomadas al planificar").
- Medición de rendimiento y configuraciones corta y de la noche: Tareas 9, 10 y 11.

**Búsqueda de placeholders.** El documento se revisó buscando "TBD", "TODO", "similar a la Tarea", "etc." en pasos de código y marcadores de inclusión sin expandir: ninguno queda. Todos los pasos de código llevan el código completo; los valores medidos al planificar están anotados como tales.

**Consistencia de tipos y nombres.** `Probs = [f32; 12]`, `PolicyKind`, `SampleBlock`, `TraversalOutput`, `MlpAgent`, `net_exploitability` se definen en las Tareas 1 a 3 y se consumen sin renombrar en la Tarea 4; `traverse_batch` devuelve siete valores en el orden `(adv_enc, adv_regrets, adv_masks, strat_enc, strat_probs, strat_masks, nodes)`, que `unpack` (Tarea 7) y los tests desempaquetan igual. `Config` tiene los mismos 24 campos en `config.py`, en los `.toml` y en `helpers.py`. `net_bytes` es siempre `list[bytes | None]` de largo 2.

**Review Focus.** Cada ítem tiene su test en la tarea dueña: (1) salidas ilegales o `NaN` de la política: Tarea 1 (`regret_matching_*`, `masked_softmax_*`); (2) acción ilegal desde Python: Tarea 4 (`test_hand_rejects_illegal_actions_and_keeps_its_state`); (3) muestras del jugador equivocado: Tarea 2 (`kuhn_samples_belong_to_the_right_player` y los arrepentimientos calculados a mano de Kuhn); (4) sesgo del reservorio: Tarea 5 (`test_buffers.py`, uniformidad del reservorio sobre todo el flujo); (5) reanudación y checkpoint atómico: Tarea 8 (`test_resume.py`).
