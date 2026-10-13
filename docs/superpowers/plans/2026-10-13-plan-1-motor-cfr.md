# Plan 1 — Motor de truco y CFR base: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir en Rust el motor de truco 1 contra 1 (reglas completas sin flor, a 30) y validar CFR en juegos chicos, dejando listo todo lo que necesita el entrenamiento con Deep CFR (Plan 2).

**Architecture:** Crate `truco-engine` dentro de un workspace Cargo. Un trait `Game` común (con `ExactGame` para juegos chicos que se pueden recorrer enteros) lo implementan Kuhn, MiniTruco y Truco. CFR tabular y el cálculo exacto de explotabilidad son genéricos sobre el trait. El truco expone una `Observation` (lo que ve cada jugador), una codificación de 304 bytes para la red, agentes simples, un `MatchRunner` de partidos a 30 y un MLP (solo el forward) que lee pesos exportados desde Python.

**Tech Stack:** Rust stable (edition 2021) con `rand 0.8`; Python 3.12 + uv + PyTorch (CUDA 12.8), solo para verificar la GPU en este plan. Todo dentro de WSL Ubuntu.

**Spec:** `docs/superpowers/specs/2026-10-13-truco-cfr-design.md`

## Global Constraints

- Todo comando corre en WSL Ubuntu, dentro de `~/projects/truco-cfr`. Desde Windows: `wsl -d Ubuntu -- bash -lc 'cd ~/projects/truco-cfr && <comando>'`.
- Rust stable, edition 2021. La única dependencia del motor es `rand = { version = "0.8", features = ["small_rng"] }`.
- Python `>=3.12,<3.13` con uv. `torch>=2.7` desde el índice `https://download.pytorch.org/whl/cu128`, obligatorio para la RTX 5070 Ti (Blackwell).
- **Índices de acciones fijos (0..11), compartidos con la web:** `jugar0, jugar1, jugar2, envido, realEnvido, faltaEnvido, truco, retruco, valeCuatro, quiero, noQuiero, mazo`.
- Reglas: exactamente las de la sección 2 del spec, con las precisiones de abajo.
- `ENCODING_SIZE` del truco = 304; las features son `u8` y se multiplican por `feature_scale()` antes de entrar a la red.
- Formato de pesos `TCFRW1` (Tarea 12): es el contrato con el Plan 2 (Python) y el Plan 4 (WASM).
- Commits con mensajes convencionales y la línea final `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Los identificadores de código van en inglés, salvo los términos del dominio (envido, baza, mano, truco). Los comentarios y mensajes de error, en español.

## Precisiones respecto del spec (decisiones tomadas al planificar)

1. **Falta envido aceptada:** vale solo la falta; no se le suman los cantos previos. Si se rechaza, se aplica la regla general ("la suma de lo aceptado antes del último canto").
2. **No hay mazo mientras hay un canto pendiente** (truco o envido): primero se responde.
3. **Después de una baza parda**, empieza la siguiente el mano.
4. **"Carta alta" en el heurístico** = un 3 o mejor (jerarquía ≥ 10: treses, 7 de oro, 7 de espada, ancho de basto, ancho de espada). El spec decía "las 6 más altas", que es ambiguo porque los treses empatan entre sí.
5. **Heurístico cuando abre la baza:** en la primera baza juega su carta más baja; en las siguientes, la más alta.
6. **Pruebas de propiedades:** en vez de la librería `proptest`, se usan bucles deterministas con miles de semillas. Logran lo mismo sin agregar una dependencia.

## Review Focus

1. **Fuga de información:** la codificación de un jugador no puede depender de las cartas no jugadas del rival. Si lo hiciera, el bot "haría trampa" en el entrenamiento y jugaría mal de verdad. → Test `encoding_does_not_leak_opponent_hand` (Tarea 9).
2. **Llegar a 30 en mitad de una mano** (por ejemplo, con el envido mientras hay un truco pendiente): la mano termina en el acto y no queda ninguna acción legal. → Test `envido_reaching_30_ends_hand_with_truco_pending` (Tarea 8).
3. **Falta envido justo en 15:** con 15 ya se está en las buenas, así que vale 30 − 15 = 15. → Test `falta_envido_at_exactly_15_is_buenas` (Tarea 8).
4. **Cartas del mismo rango en la mano** (dos treses): el orden de los slots tiene que ser determinista para que `jugar0/1/2` signifique siempre lo mismo. → Test `equal_rank_cards_sort_by_id` (Tarea 6).
5. **Mazo o jugar carta con un canto pendiente:** tiene que ser ilegal. → Test `no_mazo_or_card_while_call_pending` (Tarea 8).

## Orden y paralelismo

```
T0 → T1 → T3 ─┬─ Pista A: T2 → T6 → T7 → T8 → T9 → T10 → T11
              ├─ Pista B: T4 → T5
              └─ Pista C: T12
                          → T13 (cuando terminan A y C)
```

Las tres pistas tocan archivos distintos. Lo único compartido es `engine/src/lib.rs`, donde cada tarea agrega una línea `pub mod`. Si las pistas corren en paralelo, cada una va en su propio worktree y se mergea al final; los conflictos en `lib.rs` son triviales.

---

### Task 0: Entorno en WSL y esqueleto del workspace

**En criollo:** instalamos las herramientas (Rust y uv), creamos la estructura vacía del proyecto y, lo más importante, verificamos que PyTorch ve tu placa de video desde WSL. Si eso falla, es mejor saberlo en el minuto 15 y no a las 11 de la noche.

**Files:**
- Create: `Cargo.toml`, `.cargo/config.toml`, `.gitignore`, `engine/Cargo.toml`, `engine/src/lib.rs`
- Create: `train/pyproject.toml`, `train/scripts/check_gpu.py`

**Interfaces:**
- Produces: crate `truco_engine` (vacío) y entorno `train/.venv` con torch + CUDA.

- [ ] **Step 1: Verificar el compilador de C** (lo necesitan Rust y algunas librerías)

Run: `wsl -d Ubuntu -- bash -lc 'which cc gcc make pkg-config'`
Expected: aparecen las 4 rutas. **Si falta alguna**, el usuario corre en la terminal (pide su contraseña de WSL): `! wsl -d Ubuntu -- sudo apt-get update && wsl -d Ubuntu -- sudo apt-get install -y build-essential pkg-config`

- [ ] **Step 2: Instalar Rust y uv**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
source ~/.cargo/env
rustup component add clippy rustfmt
rustup target add wasm32-unknown-unknown
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Run: `wsl -d Ubuntu -- bash -lc 'cargo --version && uv --version'`
Expected: muestra las dos versiones.

- [ ] **Step 3: Crear el workspace**

`Cargo.toml`:
```toml
[workspace]
resolver = "2"
members = ["engine"]

[profile.release]
debug = 1

[profile.test]
opt-level = 2
```

`.cargo/config.toml` (optimiza para el CPU de esta máquina; no afecta la compilación a WASM):
```toml
[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "target-cpu=native"]
```

`.gitignore`:
```
target/
.venv/
__pycache__/
third_party/
runs/
node_modules/
dist/
*.tcfrw
```

`engine/Cargo.toml`:
```toml
[package]
name = "truco-engine"
version = "0.1.0"
edition = "2021"
license = "MIT"

[dependencies]
rand = { version = "0.8", features = ["small_rng"] }
```

`engine/src/lib.rs`:
```rust
//! Motor de truco argentino 1 contra 1 y algoritmos CFR.
```

- [ ] **Step 4: Compilar**

Run: `cargo build -p truco-engine`
Expected: `Finished`, sin errores.

- [ ] **Step 5: Entorno Python con CUDA**

`train/pyproject.toml`:
```toml
[project]
name = "truco-train"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = ["torch>=2.7", "numpy>=2"]

[tool.uv.sources]
torch = [{ index = "pytorch-cu128" }]

[[tool.uv.index]]
name = "pytorch-cu128"
url = "https://download.pytorch.org/whl/cu128"
explicit = true
```

`train/scripts/check_gpu.py`:
```python
"""Verifica que PyTorch ve la GPU desde WSL y que puede hacer cuentas en ella."""
import torch

print(f"torch {torch.__version__}, CUDA {torch.version.cuda}")
assert torch.cuda.is_available(), "PyTorch no ve la GPU: revisar el driver de NVIDIA en Windows"
name = torch.cuda.get_device_name(0)
cap = torch.cuda.get_device_capability(0)
print(f"GPU: {name} (compute capability {cap[0]}.{cap[1]})")
a = torch.randn(4096, 4096, device="cuda")
b = a @ a
torch.cuda.synchronize()
print(f"matmul OK, suma = {b.sum().item():.2f}")
```

Run: `cd train && uv sync && uv run python scripts/check_gpu.py`
Expected: `GPU: NVIDIA GeForce RTX 5070 Ti (compute capability 12.0)` y `matmul OK`. Si falla con "no kernel image is available", la versión de torch no trae soporte para Blackwell: confirmar que se instaló desde el índice cu128 (`uv pip show torch` tiene que mostrar `+cu128`).

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml .cargo .gitignore engine train/pyproject.toml train/uv.lock train/scripts
git commit -m "chore: workspace skeleton and GPU check"
```

---

### Task 1: Cartas

**En criollo:** le enseñamos al programa qué es una carta del mazo español: su palo, su número, cuánto vale en el truco (el ancho de espada le gana a todo, los cuatros a nada) y cuánto suma para el envido. Todo lo demás se construye arriba de esto.

**Files:**
- Create: `engine/src/cards.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod cards;`)
- Test: `engine/tests/cards.rs`

**Interfaces:**
- Produces: `Suit` (`Espada|Basto|Oro|Copa`, `Suit::ALL`, `letter()`, `from_letter(char)`), `NUMBERS: [u8; 10]`, `Card` (`new(Suit, u8)`, `from_id(u8)`, `id() -> u8` en 0..40, `suit()`, `number()`, `rank() -> u8` en 1..=14, `envido_value() -> u8`, `parse(&str) -> Option<Card>` con notación `"1E"`, `"12C"`, `Display`), `full_deck() -> [Card; 40]`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/cards.rs`:
```rust
use truco_engine::cards::{full_deck, Card, Suit};

fn c(s: &str) -> Card {
    Card::parse(s).unwrap()
}

#[test]
fn deck_has_40_distinct_cards_and_roundtrips() {
    let deck = full_deck();
    let mut ids: Vec<u8> = deck.iter().map(|c| c.id()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), 40);
    for card in deck {
        assert_eq!(Card::parse(&card.to_string()), Some(card));
    }
}

#[test]
fn truco_hierarchy() {
    let order = ["1E", "1B", "7E", "7O", "3C", "2O", "1C", "12E", "11B", "10O", "7C", "6E", "5E", "4E"];
    for w in order.windows(2) {
        assert!(c(w[0]).rank() > c(w[1]).rank(), "{} debería ganarle a {}", w[0], w[1]);
    }
    assert_eq!(c("1C").rank(), c("1O").rank());
    assert_eq!(c("7C").rank(), c("7B").rank());
    assert_eq!(c("3E").rank(), c("3O").rank());
    assert_eq!(c("1E").rank(), 14);
    assert_eq!(c("4C").rank(), 1);
}

#[test]
fn envido_values() {
    assert_eq!(c("7O").envido_value(), 7);
    assert_eq!(c("1E").envido_value(), 1);
    assert_eq!(c("10C").envido_value(), 0);
    assert_eq!(c("12B").envido_value(), 0);
}

#[test]
fn parse_rejects_invalid() {
    for s in ["8E", "9O", "1X", "", "E", "13C", "1é"] {
        assert_eq!(Card::parse(s), None, "{s:?} no debería parsear");
    }
}

#[test]
fn accessors() {
    let card = Card::new(Suit::Copa, 12);
    assert_eq!(card.suit(), Suit::Copa);
    assert_eq!(card.number(), 12);
    assert_eq!(card.to_string(), "12C");
    assert_eq!(Card::from_id(card.id()), card);
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test cards`
Expected: error de compilación `unresolved import truco_engine::cards`.

- [ ] **Step 3: Implementación**

`engine/src/cards.rs`:
```rust
//! Cartas del mazo español de 40 y su jerarquía en el truco.
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Suit {
    Espada,
    Basto,
    Oro,
    Copa,
}

impl Suit {
    pub const ALL: [Suit; 4] = [Suit::Espada, Suit::Basto, Suit::Oro, Suit::Copa];

    pub fn letter(self) -> char {
        match self {
            Suit::Espada => 'E',
            Suit::Basto => 'B',
            Suit::Oro => 'O',
            Suit::Copa => 'C',
        }
    }

    pub fn from_letter(c: char) -> Option<Suit> {
        match c {
            'E' => Some(Suit::Espada),
            'B' => Some(Suit::Basto),
            'O' => Some(Suit::Oro),
            'C' => Some(Suit::Copa),
            _ => None,
        }
    }
}

/// Números del mazo de 40 (sin 8 ni 9).
pub const NUMBERS: [u8; 10] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

/// Una carta, identificada por un id de 0 a 39: `palo * 10 + posición del número en NUMBERS`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Card(u8);

impl Card {
    pub fn new(suit: Suit, number: u8) -> Card {
        let idx = NUMBERS
            .iter()
            .position(|&n| n == number)
            .unwrap_or_else(|| panic!("número de carta inválido: {number}"));
        Card(suit as u8 * 10 + idx as u8)
    }

    pub fn from_id(id: u8) -> Card {
        assert!(id < 40, "id de carta fuera de rango: {id}");
        Card(id)
    }

    pub fn id(self) -> u8 {
        self.0
    }

    pub fn suit(self) -> Suit {
        Suit::ALL[(self.0 / 10) as usize]
    }

    pub fn number(self) -> u8 {
        NUMBERS[(self.0 % 10) as usize]
    }

    /// Jerarquía del truco: 14 = ancho de espada, ..., 1 = cuatros. A mayor número, más fuerte.
    pub fn rank(self) -> u8 {
        match (self.number(), self.suit()) {
            (1, Suit::Espada) => 14,
            (1, Suit::Basto) => 13,
            (7, Suit::Espada) => 12,
            (7, Suit::Oro) => 11,
            (3, _) => 10,
            (2, _) => 9,
            (1, _) => 8,
            (12, _) => 7,
            (11, _) => 6,
            (10, _) => 5,
            (7, _) => 4,
            (6, _) => 3,
            (5, _) => 2,
            (4, _) => 1,
            (n, _) => unreachable!("número imposible: {n}"),
        }
    }

    /// Valor para el envido: las figuras (10, 11, 12) valen 0.
    pub fn envido_value(self) -> u8 {
        let n = self.number();
        if n >= 10 {
            0
        } else {
            n
        }
    }

    /// Notación corta: número + letra del palo (E, B, O, C). Ejemplos: "1E", "7O", "12C".
    pub fn parse(s: &str) -> Option<Card> {
        let suit_char = s.chars().last()?;
        let suit = Suit::from_letter(suit_char)?;
        let number: u8 = s[..s.len() - suit_char.len_utf8()].parse().ok()?;
        if !NUMBERS.contains(&number) {
            return None;
        }
        Some(Card::new(suit, number))
    }
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.number(), self.suit().letter())
    }
}

pub fn full_deck() -> [Card; 40] {
    std::array::from_fn(|i| Card(i as u8))
}
```

En `engine/src/lib.rs` agregar: `pub mod cards;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test cards`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): spanish deck cards with truco ranks"
```

---

### Task 2: Envido de una mano

**En criollo:** calculamos los tantos de una mano. Con dos cartas del mismo palo: 20 + sus valores (las figuras valen 0). Si no hay dos del mismo palo: el valor de la carta más alta.

**Files:**
- Create: `engine/src/envido.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod envido;`)
- Test: `engine/tests/envido.rs`

**Interfaces:**
- Consumes: `Card` (Tarea 1).
- Produces: `envido_points(hand: &[Card]) -> u8`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/envido.rs`:
```rust
use truco_engine::cards::Card;
use truco_engine::envido::envido_points;

fn pts(s: &str) -> u8 {
    let hand: Vec<Card> = s.split_whitespace().map(|t| Card::parse(t).unwrap()).collect();
    envido_points(&hand)
}

#[test]
fn envido_cases() {
    assert_eq!(pts("7E 6E 1C"), 33);
    assert_eq!(pts("12E 11E 4C"), 20);
    assert_eq!(pts("1O 12C 4B"), 4);
    assert_eq!(pts("7O 5O 6O"), 33, "con tres del mismo palo cuentan las dos mejores");
    assert_eq!(pts("10C 11B 12O"), 0);
    assert_eq!(pts("7C 10C 6B"), 27);
    assert_eq!(pts("3E 2B 1O"), 3);
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test envido`
Expected: error de compilación (no existe `envido`).

- [ ] **Step 3: Implementación**

`engine/src/envido.rs`:
```rust
//! Cálculo de los tantos del envido.
use crate::cards::Card;

/// Tantos de una mano: 20 + la mejor pareja del mismo palo, o la carta más alta si no hay pareja.
pub fn envido_points(hand: &[Card]) -> u8 {
    let mut best = 0;
    for i in 0..hand.len() {
        best = best.max(hand[i].envido_value());
        for j in i + 1..hand.len() {
            if hand[i].suit() == hand[j].suit() {
                best = best.max(20 + hand[i].envido_value() + hand[j].envido_value());
            }
        }
    }
    best
}
```

En `engine/src/lib.rs` agregar: `pub mod envido;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test envido`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): envido points"
```

---

### Task 3: Trait `Game` y Kuhn poker

**En criollo:** definimos la "forma" común de cualquier juego: de quién es el turno, qué jugadas son legales, qué pasa al hacer una y cuánto gana cada uno al final. Así el mismo algoritmo de aprendizaje sirve para varios juegos. El primero que implementamos es el Kuhn poker: un póker de juguete con 3 cartas cuya solución exacta se conoce. Es nuestro "examen" para saber si CFR está bien programado.

**Files:**
- Create: `engine/src/game.rs`, `engine/src/kuhn.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod game;` y `pub mod kuhn;`)
- Test: `engine/tests/kuhn.rs`

**Interfaces:**
- Produces (`game.rs`): `type Player = usize`, `type Action = usize`, `type ActionMask = u16`, `const fn bit(Action) -> ActionMask`, `fn actions_of(ActionMask) -> impl Iterator<Item = Action>`, `fn other(Player) -> Player`, `enum Node { Chance, Decision(Player), Terminal }`, `trait Game` (`NUM_ACTIONS`, `ENCODING_SIZE`, `root()`, `node()`, `sample_chance(&self, &mut dyn RngCore) -> Self`, `legal_actions()`, `apply(Action)`, `returns() -> [f32; 2]`, `encode(Player, &mut [u8])`, `feature_scale() -> Vec<f32>`), `trait ExactGame: Game` (`chance_outcomes() -> Vec<(Self, f64)>`, `infoset_key(Player) -> u64`).
- Produces (`kuhn.rs`): `Kuhn` con `Kuhn::PASS = 0`, `Kuhn::BET = 1`; `ENCODING_SIZE = 9`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/kuhn.rs`:
```rust
use truco_engine::game::{ExactGame, Game, Node};
use truco_engine::kuhn::Kuhn;

fn dealt(c0: u8, c1: u8) -> Kuhn {
    Kuhn::root()
        .chance_outcomes()
        .into_iter()
        .map(|(s, _)| s)
        .find(|s| {
            let mut a = [0u8; 9];
            let mut b = [0u8; 9];
            s.encode(0, &mut a);
            s.encode(1, &mut b);
            a[c0 as usize] == 1 && b[c1 as usize] == 1
        })
        .unwrap()
}

fn play(mut s: Kuhn, actions: &[usize]) -> Kuhn {
    for &a in actions {
        s.apply(a);
    }
    s
}

#[test]
fn root_is_chance_with_six_deals() {
    assert_eq!(Kuhn::root().node(), Node::Chance);
    let outs = Kuhn::root().chance_outcomes();
    assert_eq!(outs.len(), 6);
    let total: f64 = outs.iter().map(|(_, p)| p).sum();
    assert!((total - 1.0).abs() < 1e-12);
}

#[test]
fn payoffs() {
    // cartas: 0 = J, 1 = Q, 2 = K
    assert_eq!(play(dealt(2, 0), &[Kuhn::PASS, Kuhn::PASS]).returns(), [1.0, -1.0]);
    assert_eq!(play(dealt(0, 2), &[Kuhn::BET, Kuhn::PASS]).returns(), [1.0, -1.0]);
    assert_eq!(play(dealt(0, 2), &[Kuhn::BET, Kuhn::BET]).returns(), [-2.0, 2.0]);
    assert_eq!(play(dealt(2, 0), &[Kuhn::PASS, Kuhn::BET, Kuhn::PASS]).returns(), [-1.0, 1.0]);
    assert_eq!(play(dealt(2, 1), &[Kuhn::PASS, Kuhn::BET, Kuhn::BET]).returns(), [2.0, -2.0]);
}

#[test]
fn turns_and_terminal() {
    let s = dealt(1, 2);
    assert_eq!(s.node(), Node::Decision(0));
    let s = play(s, &[Kuhn::PASS]);
    assert_eq!(s.node(), Node::Decision(1));
    let s = play(s, &[Kuhn::BET]);
    assert_eq!(s.node(), Node::Decision(0));
    let s = play(s, &[Kuhn::PASS]);
    assert_eq!(s.node(), Node::Terminal);
}

#[test]
fn infoset_keys_hide_opponent_card() {
    assert_eq!(dealt(1, 0).infoset_key(0), dealt(1, 2).infoset_key(0));
    assert_ne!(dealt(1, 0).infoset_key(0), dealt(2, 0).infoset_key(0));
    let a = play(dealt(1, 0), &[Kuhn::PASS]);
    let b = play(dealt(2, 0), &[Kuhn::PASS]);
    assert_eq!(a.infoset_key(1), b.infoset_key(1));
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test kuhn`
Expected: error de compilación (no existen `game` ni `kuhn`).

- [ ] **Step 3: Implementación**

`engine/src/game.rs`:
```rust
//! Interfaz común a todos los juegos: Kuhn, MiniTruco y Truco.
use rand::RngCore;

pub type Player = usize;
pub type Action = usize;
/// Conjunto de acciones legales como bits: el bit `a` encendido = la acción `a` es legal.
pub type ActionMask = u16;

pub const fn bit(a: Action) -> ActionMask {
    1 << a
}

pub fn actions_of(mask: ActionMask) -> impl Iterator<Item = Action> {
    (0..16).filter(move |&a| mask & bit(a) != 0)
}

pub fn other(p: Player) -> Player {
    1 - p
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Node {
    /// Le toca al azar (repartir cartas).
    Chance,
    /// Le toca decidir a un jugador.
    Decision(Player),
    /// Terminó: se pueden leer los puntos con `returns`.
    Terminal,
}

pub trait Game: Clone + Send + Sync + 'static {
    const NUM_ACTIONS: usize;
    const ENCODING_SIZE: usize;

    fn root() -> Self;
    fn node(&self) -> Node;
    /// Resuelve un nodo de azar eligiendo un resultado al azar.
    fn sample_chance(&self, rng: &mut dyn RngCore) -> Self;
    fn legal_actions(&self) -> ActionMask;
    fn apply(&mut self, a: Action);
    /// Puntos netos de cada jugador (suma cero).
    fn returns(&self) -> [f32; 2];
    /// Lo que ve el jugador `p`, como bytes para la red neuronal (largo `ENCODING_SIZE`).
    fn encode(&self, p: Player, out: &mut [u8]);
    /// Factor por el que se multiplica cada byte de `encode` antes de entrar a la red.
    fn feature_scale() -> Vec<f32>;
}

/// Juegos lo bastante chicos para recorrerlos enteros (CFR exacto y explotabilidad exacta).
pub trait ExactGame: Game {
    fn chance_outcomes(&self) -> Vec<(Self, f64)>;
    /// Identificador de lo que sabe el jugador `p` (su "conjunto de información").
    fn infoset_key(&self, p: Player) -> u64;
}
```

`engine/src/kuhn.rs`:
```rust
//! Kuhn poker: 3 cartas (J=0, Q=1, K=2), apuesta inicial de 1, acciones pasar/apostar.
//! El valor de equilibrio para el jugador 0 es -1/18.
use crate::game::{ActionMask, ExactGame, Game, Node, Player};
use rand::{Rng, RngCore};

#[derive(Clone, Debug)]
pub struct Kuhn {
    cards: Option<[u8; 2]>,
    history: Vec<u8>,
}

const DEALS: [[u8; 2]; 6] = [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]];

impl Kuhn {
    pub const PASS: usize = 0;
    pub const BET: usize = 1;

    fn is_terminal(&self) -> bool {
        matches!(self.history.as_slice(), [0, 0] | [1, 0] | [1, 1] | [0, 1, 0] | [0, 1, 1])
    }
}

impl Game for Kuhn {
    const NUM_ACTIONS: usize = 2;
    const ENCODING_SIZE: usize = 9;

    fn root() -> Self {
        Kuhn { cards: None, history: vec![] }
    }

    fn node(&self) -> Node {
        if self.cards.is_none() {
            Node::Chance
        } else if self.is_terminal() {
            Node::Terminal
        } else {
            Node::Decision(self.history.len() % 2)
        }
    }

    fn sample_chance(&self, rng: &mut dyn RngCore) -> Self {
        Kuhn { cards: Some(DEALS[rng.gen_range(0..DEALS.len())]), history: vec![] }
    }

    fn legal_actions(&self) -> ActionMask {
        0b11
    }

    fn apply(&mut self, a: usize) {
        self.history.push(a as u8);
    }

    fn returns(&self) -> [f32; 2] {
        let c = self.cards.expect("sin repartir");
        let showdown = if c[0] > c[1] { 0 } else { 1 };
        let (winner, amount) = match self.history.as_slice() {
            [0, 0] => (showdown, 1.0),
            [1, 0] => (0, 1.0),
            [1, 1] | [0, 1, 1] => (showdown, 2.0),
            [0, 1, 0] => (1, 1.0),
            h => panic!("historia no terminal: {h:?}"),
        };
        if winner == 0 {
            [amount, -amount]
        } else {
            [-amount, amount]
        }
    }

    /// 3 bytes = carta propia (one-hot) + 2 lugares de historia × (vacío, pasar, apostar).
    fn encode(&self, p: Player, out: &mut [u8]) {
        out.fill(0);
        out[self.cards.expect("sin repartir")[p] as usize] = 1;
        for i in 0..2 {
            match self.history.get(i) {
                Some(&a) => out[3 + i * 3 + 1 + a as usize] = 1,
                None => out[3 + i * 3] = 1,
            }
        }
    }

    fn feature_scale() -> Vec<f32> {
        vec![1.0; 9]
    }
}

impl ExactGame for Kuhn {
    fn chance_outcomes(&self) -> Vec<(Self, f64)> {
        DEALS
            .iter()
            .map(|&d| (Kuhn { cards: Some(d), history: vec![] }, 1.0 / 6.0))
            .collect()
    }

    fn infoset_key(&self, p: Player) -> u64 {
        let card = self.cards.expect("sin repartir")[p] as u64;
        let bits = self.history.iter().enumerate().fold(0u64, |acc, (i, &a)| acc | ((a as u64) << i));
        card | ((self.history.len() as u64) << 2) | (bits << 4) | ((p as u64) << 63)
    }
}
```

En `engine/src/lib.rs` agregar: `pub mod game;` y `pub mod kuhn;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test kuhn`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): Game trait and Kuhn poker"
```

---

### Task 4: CFR tabular y explotabilidad exacta

**En criollo:** programamos CFR en su versión más simple, con una tabla que anota el "arrepentimiento" de cada jugada en cada situación. También programamos el **juez**: dada una forma de jugar, calcula cuánto le podría sacar el rival perfecto que la conoce. Eso es la explotabilidad: si da 0, la estrategia es inexplotable. Si en Kuhn CFR llega cerca de 0 y al valor teórico −1/18, el algoritmo está bien.

**Files:**
- Create: `engine/src/cfr.rs`, `engine/src/exact.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod cfr;` y `pub mod exact;`)
- Test: `engine/tests/kuhn_cfr.rs`

**Interfaces:**
- Consumes: `Game`, `ExactGame`, `Node`, `actions_of`, `Kuhn` (Tarea 3).
- Produces: `TabularCfr<G: ExactGame>` (`new()`, `run(iterations: u64)`, `average_strategy(&self, s: &G, p: Player) -> Vec<f64>`, `iterations() -> u64`); en `exact.rs`: `type Policy<'a, G> = &'a dyn Fn(&G, Player) -> Vec<f64>`, `best_response_value<G>(policy, br: Player) -> f64`, `exploitability<G>(policy) -> f64`, `expected_values<G>(policy) -> [f64; 2]`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/kuhn_cfr.rs`:
```rust
use truco_engine::cfr::TabularCfr;
use truco_engine::exact::{expected_values, exploitability};
use truco_engine::game::Player;
use truco_engine::kuhn::Kuhn;

#[test]
fn uniform_policy_is_exploitable() {
    let uniform = |_: &Kuhn, _: Player| vec![0.5, 0.5];
    assert!(exploitability::<Kuhn>(&uniform) > 0.1);
}

#[test]
fn cfr_converges_on_kuhn() {
    let mut cfr = TabularCfr::<Kuhn>::new();
    cfr.run(2000);
    assert_eq!(cfr.iterations(), 2000);
    let policy = |s: &Kuhn, p: Player| cfr.average_strategy(s, p);
    let expl = exploitability::<Kuhn>(&policy);
    assert!(expl < 0.01, "explotabilidad demasiado alta: {expl}");
    let v = expected_values::<Kuhn>(&policy);
    assert!((v[0] + 1.0 / 18.0).abs() < 0.01, "valor del jugador 0: {}", v[0]);
    assert!((v[0] + v[1]).abs() < 1e-9, "tiene que ser suma cero");
}

#[test]
fn exploitability_decreases_with_iterations() {
    let mut cfr = TabularCfr::<Kuhn>::new();
    cfr.run(20);
    let early = exploitability::<Kuhn>(&|s: &Kuhn, p: Player| cfr.average_strategy(s, p));
    cfr.run(980);
    let late = exploitability::<Kuhn>(&|s: &Kuhn, p: Player| cfr.average_strategy(s, p));
    assert!(late < early, "early={early} late={late}");
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test kuhn_cfr`
Expected: error de compilación (no existen `cfr` ni `exact`).

- [ ] **Step 3: Implementación**

`engine/src/cfr.rs`:
```rust
//! CFR "vainilla" con tablas, para juegos chicos (ExactGame). Actualizaciones alternadas.
use crate::game::{actions_of, ActionMask, ExactGame, Node, Player};
use std::collections::HashMap;
use std::marker::PhantomData;

pub struct TabularCfr<G: ExactGame> {
    regrets: HashMap<u64, Vec<f64>>,
    strategy_sum: HashMap<u64, Vec<f64>>,
    iterations: u64,
    _game: PhantomData<G>,
}

impl<G: ExactGame> Default for TabularCfr<G> {
    fn default() -> Self {
        Self::new()
    }
}

impl<G: ExactGame> TabularCfr<G> {
    pub fn new() -> Self {
        TabularCfr {
            regrets: HashMap::new(),
            strategy_sum: HashMap::new(),
            iterations: 0,
            _game: PhantomData,
        }
    }

    pub fn iterations(&self) -> u64 {
        self.iterations
    }

    pub fn run(&mut self, iterations: u64) {
        for _ in 0..iterations {
            for p in 0..2 {
                self.cfr(&G::root(), p, 1.0, 1.0, 1.0);
            }
            self.iterations += 1;
        }
    }

    /// Devuelve el valor esperado del nodo para el jugador `p`.
    /// `pi_p`, `pi_o`, `pi_c`: probabilidad de llegar acá por las jugadas de p, del rival y del azar.
    fn cfr(&mut self, s: &G, p: Player, pi_p: f64, pi_o: f64, pi_c: f64) -> f64 {
        match s.node() {
            Node::Terminal => s.returns()[p] as f64,
            Node::Chance => s
                .chance_outcomes()
                .into_iter()
                .map(|(c, prob)| prob * self.cfr(&c, p, pi_p, pi_o, pi_c * prob))
                .sum(),
            Node::Decision(q) => {
                let mask = s.legal_actions();
                let key = s.infoset_key(q);
                let strat = self.current_strategy(key, mask);
                let mut values = vec![0.0; G::NUM_ACTIONS];
                let mut node_value = 0.0;
                for a in actions_of(mask) {
                    let mut child = s.clone();
                    child.apply(a);
                    values[a] = if q == p {
                        self.cfr(&child, p, pi_p * strat[a], pi_o, pi_c)
                    } else {
                        self.cfr(&child, p, pi_p, pi_o * strat[a], pi_c)
                    };
                    node_value += strat[a] * values[a];
                }
                if q == p {
                    let r = self.regrets.entry(key).or_insert_with(|| vec![0.0; G::NUM_ACTIONS]);
                    for a in actions_of(mask) {
                        r[a] += pi_o * pi_c * (values[a] - node_value);
                    }
                    let ss = self.strategy_sum.entry(key).or_insert_with(|| vec![0.0; G::NUM_ACTIONS]);
                    for a in actions_of(mask) {
                        ss[a] += pi_p * strat[a];
                    }
                }
                node_value
            }
        }
    }

    /// Regret matching: proporcional al arrepentimiento positivo; uniforme si no hay ninguno.
    fn current_strategy(&self, key: u64, mask: ActionMask) -> Vec<f64> {
        let mut strat = vec![0.0; G::NUM_ACTIONS];
        if let Some(r) = self.regrets.get(&key) {
            let total: f64 = actions_of(mask).map(|a| r[a].max(0.0)).sum();
            if total > 0.0 {
                for a in actions_of(mask) {
                    strat[a] = r[a].max(0.0) / total;
                }
                return strat;
            }
        }
        uniform(mask, G::NUM_ACTIONS)
    }

    /// Estrategia promedio: la que converge al equilibrio.
    pub fn average_strategy(&self, s: &G, p: Player) -> Vec<f64> {
        let mask = s.legal_actions();
        if let Some(ss) = self.strategy_sum.get(&s.infoset_key(p)) {
            let total: f64 = actions_of(mask).map(|a| ss[a]).sum();
            if total > 0.0 {
                let mut out = vec![0.0; G::NUM_ACTIONS];
                for a in actions_of(mask) {
                    out[a] = ss[a] / total;
                }
                return out;
            }
        }
        uniform(mask, G::NUM_ACTIONS)
    }
}

fn uniform(mask: ActionMask, n: usize) -> Vec<f64> {
    let count = actions_of(mask).count() as f64;
    let mut out = vec![0.0; n];
    for a in actions_of(mask) {
        out[a] = 1.0 / count;
    }
    out
}
```

`engine/src/exact.rs`:
```rust
//! Evaluación exacta de estrategias en juegos chicos: valor esperado, mejor respuesta y explotabilidad.
use crate::game::{actions_of, Action, ExactGame, Node, Player};
use std::collections::HashMap;

pub type Policy<'a, G> = &'a dyn Fn(&G, Player) -> Vec<f64>;

/// Valor esperado de cada jugador si ambos juegan con `policy`.
pub fn expected_values<G: ExactGame>(policy: Policy<G>) -> [f64; 2] {
    ev(&G::root(), policy)
}

fn ev<G: ExactGame>(s: &G, policy: Policy<G>) -> [f64; 2] {
    match s.node() {
        Node::Terminal => {
            let r = s.returns();
            [r[0] as f64, r[1] as f64]
        }
        Node::Chance => s.chance_outcomes().iter().fold([0.0; 2], |acc, (c, p)| {
            let v = ev(c, policy);
            [acc[0] + p * v[0], acc[1] + p * v[1]]
        }),
        Node::Decision(q) => {
            let strat = policy(s, q);
            actions_of(s.legal_actions()).fold([0.0; 2], |acc, a| {
                let mut child = s.clone();
                child.apply(a);
                let v = ev(&child, policy);
                [acc[0] + strat[a] * v[0], acc[1] + strat[a] * v[1]]
            })
        }
    }
}

/// Explotabilidad = promedio de lo que gana la mejor respuesta de cada jugador contra `policy`.
/// Es 0 en un equilibrio de Nash.
pub fn exploitability<G: ExactGame>(policy: Policy<G>) -> f64 {
    (best_response_value::<G>(policy, 0) + best_response_value::<G>(policy, 1)) / 2.0
}

/// Valor que obtiene el jugador `br` jugando la mejor respuesta contra `policy`.
/// Las decisiones de `br` se fijan por conjunto de información, de los más profundos a los más superficiales.
pub fn best_response_value<G: ExactGame>(policy: Policy<G>, br: Player) -> f64 {
    let mut infosets: HashMap<u64, (usize, Vec<(G, f64)>)> = HashMap::new();
    collect(&G::root(), br, policy, 1.0, 0, &mut infosets);

    let mut order: Vec<u64> = infosets.keys().copied().collect();
    order.sort_by_key(|k| std::cmp::Reverse(infosets[k].0));

    let mut choice: HashMap<u64, Action> = HashMap::new();
    for key in order {
        let states = &infosets[&key].1;
        let mask = states[0].0.legal_actions();
        let mut best: Option<(Action, f64)> = None;
        for a in actions_of(mask) {
            let v: f64 = states
                .iter()
                .map(|(s, reach)| {
                    let mut child = s.clone();
                    child.apply(a);
                    reach * br_value(&child, br, policy, &choice)
                })
                .sum();
            if best.map_or(true, |(_, bv)| v > bv) {
                best = Some((a, v));
            }
        }
        choice.insert(key, best.expect("conjunto de información sin acciones").0);
    }
    br_value(&G::root(), br, policy, &choice)
}

/// Junta, para cada conjunto de información de `br`, sus estados y la probabilidad de llegar
/// (por azar y por el rival). `depth` = cantidad de decisiones previas de `br`.
fn collect<G: ExactGame>(
    s: &G,
    br: Player,
    policy: Policy<G>,
    reach: f64,
    depth: usize,
    out: &mut HashMap<u64, (usize, Vec<(G, f64)>)>,
) {
    match s.node() {
        Node::Terminal => {}
        Node::Chance => {
            for (c, p) in s.chance_outcomes() {
                collect(&c, br, policy, reach * p, depth, out);
            }
        }
        Node::Decision(q) if q == br => {
            out.entry(s.infoset_key(br))
                .or_insert_with(|| (depth, Vec::new()))
                .1
                .push((s.clone(), reach));
            for a in actions_of(s.legal_actions()) {
                let mut child = s.clone();
                child.apply(a);
                collect(&child, br, policy, reach, depth + 1, out);
            }
        }
        Node::Decision(q) => {
            let strat = policy(s, q);
            for a in actions_of(s.legal_actions()) {
                let mut child = s.clone();
                child.apply(a);
                collect(&child, br, policy, reach * strat[a], depth, out);
            }
        }
    }
}

fn br_value<G: ExactGame>(s: &G, br: Player, policy: Policy<G>, choice: &HashMap<u64, Action>) -> f64 {
    match s.node() {
        Node::Terminal => s.returns()[br] as f64,
        Node::Chance => s
            .chance_outcomes()
            .iter()
            .map(|(c, p)| p * br_value(c, br, policy, choice))
            .sum(),
        Node::Decision(q) if q == br => {
            let a = *choice
                .get(&s.infoset_key(br))
                .expect("decisión de mejor respuesta todavía no fijada (¿falta perfect recall?)");
            let mut child = s.clone();
            child.apply(a);
            br_value(&child, br, policy, choice)
        }
        Node::Decision(q) => {
            let strat = policy(s, q);
            actions_of(s.legal_actions())
                .map(|a| {
                    let mut child = s.clone();
                    child.apply(a);
                    strat[a] * br_value(&child, br, policy, choice)
                })
                .sum()
        }
    }
}
```

En `engine/src/lib.rs` agregar: `pub mod cfr;` y `pub mod exact;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test kuhn_cfr`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): tabular CFR and exact exploitability, validated on Kuhn"
```

---

### Task 5: MiniTruco

**En criollo:** un truco en miniatura: 6 cartas, una carta para cada uno, una sola baza, y solo truco/retruco/vale cuatro/quiero/no quiero/mazo. Es lo bastante chico para medir *exactamente* qué tan explotable es el bot, pero ya tiene la parte "de mentir" del truco. Lo usamos para demostrar que el aprendizaje converge en algo parecido al truco de verdad.

**Files:**
- Create: `engine/src/minitruco.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod minitruco;`)
- Test: `engine/tests/minitruco.rs`

**Interfaces:**
- Consumes: `Game`, `ExactGame`, `bit`, `TabularCfr`, `exploitability` (Tareas 3–4). Usa los mismos índices de acciones del truco (0 = jugar, 6 = truco, 7 = retruco, 8 = vale cuatro, 9 = quiero, 10 = no quiero, 11 = mazo).
- Produces: `MiniTruco` (implementa `Game` + `ExactGame`), `NUM_ACTIONS = 12`, `ENCODING_SIZE = 26`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/minitruco.rs`:
```rust
use truco_engine::cfr::TabularCfr;
use truco_engine::exact::exploitability;
use truco_engine::game::{bit, ExactGame, Game, Node, Player};
use truco_engine::minitruco::MiniTruco;

const JUGAR: usize = 0;
const TRUCO: usize = 6;
const RETRUCO: usize = 7;
const VALE_CUATRO: usize = 8;
const QUIERO: usize = 9;
const NO_QUIERO: usize = 10;
const MAZO: usize = 11;

fn dealt(c0: u8, c1: u8) -> MiniTruco {
    MiniTruco::root()
        .chance_outcomes()
        .into_iter()
        .map(|(s, _)| s)
        .find(|s| s.cards() == Some([c0, c1]))
        .unwrap()
}

fn play(mut s: MiniTruco, actions: &[usize]) -> MiniTruco {
    for &a in actions {
        assert!(s.legal_actions() & bit(a) != 0, "acción {a} ilegal");
        s.apply(a);
    }
    s
}

#[test]
fn thirty_deals() {
    assert_eq!(MiniTruco::root().chance_outcomes().len(), 30);
}

#[test]
fn plain_play_higher_card_wins_one() {
    let s = play(dealt(5, 2), &[JUGAR, JUGAR]);
    assert_eq!(s.node(), Node::Terminal);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn truco_chain() {
    let s = play(dealt(1, 4), &[TRUCO, RETRUCO, VALE_CUATRO, QUIERO, JUGAR, JUGAR]);
    assert_eq!(s.returns(), [-4.0, 4.0]);
    let s = play(dealt(1, 4), &[TRUCO, RETRUCO, NO_QUIERO]);
    assert_eq!(s.returns(), [-2.0, 2.0], "rechazar el retruco paga el truco aceptado");
    let s = play(dealt(1, 4), &[TRUCO, NO_QUIERO]);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn only_holder_can_raise() {
    let s = play(dealt(0, 1), &[TRUCO, QUIERO]);
    assert_eq!(s.node(), Node::Decision(0));
    assert_eq!(s.legal_actions(), bit(JUGAR) | bit(MAZO), "el que cantó no puede subir");
    let s = play(s, &[JUGAR]);
    assert_eq!(s.legal_actions() & bit(RETRUCO), bit(RETRUCO), "el que dijo quiero sí puede");
}

#[test]
fn mazo_pays_current_level() {
    let s = play(dealt(0, 1), &[TRUCO, QUIERO, MAZO]);
    assert_eq!(s.returns(), [-2.0, 2.0]);
}

#[test]
fn cfr_converges_on_minitruco() {
    let mut cfr = TabularCfr::<MiniTruco>::new();
    cfr.run(300);
    let early = exploitability::<MiniTruco>(&|s: &MiniTruco, p: Player| cfr.average_strategy(s, p));
    cfr.run(2700);
    let late = exploitability::<MiniTruco>(&|s: &MiniTruco, p: Player| cfr.average_strategy(s, p));
    assert!(late < 0.05, "explotabilidad final {late}");
    assert!(late < early / 2.0, "early={early} late={late}");
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test minitruco`
Expected: error de compilación (no existe `minitruco`).

- [ ] **Step 3: Implementación**

`engine/src/minitruco.rs`:
```rust
//! MiniTruco: 6 cartas de fuerza 0..5 (5 la más alta), una carta por jugador, una sola baza.
//! El jugador 0 es mano. Cantos: truco (2), retruco (3), vale cuatro (4); quiero, no quiero, mazo.
use crate::game::{bit, ActionMask, ExactGame, Game, Node, Player};
use rand::{Rng, RngCore};

const JUGAR: usize = 0;
const TRUCO: usize = 6;
const RETRUCO: usize = 7;
const VALE_CUATRO: usize = 8;
const QUIERO: usize = 9;
const NO_QUIERO: usize = 10;
const MAZO: usize = 11;

#[derive(Clone, Copy, Debug)]
pub struct MiniTruco {
    cards: Option<[u8; 2]>,
    played: [bool; 2],
    turn: Player,
    level: u8,
    pending: Option<(u8, Player)>,
    holder: Option<Player>,
    resume: Player,
    result: Option<(Player, u8)>,
    history: u64,
    history_len: u8,
}

fn deals() -> Vec<[u8; 2]> {
    (0..6u8)
        .flat_map(|a| (0..6u8).filter(move |&b| b != a).map(move |b| [a, b]))
        .collect()
}

impl MiniTruco {
    pub fn cards(&self) -> Option<[u8; 2]> {
        self.cards
    }

    fn with_cards(&self, cards: [u8; 2]) -> MiniTruco {
        MiniTruco { cards: Some(cards), ..*self }
    }
}

impl Game for MiniTruco {
    const NUM_ACTIONS: usize = 12;
    const ENCODING_SIZE: usize = 26;

    fn root() -> Self {
        MiniTruco {
            cards: None,
            played: [false; 2],
            turn: 0,
            level: 1,
            pending: None,
            holder: None,
            resume: 0,
            result: None,
            history: 0,
            history_len: 0,
        }
    }

    fn node(&self) -> Node {
        if self.cards.is_none() {
            Node::Chance
        } else if self.result.is_some() {
            Node::Terminal
        } else {
            Node::Decision(self.turn)
        }
    }

    fn sample_chance(&self, rng: &mut dyn RngCore) -> Self {
        let d = deals();
        self.with_cards(d[rng.gen_range(0..d.len())])
    }

    fn legal_actions(&self) -> ActionMask {
        if self.cards.is_none() || self.result.is_some() {
            return 0;
        }
        let p = self.turn;
        if let Some((lvl, _)) = self.pending {
            let mut m = bit(QUIERO) | bit(NO_QUIERO);
            if lvl == 2 {
                m |= bit(RETRUCO);
            }
            if lvl == 3 {
                m |= bit(VALE_CUATRO);
            }
            return m;
        }
        let mut m = bit(JUGAR) | bit(MAZO);
        match (self.level, self.holder) {
            (1, None) => m |= bit(TRUCO),
            (2, Some(h)) if h == p => m |= bit(RETRUCO),
            (3, Some(h)) if h == p => m |= bit(VALE_CUATRO),
            _ => {}
        }
        m
    }

    fn apply(&mut self, a: usize) {
        debug_assert!(self.legal_actions() & bit(a) != 0, "acción ilegal {a}");
        let p = self.turn;
        let o = 1 - p;
        self.history |= (a as u64) << (4 * self.history_len as u64);
        self.history_len += 1;
        match a {
            JUGAR => {
                self.played[p] = true;
                if self.played[o] {
                    let c = self.cards.expect("sin repartir");
                    let winner = if c[0] > c[1] { 0 } else { 1 };
                    self.result = Some((winner, self.level));
                } else {
                    self.turn = o;
                }
            }
            TRUCO | RETRUCO | VALE_CUATRO => {
                let lvl = match a {
                    TRUCO => 2,
                    RETRUCO => 3,
                    _ => 4,
                };
                match self.pending {
                    Some((pending_lvl, _)) => self.level = pending_lvl,
                    None => self.resume = p,
                }
                self.pending = Some((lvl, p));
                self.turn = o;
            }
            QUIERO => {
                let (lvl, _) = self.pending.take().expect("quiero sin canto pendiente");
                self.level = lvl;
                self.holder = Some(p);
                self.turn = self.resume;
            }
            NO_QUIERO => {
                let (_, caller) = self.pending.take().expect("no quiero sin canto pendiente");
                self.result = Some((caller, self.level));
            }
            MAZO => self.result = Some((o, self.level)),
            _ => panic!("acción inválida en MiniTruco: {a}"),
        }
    }

    fn returns(&self) -> [f32; 2] {
        let (winner, pts) = self.result.expect("la mano no terminó");
        let v = pts as f32;
        if winner == 0 {
            [v, -v]
        } else {
            [-v, v]
        }
    }

    /// carta propia (6) + carta jugada del rival (7: ninguna o 0..5) + nivel aceptado (4)
    /// + canto pendiente (4: ninguno, 2, 3, 4) + quién puede subir (3: nadie, yo, rival)
    /// + ya jugué (1) + soy mano (1) = 26.
    fn encode(&self, p: Player, out: &mut [u8]) {
        out.fill(0);
        let c = self.cards.expect("sin repartir");
        let o = 1 - p;
        out[c[p] as usize] = 1;
        if self.played[o] {
            out[7 + c[o] as usize] = 1;
        } else {
            out[6] = 1;
        }
        out[13 + (self.level - 1) as usize] = 1;
        match self.pending {
            None => out[17] = 1,
            Some((lvl, _)) => out[17 + (lvl - 1) as usize] = 1,
        }
        match self.holder {
            None => out[21] = 1,
            Some(h) if h == p => out[22] = 1,
            Some(_) => out[23] = 1,
        }
        out[24] = self.played[p] as u8;
        out[25] = (p == 0) as u8;
    }

    fn feature_scale() -> Vec<f32> {
        vec![1.0; 26]
    }
}

impl ExactGame for MiniTruco {
    fn chance_outcomes(&self) -> Vec<(Self, f64)> {
        let d = deals();
        let p = 1.0 / d.len() as f64;
        d.into_iter().map(|cards| (self.with_cards(cards), p)).collect()
    }

    fn infoset_key(&self, p: Player) -> u64 {
        let c = self.cards.expect("sin repartir");
        let o = 1 - p;
        let opp_visible = if self.played[o] { c[o] as u64 + 1 } else { 0 };
        c[p] as u64
            | (opp_visible << 3)
            | ((self.history_len as u64) << 6)
            | (self.history << 11)
            | ((p as u64) << 63)
    }
}
```

En `engine/src/lib.rs` agregar: `pub mod minitruco;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test minitruco`
Expected: `6 passed`. Si `cfr_converges_on_minitruco` falla solo por el umbral (por ejemplo, `late = 0.06`), anotar el valor obtenido y subir las iteraciones a 300 + 5700. No subir el umbral.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): MiniTruco with exact exploitability"
```

---

### Task 6: Truco — la mano, las bazas, las pardas y el mazo

**En criollo:** el corazón del motor. Armamos el estado de una mano de truco: las cartas de cada uno, de quién es el turno, quién ganó cada baza y quién gana la mano (incluidas las pardas). Todavía sin cantos, salvo irse al mazo. Al repartir, las cartas de cada mano se ordenan de la más fuerte a la más débil, y ese orden queda fijo: "jugar0" es siempre "tirar la carta que estaba primera" (la más fuerte del reparto), "jugar1" la segunda y "jugar2" la tercera. Si ya la tiraste, esa acción deja de ser legal.

**Files:**
- Create: `engine/src/truco/mod.rs`, `engine/src/truco/actions.rs`, `engine/src/truco/state.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod truco;`)
- Test: `engine/tests/truco_common/mod.rs`, `engine/tests/truco_bazas.rs`

**Interfaces:**
- Consumes: `Card`, `envido_points`, `bit`, `other`, `Action`, `ActionMask`, `Player`.
- Produces (`actions.rs`): constantes `JUGAR0=0, JUGAR1=1, JUGAR2=2, ENVIDO=3, REAL_ENVIDO=4, FALTA_ENVIDO=5, TRUCO=6, RETRUCO=7, VALE_CUATRO=8, QUIERO=9, NO_QUIERO=10, MAZO=11`, `NUM_ACTIONS=12`, `ACTION_NAMES: [&str; 12]`.
- Produces (`state.rs`): `TARGET=30`, `BUENAS=15`, `BazaResult { Won(Player), Parda }`, `EnvidoKind { Envido, Real, Falta }`, `EnvidoStatus { NotPlayed, Pending, Accepted, Declined }`, `TrucoState` (Copy) con `new_hand(hands: [[Card; 3]; 2], mano: Player, scores: [u8; 2])`, `turn()`, `mano()`, `is_over()`, `hand(p) -> [Card; 3]`, `score(p) -> u8`, `points() -> [u8; 2]`, `truco_level() -> u8`, `baza() -> usize`, `baza_results()`, `envido_status()`, `tantos(p) -> u8`, `revealed_tantos() -> [Option<u8>; 2]`, `played(p) -> [Option<usize>; 3]`, `returns() -> [f32; 2]`, `legal_actions() -> ActionMask`, `apply(Action)`.

- [ ] **Step 1: Helpers de test y tests que fallan**

`engine/tests/truco_common/mod.rs`:
```rust
#![allow(dead_code)]
use truco_engine::cards::Card;
use truco_engine::game::bit;
use truco_engine::truco::{TrucoState, ACTION_NAMES};

pub fn hand(s: &str) -> [Card; 3] {
    let v: Vec<Card> = s.split_whitespace().map(|t| Card::parse(t).unwrap()).collect();
    [v[0], v[1], v[2]]
}

/// Mano nueva: jugador 0 es mano, puntaje 0 a 0.
pub fn new(p0: &str, p1: &str) -> TrucoState {
    TrucoState::new_hand([hand(p0), hand(p1)], 0, [0, 0])
}

pub fn new_with(p0: &str, p1: &str, mano: usize, scores: [u8; 2]) -> TrucoState {
    TrucoState::new_hand([hand(p0), hand(p1)], mano, scores)
}

pub fn play(mut s: TrucoState, actions: &[usize]) -> TrucoState {
    for &a in actions {
        assert!(
            s.legal_actions() & bit(a) != 0,
            "acción ilegal {} (legales: {:#014b})",
            ACTION_NAMES[a],
            s.legal_actions()
        );
        s.apply(a);
    }
    s
}

pub fn mask(actions: &[usize]) -> u16 {
    actions.iter().fold(0, |m, &a| m | bit(a))
}
```

`engine/tests/truco_bazas.rs`:
```rust
mod truco_common;
use truco_common::*;
use truco_engine::cards::Card;
use truco_engine::truco::*;

// Recordatorio: al repartir, cada mano se ordena de la más fuerte a la más débil y el orden
// queda fijo. JUGAR0 = la carta que quedó primera, JUGAR2 = la tercera. Un slot jugado no se repite.

#[test]
fn hand_is_sorted_strongest_first() {
    let s = new("4C 1E 5O", "12C 11C 10C");
    assert_eq!(s.hand(0), hand("1E 5O 4C"));
}

#[test]
fn equal_rank_cards_sort_by_id() {
    let a = new("3O 3E 4C", "12C 11C 10C");
    let b = new("3E 3O 4C", "12C 11C 10C");
    assert_eq!(a.hand(0), b.hand(0));
    assert_eq!(a.hand(0)[0], Card::parse("3E").unwrap(), "a igual jerarquía, primero el id menor (espada)");
}

#[test]
fn mano_wins_first_two_bazas() {
    let s = new("1E 7E 4C", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 1E>3C, 7E>2C
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn baza_winner_leads_next() {
    let s = new("4C 5C 6C", "1E 7E 3O");
    let s = play(s, &[JUGAR0, JUGAR0]);
    assert_eq!(s.baza_results()[0], Some(BazaResult::Won(1)));
    assert_eq!(s.turn(), 1);
    assert_eq!(s.baza(), 1);
}

#[test]
fn parda_first_then_second_decides() {
    let s = new("3E 4C 5C", "3O 1E 6B");
    let s = play(s, &[JUGAR0, JUGAR1]); // 3E contra 3O: parda
    assert_eq!(s.baza_results()[0], Some(BazaResult::Parda));
    assert_eq!(s.turn(), 0, "después de parda empieza el mano");
    let s = play(s, &[JUGAR1, JUGAR0]); // 5C contra 1E
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 1]);
}

#[test]
fn split_first_two_third_decides() {
    let s = new("1E 4C 7O", "3C 2C 6O");
    let s = play(s, &[JUGAR0, JUGAR2]); // 1E le gana al 6O
    let s = play(s, &[JUGAR2, JUGAR0]); // 4C pierde con 3C
    assert!(!s.is_over());
    assert_eq!(s.turn(), 1);
    let s = play(s, &[JUGAR1, JUGAR1]); // 2C contra 7O: gana 7O
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn first_won_then_parda_first_winner_takes_it() {
    let s = new("1E 2O 4C", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR0]); // 1E le gana al 3C
    let s = play(s, &[JUGAR1, JUGAR1]); // 2O contra 2C: parda
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn won_lost_parda_first_winner_takes_it() {
    let s = new("1E 4C 2O", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR2]); // 1E le gana al 5O
    let s = play(s, &[JUGAR2, JUGAR0]); // 4C pierde con 3C
    let s = play(s, &[JUGAR1, JUGAR1]); // 2C contra 2O: parda
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn three_pardas_mano_wins() {
    let s = new_with("3E 2E 4E", "3O 2O 4O", 1, [0, 0]);
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1, JUGAR2, JUGAR2]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 1], "el mano (jugador 1) gana con tres pardas");
}

#[test]
fn mazo_in_first_baza_without_envido_gives_two() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[MAZO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn mazo_in_second_baza_gives_one() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[JUGAR0, JUGAR0, MAZO]);
    assert_eq!(s.points(), [0, 1]);
}

#[test]
fn points_capped_at_30() {
    let s = new_with("1E 7E 4C", "3C 2C 5O", 0, [0, 29]);
    let s = play(s, &[MAZO]); // el mazo en primera vale 2, pero al jugador 1 le falta 1
    assert_eq!(s.points(), [0, 1]);
    assert_eq!(s.score(1), 30);
    assert!(s.is_over());
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test truco_bazas`
Expected: error de compilación (no existe `truco`).

- [ ] **Step 3: Implementación**

`engine/src/truco/mod.rs`:
```rust
//! Truco argentino 1 contra 1, a 30, sin flor.
pub mod actions;
pub mod state;

pub use actions::*;
pub use state::*;
```

`engine/src/truco/actions.rs`:
```rust
//! Índices fijos de acciones. El orden es un contrato con la web y con los pesos entrenados.
use crate::game::Action;

pub const JUGAR0: Action = 0;
pub const JUGAR1: Action = 1;
pub const JUGAR2: Action = 2;
pub const ENVIDO: Action = 3;
pub const REAL_ENVIDO: Action = 4;
pub const FALTA_ENVIDO: Action = 5;
pub const TRUCO: Action = 6;
pub const RETRUCO: Action = 7;
pub const VALE_CUATRO: Action = 8;
pub const QUIERO: Action = 9;
pub const NO_QUIERO: Action = 10;
pub const MAZO: Action = 11;
pub const NUM_ACTIONS: usize = 12;

pub const ACTION_NAMES: [&str; NUM_ACTIONS] = [
    "jugar0", "jugar1", "jugar2", "envido", "realEnvido", "faltaEnvido",
    "truco", "retruco", "valeCuatro", "quiero", "noQuiero", "mazo",
];
```

`engine/src/truco/state.rs`:
```rust
//! Estado de una mano de truco.
use super::actions::*;
use crate::cards::Card;
use crate::envido::envido_points;
use crate::game::{bit, other, Action, ActionMask, Player};

pub const TARGET: u8 = 30;
pub const BUENAS: u8 = 15;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BazaResult {
    Won(Player),
    Parda,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EnvidoKind {
    Envido,
    Real,
    Falta,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EnvidoStatus {
    NotPlayed,
    Pending,
    Accepted,
    Declined,
}

#[derive(Clone, Copy, Debug)]
pub struct TrucoState {
    pub(crate) hands: [[Card; 3]; 2],
    /// `played[p][baza]` = slot de la mano que jugó `p` en esa baza.
    pub(crate) played: [[Option<usize>; 3]; 2],
    pub(crate) baza: usize,
    pub(crate) turn: Player,
    pub(crate) mano: Player,
    pub(crate) start_scores: [u8; 2],
    pub(crate) baza_results: [Option<BazaResult>; 3],
    /// Valor aceptado del truco: 1 (no se cantó), 2, 3 o 4.
    pub(crate) truco_level: u8,
    /// Canto de truco sin responder: (nivel propuesto, quién lo cantó).
    pub(crate) truco_pending: Option<(u8, Player)>,
    /// Quién dijo el último "quiero" (el único que puede subir).
    pub(crate) truco_holder: Option<Player>,
    /// A quién le vuelve el turno cuando se resuelve el canto de truco.
    pub(crate) truco_resume: Player,
    pub(crate) envido_calls: [Option<(EnvidoKind, Player)>; 4],
    pub(crate) envido_status: EnvidoStatus,
    /// A quién le vuelve el turno cuando se resuelve el envido.
    pub(crate) envido_resume: Player,
    pub(crate) tantos: [u8; 2],
    pub(crate) revealed_tantos: [Option<u8>; 2],
    /// Puntos ganados en esta mano.
    pub(crate) points: [u8; 2],
    pub(crate) over: bool,
}

impl TrucoState {
    pub fn new_hand(mut hands: [[Card; 3]; 2], mano: Player, scores: [u8; 2]) -> TrucoState {
        assert!(mano < 2, "mano inválido: {mano}");
        assert!(scores[0] < TARGET && scores[1] < TARGET, "puntaje inicial inválido: {scores:?}");
        for h in hands.iter_mut() {
            h.sort_by(|a, b| b.rank().cmp(&a.rank()).then(a.id().cmp(&b.id())));
        }
        let tantos = [envido_points(&hands[0]), envido_points(&hands[1])];
        TrucoState {
            hands,
            played: [[None; 3]; 2],
            baza: 0,
            turn: mano,
            mano,
            start_scores: scores,
            baza_results: [None; 3],
            truco_level: 1,
            truco_pending: None,
            truco_holder: None,
            truco_resume: mano,
            envido_calls: [None; 4],
            envido_status: EnvidoStatus::NotPlayed,
            envido_resume: mano,
            tantos,
            revealed_tantos: [None; 2],
            points: [0; 2],
            over: false,
        }
    }

    pub fn turn(&self) -> Player {
        self.turn
    }
    pub fn mano(&self) -> Player {
        self.mano
    }
    pub fn is_over(&self) -> bool {
        self.over
    }
    pub fn hand(&self, p: Player) -> [Card; 3] {
        self.hands[p]
    }
    pub fn played(&self, p: Player) -> [Option<usize>; 3] {
        self.played[p]
    }
    pub fn score(&self, p: Player) -> u8 {
        self.start_scores[p] + self.points[p]
    }
    pub fn points(&self) -> [u8; 2] {
        self.points
    }
    pub fn truco_level(&self) -> u8 {
        self.truco_level
    }
    pub fn baza(&self) -> usize {
        self.baza
    }
    pub fn baza_results(&self) -> [Option<BazaResult>; 3] {
        self.baza_results
    }
    pub fn envido_status(&self) -> EnvidoStatus {
        self.envido_status
    }
    pub fn tantos(&self, p: Player) -> u8 {
        self.tantos[p]
    }
    pub fn revealed_tantos(&self) -> [Option<u8>; 2] {
        self.revealed_tantos
    }

    pub fn returns(&self) -> [f32; 2] {
        let d = self.points[0] as f32 - self.points[1] as f32;
        [d, -d]
    }

    pub fn legal_actions(&self) -> ActionMask {
        if self.over {
            return 0;
        }
        let p = self.turn;
        let mut m = bit(MAZO);
        for slot in 0..3 {
            if !self.slot_used(p, slot) {
                m |= bit(JUGAR0 + slot);
            }
        }
        m
    }

    pub fn apply(&mut self, a: Action) {
        debug_assert!(self.legal_actions() & bit(a) != 0, "acción ilegal: {}", ACTION_NAMES[a]);
        let p = self.turn;
        match a {
            JUGAR0 | JUGAR1 | JUGAR2 => self.play_card(p, a - JUGAR0),
            MAZO => self.mazo(p),
            _ => panic!("acción todavía no soportada: {}", ACTION_NAMES[a]),
        }
    }

    pub(crate) fn slot_used(&self, p: Player, slot: usize) -> bool {
        self.played[p].contains(&Some(slot))
    }

    /// Suma puntos sin pasarse de 30; si alguien llega a 30, la mano (y el partido) termina.
    pub(crate) fn award(&mut self, p: Player, pts: u8) {
        let cap = TARGET - self.score(p);
        self.points[p] += pts.min(cap);
        if self.score(p) >= TARGET {
            self.over = true;
        }
    }

    pub(crate) fn play_card(&mut self, p: Player, slot: usize) {
        let b = self.baza;
        self.played[p][b] = Some(slot);
        let o = other(p);
        let Some(o_slot) = self.played[o][b] else {
            self.turn = o;
            return;
        };
        let rp = self.hands[p][slot].rank();
        let ro = self.hands[o][o_slot].rank();
        let result = if rp > ro {
            BazaResult::Won(p)
        } else if ro > rp {
            BazaResult::Won(o)
        } else {
            BazaResult::Parda
        };
        self.baza_results[b] = Some(result);
        if let Some(w) = self.hand_winner() {
            self.award(w, self.truco_level);
            self.over = true;
            return;
        }
        self.baza += 1;
        self.turn = match result {
            BazaResult::Won(w) => w,
            BazaResult::Parda => self.mano,
        };
    }

    fn hand_winner(&self) -> Option<Player> {
        use BazaResult::{Parda, Won};
        match self.baza_results {
            [Some(Won(a)), Some(Won(b)), _] if a == b => Some(a),
            [Some(Won(a)), Some(Parda), _] => Some(a),
            [Some(Parda), Some(Won(b)), _] => Some(b),
            [Some(Won(_)), Some(Won(_)), Some(Won(c))] => Some(c),
            [Some(Won(a)), Some(Won(_)), Some(Parda)] => Some(a),
            [Some(Parda), Some(Parda), Some(Won(c))] => Some(c),
            [Some(Parda), Some(Parda), Some(Parda)] => Some(self.mano),
            _ => None,
        }
    }

    pub(crate) fn mazo(&mut self, p: Player) {
        let mut pts = self.truco_level;
        if self.baza == 0 && self.envido_status == EnvidoStatus::NotPlayed {
            pts += 1;
        }
        self.award(other(p), pts);
        self.over = true;
    }
}
```

En `engine/src/lib.rs` agregar: `pub mod truco;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test truco_bazas`
Expected: `12 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): truco hand state, bazas, pardas and mazo"
```

---

### Task 7: Truco — cantos de truco

**En criollo:** agregamos truco, retruco y vale cuatro con sus respuestas. Las reglas clave: el que cantó vuelve a tener el turno cuando le dicen "quiero"; solo puede subir el que dijo el último "quiero"; y "quiero retruco" significa aceptar el truco y subir en la misma jugada.

**Files:**
- Create: `engine/src/truco/truco_calls.rs`
- Modify: `engine/src/truco/mod.rs` (agregar `mod truco_calls;`), `engine/src/truco/state.rs` (reemplazar `legal_actions` y `apply`)
- Test: `engine/tests/truco_cantos.rs`

**Interfaces:**
- Consumes: `TrucoState` y sus campos `pub(crate)` (Tarea 6).
- Produces: métodos `pub(crate)` `next_truco_call(p) -> Option<Action>`, `call_truco(p, a)`, `accept_truco(p)`, `decline_truco()`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/truco_cantos.rs`:
```rust
mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

#[test]
fn truco_quiero_returns_turn_to_caller() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO]);
    assert_eq!(s.turn(), 1);
    assert_eq!(s.legal_actions() & mask(&[QUIERO, NO_QUIERO, RETRUCO]), mask(&[QUIERO, NO_QUIERO, RETRUCO]));
    let s = play(s, &[QUIERO]);
    assert_eq!(s.truco_level(), 2);
    assert_eq!(s.turn(), 0, "vuelve a jugar el que cantó");
    assert_eq!(s.legal_actions() & mask(&[TRUCO, RETRUCO]), 0, "el que cantó no puede subir");
}

#[test]
fn holder_can_raise_on_own_turn() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, QUIERO, JUGAR0]);
    assert_eq!(s.turn(), 1);
    assert_ne!(s.legal_actions() & mask(&[RETRUCO]), 0);
}

#[test]
fn truco_no_quiero_gives_one() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, NO_QUIERO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn quiero_retruco_then_quiero_plays_for_three() {
    let s = play(new("4C 5C 6C", "1E 7E 3O"), &[TRUCO, RETRUCO, QUIERO]);
    assert_eq!(s.truco_level(), 3);
    assert_eq!(s.turn(), 0, "el turno vuelve al que empezó la cadena");
    assert_ne!(s.legal_actions() & mask(&[VALE_CUATRO]), 0, "el último quiero lo dijo el jugador 0");
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 6C<1E, 5C<7E
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 3]);
}

#[test]
fn retruco_no_quiero_gives_two_to_raiser() {
    let s = play(new("4C 5C 6C", "1E 7E 3O"), &[TRUCO, RETRUCO, NO_QUIERO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn vale_cuatro_chain() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, RETRUCO, VALE_CUATRO, QUIERO]);
    assert_eq!(s.truco_level(), 4);
    assert_eq!(s.legal_actions() & mask(&[TRUCO, RETRUCO, VALE_CUATRO]), 0);
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 1E>3C, 7E>2C
    assert_eq!(s.points(), [4, 0]);
}

#[test]
fn mazo_after_accepted_truco_pays_level() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, QUIERO, JUGAR0, MAZO]);
    assert_eq!(s.points(), [3, 0], "truco aceptado (2) + 1 porque el envido no se jugó en primera");
}

#[test]
fn truco_can_be_called_mid_hand() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[JUGAR0, JUGAR0, TRUCO, QUIERO]);
    assert_eq!(s.truco_level(), 2);
    assert_eq!(s.turn(), 0);
    let s = play(s, &[JUGAR1, JUGAR1]); // 7E>2C
    assert_eq!(s.points(), [2, 0]);
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test truco_cantos`
Expected: los tests fallan con `acción ilegal truco`.

- [ ] **Step 3: Implementación**

`engine/src/truco/truco_calls.rs`:
```rust
//! Cantos de truco: truco (2), retruco (3), vale cuatro (4).
use super::actions::*;
use super::state::TrucoState;
use crate::game::{other, Action, Player};

impl TrucoState {
    /// Qué canto de truco puede hacer `p` en su turno, si alguno.
    pub(crate) fn next_truco_call(&self, p: Player) -> Option<Action> {
        match (self.truco_level, self.truco_holder) {
            (1, None) => Some(TRUCO),
            (2, Some(h)) if h == p => Some(RETRUCO),
            (3, Some(h)) if h == p => Some(VALE_CUATRO),
            _ => None,
        }
    }

    /// Cantar o subir. Subir ("quiero retruco") acepta el canto pendiente.
    pub(crate) fn call_truco(&mut self, p: Player, a: Action) {
        let level = match a {
            TRUCO => 2,
            RETRUCO => 3,
            VALE_CUATRO => 4,
            _ => unreachable!("no es un canto de truco: {a}"),
        };
        match self.truco_pending {
            Some((pending_level, _)) => self.truco_level = pending_level,
            None => self.truco_resume = p,
        }
        self.truco_pending = Some((level, p));
        self.turn = other(p);
    }

    pub(crate) fn accept_truco(&mut self, p: Player) {
        let (level, _) = self.truco_pending.take().expect("quiero sin truco pendiente");
        self.truco_level = level;
        self.truco_holder = Some(p);
        self.turn = self.truco_resume;
    }

    pub(crate) fn decline_truco(&mut self) {
        let (_, caller) = self.truco_pending.take().expect("no quiero sin truco pendiente");
        self.award(caller, self.truco_level);
        self.over = true;
    }
}
```

En `engine/src/truco/mod.rs` agregar: `mod truco_calls;`

En `engine/src/truco/state.rs`, reemplazar `legal_actions` y `apply` completos por:
```rust
    pub fn legal_actions(&self) -> ActionMask {
        if self.over {
            return 0;
        }
        let p = self.turn;
        if let Some((level, _)) = self.truco_pending {
            let mut m = bit(QUIERO) | bit(NO_QUIERO);
            if level == 2 {
                m |= bit(RETRUCO);
            }
            if level == 3 {
                m |= bit(VALE_CUATRO);
            }
            return m;
        }
        let mut m = bit(MAZO);
        for slot in 0..3 {
            if !self.slot_used(p, slot) {
                m |= bit(JUGAR0 + slot);
            }
        }
        if let Some(a) = self.next_truco_call(p) {
            m |= bit(a);
        }
        m
    }

    pub fn apply(&mut self, a: Action) {
        debug_assert!(self.legal_actions() & bit(a) != 0, "acción ilegal: {}", ACTION_NAMES[a]);
        let p = self.turn;
        match a {
            JUGAR0 | JUGAR1 | JUGAR2 => self.play_card(p, a - JUGAR0),
            TRUCO | RETRUCO | VALE_CUATRO => self.call_truco(p, a),
            QUIERO => self.accept_truco(p),
            NO_QUIERO => self.decline_truco(),
            MAZO => self.mazo(p),
            _ => panic!("acción todavía no soportada: {}", ACTION_NAMES[a]),
        }
    }
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test truco_cantos --test truco_bazas`
Expected: `8 passed` y `12 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): truco, retruco and vale cuatro calls"
```

---

### Task 8: Truco — envido

**En criollo:** agregamos el envido completo: envido, real envido y falta envido, sus combinaciones, cuánto vale cada caso (aceptado o rechazado), cómo se cantan los tantos y la regla de que "el envido va primero" (si te cantan truco en la primera, podés contestar con envido).

**Files:**
- Create: `engine/src/truco/envido_calls.rs`
- Modify: `engine/src/truco/mod.rs` (agregar `mod envido_calls;`), `engine/src/truco/state.rs` (reemplazar `legal_actions` y `apply`)
- Test: `engine/tests/truco_envido.rs`

**Interfaces:**
- Consumes: `TrucoState` (Tareas 6–7).
- Produces: métodos `pub(crate)` `can_call_envido(p) -> bool`, `envido_raises() -> ActionMask`, `call_envido(p, a)`, `resolve_envido(accepted: bool)`, `falta_value(winner) -> u8`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/truco_envido.rs`:
```rust
mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

// p0 "7E 6E 1C" = 33 tantos; p1 "12O 11O 4B" = 20 tantos.

#[test]
fn envido_quiero_mano_wins_and_reveals() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [2, 0]);
    assert_eq!(s.envido_status(), EnvidoStatus::Accepted);
    assert_eq!(s.revealed_tantos(), [Some(33), None], "el pie perdió: dice son buenas");
    assert_eq!(s.turn(), 0, "vuelve el turno al que cantó");
    assert!(!s.is_over());
}

#[test]
fn envido_pie_wins_reveals_both() {
    let s = play(new("12O 11O 4B", "7E 6E 1C"), &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 2]);
    assert_eq!(s.revealed_tantos(), [Some(20), Some(33)]);
}

#[test]
fn envido_tie_goes_to_mano() {
    let s = new_with("7E 6E 1C", "7O 6O 1B", 1, [0, 0]);
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 2], "empate: gana el mano (jugador 1)");
}

#[test]
fn envido_no_quiero_gives_one() {
    let s = play(new("12O 11O 4B", "7E 6E 1C"), &[ENVIDO, NO_QUIERO]);
    assert_eq!(s.points(), [1, 0]);
    assert_eq!(s.envido_status(), EnvidoStatus::Declined);
    assert_eq!(s.revealed_tantos(), [None, None]);
}

#[test]
fn raise_sets() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO]);
    assert_eq!(s.legal_actions(), mask(&[QUIERO, NO_QUIERO, ENVIDO, REAL_ENVIDO, FALTA_ENVIDO]));
    let s2 = play(s, &[ENVIDO]);
    assert_eq!(s2.legal_actions(), mask(&[QUIERO, NO_QUIERO, REAL_ENVIDO, FALTA_ENVIDO]));
    let s3 = play(new("7E 6E 1C", "12O 11O 4B"), &[REAL_ENVIDO]);
    assert_eq!(s3.legal_actions(), mask(&[QUIERO, NO_QUIERO, FALTA_ENVIDO]));
    let s4 = play(new("7E 6E 1C", "12O 11O 4B"), &[FALTA_ENVIDO]);
    assert_eq!(s4.legal_actions(), mask(&[QUIERO, NO_QUIERO]));
}

#[test]
fn envido_envido_real_values() {
    let base = new("7E 6E 1C", "12O 11O 4B");
    let declined = play(base, &[ENVIDO, ENVIDO, REAL_ENVIDO, NO_QUIERO]);
    assert_eq!(declined.points(), [4, 0], "rechazado: paga envido + envido");
    let accepted = play(base, &[ENVIDO, ENVIDO, REAL_ENVIDO, QUIERO]);
    assert_eq!(accepted.points(), [7, 0]);
    let er_declined = play(base, &[ENVIDO, REAL_ENVIDO, NO_QUIERO]);
    assert_eq!(er_declined.points(), [0, 2], "el pie subió con real envido y el mano no quiso");
}

#[test]
fn falta_envido_in_malas_wins_match() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 0, [10, 5]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.score(0), 30);
    assert!(s.is_over());
}

#[test]
fn falta_envido_in_buenas_is_what_leader_needs() {
    let s = new_with("12O 11O 4B", "7E 6E 1C", 0, [20, 10]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 10], "le faltan 10 al que va ganando");
}

#[test]
fn falta_envido_at_exactly_15_is_buenas() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 0, [15, 3]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.points(), [15, 0]);
}

#[test]
fn falta_declined_after_envido_pays_envido() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, FALTA_ENVIDO, NO_QUIERO]);
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn envido_va_primero() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    assert_ne!(s.legal_actions() & mask(&[ENVIDO]), 0, "el pie puede contestar con envido");
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [2, 0]);
    assert_eq!(s.turn(), 1, "vuelve al pie a responder el truco");
    assert_eq!(s.legal_actions(), mask(&[QUIERO, NO_QUIERO, RETRUCO]));
    let s = play(s, &[QUIERO]);
    assert_eq!(s.turn(), 0);
    assert_eq!(s.truco_level(), 2);
}

#[test]
fn envido_closed_after_truco_accepted() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO, QUIERO]);
    assert_eq!(s.legal_actions() & mask(&[ENVIDO, REAL_ENVIDO, FALTA_ENVIDO]), 0);
}

#[test]
fn pie_can_call_envido_after_mano_played() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0]);
    assert_ne!(s.legal_actions() & mask(&[ENVIDO]), 0);
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.turn(), 1, "el pie todavía tiene que jugar su carta");
}

#[test]
fn envido_closed_after_own_first_card_and_after_first_baza() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0, JUGAR0]);
    assert_eq!(s.legal_actions() & mask(&[ENVIDO]), 0);
}

#[test]
fn envido_only_once() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, NO_QUIERO]);
    assert_eq!(s.legal_actions() & mask(&[ENVIDO, REAL_ENVIDO, FALTA_ENVIDO]), 0);
}

#[test]
fn mazo_after_envido_played_gives_only_truco_value() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, NO_QUIERO, MAZO]);
    assert_eq!(s.points(), [1, 1], "envido rechazado: 1 para el 0; mazo: 1 para el 1, sin el extra");
}

#[test]
fn envido_reaching_30_ends_hand_with_truco_pending() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 1, [28, 0]);
    let s = play(s, &[TRUCO, ENVIDO, QUIERO]);
    assert_eq!(s.score(0), 30);
    assert!(s.is_over());
    assert_eq!(s.legal_actions(), 0);
}

#[test]
fn no_mazo_or_card_while_call_pending() {
    let base = new("7E 6E 1C", "12O 11O 4B");
    for pending in [play(base, &[TRUCO]), play(base, &[ENVIDO])] {
        assert_eq!(pending.legal_actions() & mask(&[MAZO, JUGAR0, JUGAR1, JUGAR2]), 0);
    }
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test truco_envido`
Expected: los tests fallan con `acción ilegal envido` (o similar).

- [ ] **Step 3: Implementación**

`engine/src/truco/envido_calls.rs`:
```rust
//! Envido, real envido y falta envido.
use super::actions::*;
use super::state::{EnvidoKind, EnvidoStatus, TrucoState, BUENAS, TARGET};
use crate::game::{bit, other, Action, ActionMask, Player};

fn kind_value(k: EnvidoKind) -> u8 {
    match k {
        EnvidoKind::Envido => 2,
        EnvidoKind::Real => 3,
        EnvidoKind::Falta => unreachable!("la falta nunca es un canto previo"),
    }
}

impl TrucoState {
    /// Se puede cantar en la primera baza, antes de jugar la propia carta, si nadie aceptó el truco.
    pub(crate) fn can_call_envido(&self, p: Player) -> bool {
        self.envido_status == EnvidoStatus::NotPlayed
            && self.baza == 0
            && self.played[p][0].is_none()
            && self.truco_level == 1
    }

    /// Subidas permitidas con un envido pendiente.
    pub(crate) fn envido_raises(&self) -> ActionMask {
        let mut n_envido = 0;
        let mut has_real = false;
        let mut has_falta = false;
        for &(k, _) in self.envido_calls.iter().flatten() {
            match k {
                EnvidoKind::Envido => n_envido += 1,
                EnvidoKind::Real => has_real = true,
                EnvidoKind::Falta => has_falta = true,
            }
        }
        let mut m = 0;
        if !has_real && !has_falta && n_envido < 2 {
            m |= bit(ENVIDO);
        }
        if !has_real && !has_falta {
            m |= bit(REAL_ENVIDO);
        }
        if !has_falta {
            m |= bit(FALTA_ENVIDO);
        }
        m
    }

    pub(crate) fn call_envido(&mut self, p: Player, a: Action) {
        let kind = match a {
            ENVIDO => EnvidoKind::Envido,
            REAL_ENVIDO => EnvidoKind::Real,
            FALTA_ENVIDO => EnvidoKind::Falta,
            _ => unreachable!("no es un canto de envido: {a}"),
        };
        if self.envido_status == EnvidoStatus::NotPlayed {
            self.envido_status = EnvidoStatus::Pending;
            self.envido_resume = p;
        }
        let slot = self
            .envido_calls
            .iter()
            .position(|c| c.is_none())
            .expect("más de 4 cantos de envido");
        self.envido_calls[slot] = Some((kind, p));
        self.turn = other(p);
    }

    pub(crate) fn resolve_envido(&mut self, accepted: bool) {
        let calls = self.envido_calls;
        let n = calls.iter().flatten().count();
        let (_, last_caller) = calls[n - 1].expect("envido sin cantos");
        if accepted {
            let mano = self.mano;
            let pie = other(mano);
            let winner = if self.tantos[mano] >= self.tantos[pie] { mano } else { pie };
            self.revealed_tantos[mano] = Some(self.tantos[mano]);
            if winner == pie {
                self.revealed_tantos[pie] = Some(self.tantos[pie]);
            }
            let has_falta = calls.iter().flatten().any(|&(k, _)| k == EnvidoKind::Falta);
            let value = if has_falta {
                self.falta_value(winner)
            } else {
                calls.iter().flatten().map(|&(k, _)| kind_value(k)).sum()
            };
            self.envido_status = EnvidoStatus::Accepted;
            self.award(winner, value);
        } else {
            let value = if n == 1 {
                1
            } else {
                calls[..n - 1].iter().flatten().map(|&(k, _)| kind_value(k)).sum()
            };
            self.envido_status = EnvidoStatus::Declined;
            self.award(last_caller, value);
        }
        self.turn = self.envido_resume;
    }

    /// En las malas (el que va ganando tiene menos de 15) la falta gana el partido;
    /// en las buenas vale lo que le falta al que va ganando para llegar a 30.
    pub(crate) fn falta_value(&self, winner: Player) -> u8 {
        let leader = self.score(0).max(self.score(1));
        if leader < BUENAS {
            TARGET - self.score(winner)
        } else {
            TARGET - leader
        }
    }
}
```

En `engine/src/truco/mod.rs` agregar: `mod envido_calls;`

En `engine/src/truco/state.rs`, reemplazar `legal_actions` y `apply` completos por la versión final:
```rust
    pub fn legal_actions(&self) -> ActionMask {
        if self.over {
            return 0;
        }
        let p = self.turn;
        if self.envido_status == EnvidoStatus::Pending {
            return bit(QUIERO) | bit(NO_QUIERO) | self.envido_raises();
        }
        let envido = if self.can_call_envido(p) {
            bit(ENVIDO) | bit(REAL_ENVIDO) | bit(FALTA_ENVIDO)
        } else {
            0
        };
        if let Some((level, _)) = self.truco_pending {
            let mut m = bit(QUIERO) | bit(NO_QUIERO) | envido;
            if level == 2 {
                m |= bit(RETRUCO);
            }
            if level == 3 {
                m |= bit(VALE_CUATRO);
            }
            return m;
        }
        let mut m = bit(MAZO) | envido;
        for slot in 0..3 {
            if !self.slot_used(p, slot) {
                m |= bit(JUGAR0 + slot);
            }
        }
        if let Some(a) = self.next_truco_call(p) {
            m |= bit(a);
        }
        m
    }

    pub fn apply(&mut self, a: Action) {
        debug_assert!(self.legal_actions() & bit(a) != 0, "acción ilegal: {}", ACTION_NAMES[a]);
        let p = self.turn;
        let envido_pending = self.envido_status == EnvidoStatus::Pending;
        match a {
            JUGAR0 | JUGAR1 | JUGAR2 => self.play_card(p, a - JUGAR0),
            ENVIDO | REAL_ENVIDO | FALTA_ENVIDO => self.call_envido(p, a),
            TRUCO | RETRUCO | VALE_CUATRO => self.call_truco(p, a),
            QUIERO if envido_pending => self.resolve_envido(true),
            NO_QUIERO if envido_pending => self.resolve_envido(false),
            QUIERO => self.accept_truco(p),
            NO_QUIERO => self.decline_truco(),
            MAZO => self.mazo(p),
            _ => panic!("acción inválida: {a}"),
        }
    }
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine`
Expected: todos los tests pasan (`truco_envido`: 18 passed; las tareas anteriores siguen en verde).

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): envido, real envido, falta envido and envido-va-primero"
```

---

### Task 9: Truco — observación, codificación, `Game` y pruebas masivas

**En criollo:** definimos **lo que ve cada jugador**: sus cartas, lo jugado y lo cantado, pero nunca las cartas escondidas del rival. Después lo convertimos en los 304 números que entran a la red neuronal. Además conectamos el truco al trait `Game` (para que lo use el entrenamiento) y jugamos 20.000 manos al azar verificando que nunca se rompa nada.

**Files:**
- Create: `engine/src/truco/observation.rs`, `engine/src/truco/encode.rs`, `engine/src/truco/deal.rs`
- Modify: `engine/src/truco/mod.rs` (agregar módulos y re-exports)
- Test: `engine/tests/truco_observation.rs`, `engine/tests/truco_random_play.rs`

**Interfaces:**
- Consumes: todo `TrucoState` (Tareas 6–8), `Game`, `Node`.
- Produces: `RelResult { Mine, Theirs, Parda }`; `Observation` (Copy) con los campos `me`, `is_mano`, `hand: [Card; 3]`, `my_played: [Option<usize>; 3]`, `opp_played: [Option<Card>; 3]`, `baza: usize`, `baza_results: [Option<RelResult>; 3]`, `truco_level: u8`, `truco_pending: Option<(u8, bool)>` (bool = lo canté yo), `truco_holder: Option<bool>`, `envido_calls: [Option<(EnvidoKind, bool)>; 4]`, `envido_status`, `my_tantos: u8`, `opp_revealed_tantos: Option<u8>`, `my_score: u8`, `opp_score: u8`, `legal: ActionMask`; `TrucoState::observation(p) -> Observation`; `ENCODING_SIZE = 304`; `encode(&Observation, &mut [u8])`; `feature_scale() -> Vec<f32>`; `deal(&mut dyn RngCore) -> [[Card; 3]; 2]`; `sample_scores(&mut dyn RngCore) -> [u8; 2]`; `TrucoGame(pub Option<TrucoState>)` que implementa `Game`, con `state() -> &TrucoState`.

- [ ] **Step 1: Tests que fallan**

`engine/tests/truco_observation.rs`:
```rust
mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

#[test]
fn observation_basics() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0]);
    let o = s.observation(1);
    assert!(!o.is_mano);
    assert_eq!(o.opp_played[0], Some(s.hand(0)[0]));
    assert_eq!(o.my_tantos, 20);
    assert_ne!(o.legal, 0);
    assert_eq!(s.observation(0).legal, 0, "no es su turno");
    assert_eq!(s.observation(0).my_played[0], Some(0));
}

#[test]
fn observation_relative_fields() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    assert_eq!(s.observation(0).truco_pending, Some((2, true)));
    assert_eq!(s.observation(1).truco_pending, Some((2, false)));
    let s = play(s, &[ENVIDO]);
    assert_eq!(s.observation(1).envido_calls[0], Some((EnvidoKind::Envido, true)));
}

#[test]
fn encoding_does_not_leak_opponent_hand() {
    let a = new("7E 6E 1C", "12O 11O 4B");
    let b = new("7E 6E 1C", "3C 2C 5O");
    let (mut ea, mut eb) = ([0u8; ENCODING_SIZE], [0u8; ENCODING_SIZE]);
    encode(&a.observation(0), &mut ea);
    encode(&b.observation(0), &mut eb);
    assert_eq!(ea, eb, "la codificación del jugador 0 no puede depender de las cartas del rival");
    let a = play(a, &[ENVIDO, NO_QUIERO]);
    let b = play(b, &[ENVIDO, NO_QUIERO]);
    encode(&a.observation(0), &mut ea);
    encode(&b.observation(0), &mut eb);
    assert_eq!(ea, eb, "un envido rechazado no revela nada");
}

#[test]
fn encoding_layout() {
    let s = play(new_with("7E 6E 1C", "12O 11O 4B", 0, [12, 20]), &[TRUCO]);
    let mut e = [0u8; ENCODING_SIZE];
    encode(&s.observation(1), &mut e);
    assert_eq!(e.iter().filter(|&&x| x > 1).count(), 3, "solo tantos y puntajes superan 1");
    assert!(e.contains(&20), "mi puntaje");
    assert!(e.contains(&12), "puntaje del rival");
    let scale = feature_scale();
    assert_eq!(scale.len(), ENCODING_SIZE);
    assert!(scale.iter().all(|&x| x > 0.0 && x <= 1.0));
}
```

`engine/tests/truco_random_play.rs`:
```rust
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use truco_engine::game::{actions_of, other, Game, Node};
use truco_engine::truco::{TrucoGame, ENCODING_SIZE, TARGET};

#[test]
fn random_play_invariants() {
    let mut rng = SmallRng::seed_from_u64(7);
    let mut buf = [0u8; ENCODING_SIZE];
    for _ in 0..20_000 {
        let mut g = TrucoGame::root().sample_chance(&mut rng);
        let start = [g.state().score(0), g.state().score(1)];
        let mut steps = 0;
        while let Node::Decision(p) = g.node() {
            let legal = g.legal_actions();
            assert_ne!(legal, 0, "nodo de decisión sin acciones legales");
            g.encode(p, &mut buf);
            g.encode(other(p), &mut buf);
            let acts: Vec<_> = actions_of(legal).collect();
            g.apply(acts[rng.gen_range(0..acts.len())]);
            steps += 1;
            assert!(steps < 60, "la mano no termina");
        }
        assert_eq!(g.node(), Node::Terminal);
        let s = g.state();
        let r = g.returns();
        assert_eq!(r[0], -r[1]);
        for p in 0..2 {
            assert!(s.score(p) <= TARGET);
            assert!(s.score(p) >= start[p]);
        }
        assert!(s.points().iter().any(|&x| x > 0), "toda mano reparte al menos un punto");
    }
}

#[test]
fn root_is_chance_and_deal_is_valid() {
    let mut rng = SmallRng::seed_from_u64(1);
    assert_eq!(TrucoGame::root().node(), Node::Chance);
    for _ in 0..1000 {
        let g = TrucoGame::root().sample_chance(&mut rng);
        let s = g.state();
        let mut ids: Vec<u8> = s.hand(0).iter().chain(s.hand(1).iter()).map(|c| c.id()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 6, "seis cartas distintas");
        assert!(s.score(0) < TARGET && s.score(1) < TARGET);
    }
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test truco_observation --test truco_random_play`
Expected: error de compilación (no existen `observation`, `encode`, `TrucoGame`).

- [ ] **Step 3: Implementación**

`engine/src/truco/observation.rs`:
```rust
//! Lo que ve un jugador: nunca incluye las cartas no jugadas del rival.
use super::state::{BazaResult, EnvidoKind, EnvidoStatus, TrucoState};
use crate::cards::Card;
use crate::game::{other, ActionMask, Player};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RelResult {
    Mine,
    Theirs,
    Parda,
}

#[derive(Clone, Copy, Debug)]
pub struct Observation {
    pub me: Player,
    pub is_mano: bool,
    pub hand: [Card; 3],
    pub my_played: [Option<usize>; 3],
    pub opp_played: [Option<Card>; 3],
    pub baza: usize,
    pub baza_results: [Option<RelResult>; 3],
    pub truco_level: u8,
    /// (nivel propuesto, lo canté yo)
    pub truco_pending: Option<(u8, bool)>,
    /// Some(true) = puedo subir yo
    pub truco_holder: Option<bool>,
    /// (tipo, lo canté yo)
    pub envido_calls: [Option<(EnvidoKind, bool)>; 4],
    pub envido_status: EnvidoStatus,
    pub my_tantos: u8,
    pub opp_revealed_tantos: Option<u8>,
    pub my_score: u8,
    pub opp_score: u8,
    /// Acciones legales (0 si no es mi turno).
    pub legal: ActionMask,
}

impl TrucoState {
    pub fn observation(&self, p: Player) -> Observation {
        let o = other(p);
        let rel = |r: BazaResult| match r {
            BazaResult::Parda => RelResult::Parda,
            BazaResult::Won(w) if w == p => RelResult::Mine,
            BazaResult::Won(_) => RelResult::Theirs,
        };
        Observation {
            me: p,
            is_mano: self.mano == p,
            hand: self.hands[p],
            my_played: self.played[p],
            opp_played: std::array::from_fn(|b| self.played[o][b].map(|slot| self.hands[o][slot])),
            baza: self.baza,
            baza_results: self.baza_results.map(|r| r.map(rel)),
            truco_level: self.truco_level,
            truco_pending: self.truco_pending.map(|(l, caller)| (l, caller == p)),
            truco_holder: self.truco_holder.map(|h| h == p),
            envido_calls: self.envido_calls.map(|c| c.map(|(k, caller)| (k, caller == p))),
            envido_status: self.envido_status,
            my_tantos: self.tantos[p],
            opp_revealed_tantos: self.revealed_tantos[o],
            my_score: self.score(p),
            opp_score: self.score(o),
            legal: if self.turn == p { self.legal_actions() } else { 0 },
        }
    }
}
```

`engine/src/truco/encode.rs`:
```rust
//! Codificación de una Observation en 304 bytes para la red neuronal.
//! Casi todo es 0/1; tantos (0..33) y puntajes (0..30) van crudos y se escalan con `feature_scale`.
use super::observation::{Observation, RelResult};
use super::state::{EnvidoKind, EnvidoStatus, BUENAS};

pub const OFF_HAND: usize = 0; // 3 slots × 40 cartas
pub const OFF_SLOT_PLAYED: usize = 120; // 3
pub const OFF_MY_PLAYED: usize = 123; // 3 bazas × 3 slots
pub const OFF_OPP_PLAYED: usize = 132; // 3 bazas × 40 cartas
pub const OFF_BAZA_RES: usize = 252; // 3 bazas × (mía, suya, parda)
pub const OFF_BAZA: usize = 261; // 3
pub const OFF_MANO: usize = 264; // 1
pub const OFF_TRUCO_LEVEL: usize = 265; // 4 (niveles 1..4)
pub const OFF_TRUCO_PENDING: usize = 269; // 3 niveles × (yo, rival)
pub const OFF_TRUCO_HOLDER: usize = 275; // 2 (yo, rival)
pub const OFF_ENVIDO_CALLS: usize = 277; // 4 cantos × (envido, real, falta)
pub const OFF_ENVIDO_CALLER: usize = 289; // 4 (1 = lo canté yo)
pub const OFF_ENVIDO_STATUS: usize = 293; // 4
pub const OFF_MY_TANTOS: usize = 297;
pub const OFF_OPP_TANTOS: usize = 298;
pub const OFF_OPP_TANTOS_KNOWN: usize = 299;
pub const OFF_MY_SCORE: usize = 300;
pub const OFF_OPP_SCORE: usize = 301;
pub const OFF_BUENAS: usize = 302; // 2 (yo en buenas, rival en buenas)
pub const ENCODING_SIZE: usize = 304;

pub fn encode(o: &Observation, out: &mut [u8]) {
    assert_eq!(out.len(), ENCODING_SIZE, "buffer de codificación de largo incorrecto");
    out.fill(0);
    for (slot, c) in o.hand.iter().enumerate() {
        out[OFF_HAND + slot * 40 + c.id() as usize] = 1;
    }
    for b in 0..3 {
        if let Some(slot) = o.my_played[b] {
            out[OFF_SLOT_PLAYED + slot] = 1;
            out[OFF_MY_PLAYED + b * 3 + slot] = 1;
        }
        if let Some(c) = o.opp_played[b] {
            out[OFF_OPP_PLAYED + b * 40 + c.id() as usize] = 1;
        }
        if let Some(r) = o.baza_results[b] {
            let i = match r {
                RelResult::Mine => 0,
                RelResult::Theirs => 1,
                RelResult::Parda => 2,
            };
            out[OFF_BAZA_RES + b * 3 + i] = 1;
        }
    }
    out[OFF_BAZA + o.baza.min(2)] = 1;
    out[OFF_MANO] = o.is_mano as u8;
    out[OFF_TRUCO_LEVEL + (o.truco_level - 1) as usize] = 1;
    if let Some((level, mine)) = o.truco_pending {
        out[OFF_TRUCO_PENDING + (level - 2) as usize * 2 + (!mine) as usize] = 1;
    }
    if let Some(mine) = o.truco_holder {
        out[OFF_TRUCO_HOLDER + (!mine) as usize] = 1;
    }
    for (i, call) in o.envido_calls.iter().enumerate() {
        if let Some((kind, mine)) = call {
            let k = match kind {
                EnvidoKind::Envido => 0,
                EnvidoKind::Real => 1,
                EnvidoKind::Falta => 2,
            };
            out[OFF_ENVIDO_CALLS + i * 3 + k] = 1;
            out[OFF_ENVIDO_CALLER + i] = *mine as u8;
        }
    }
    let status = match o.envido_status {
        EnvidoStatus::NotPlayed => 0,
        EnvidoStatus::Pending => 1,
        EnvidoStatus::Accepted => 2,
        EnvidoStatus::Declined => 3,
    };
    out[OFF_ENVIDO_STATUS + status] = 1;
    out[OFF_MY_TANTOS] = o.my_tantos;
    if let Some(t) = o.opp_revealed_tantos {
        out[OFF_OPP_TANTOS] = t;
        out[OFF_OPP_TANTOS_KNOWN] = 1;
    }
    out[OFF_MY_SCORE] = o.my_score;
    out[OFF_OPP_SCORE] = o.opp_score;
    out[OFF_BUENAS] = (o.my_score >= BUENAS) as u8;
    out[OFF_BUENAS + 1] = (o.opp_score >= BUENAS) as u8;
}

pub fn feature_scale() -> Vec<f32> {
    let mut s = vec![1.0; ENCODING_SIZE];
    s[OFF_MY_TANTOS] = 1.0 / 33.0;
    s[OFF_OPP_TANTOS] = 1.0 / 33.0;
    s[OFF_MY_SCORE] = 1.0 / 30.0;
    s[OFF_OPP_SCORE] = 1.0 / 30.0;
    s
}
```

`engine/src/truco/deal.rs`:
```rust
//! Reparto al azar y adaptador del truco al trait Game.
use super::actions;
use super::encode::{encode, feature_scale, ENCODING_SIZE};
use super::state::{TrucoState, TARGET};
use crate::cards::{full_deck, Card};
use crate::game::{Action, ActionMask, Game, Node, Player};
use rand::seq::SliceRandom;
use rand::{Rng, RngCore};

pub fn deal(rng: &mut dyn RngCore) -> [[Card; 3]; 2] {
    let mut deck = full_deck();
    deck.shuffle(rng);
    [[deck[0], deck[1], deck[2]], [deck[3], deck[4], deck[5]]]
}

/// Puntaje inicial para entrenar: 30% de las manos arrancan 0 a 0, el resto uniforme en [0, 29]².
pub fn sample_scores(rng: &mut dyn RngCore) -> [u8; 2] {
    if rng.gen_bool(0.3) {
        [0, 0]
    } else {
        [rng.gen_range(0..TARGET), rng.gen_range(0..TARGET)]
    }
}

/// Una mano de truco vista como `Game`: `None` = todavía no se repartió (nodo de azar).
#[derive(Clone, Copy, Debug)]
pub struct TrucoGame(pub Option<TrucoState>);

impl TrucoGame {
    pub fn state(&self) -> &TrucoState {
        self.0.as_ref().expect("todavía no se repartió")
    }
}

impl Game for TrucoGame {
    const NUM_ACTIONS: usize = actions::NUM_ACTIONS;
    const ENCODING_SIZE: usize = ENCODING_SIZE;

    fn root() -> Self {
        TrucoGame(None)
    }

    fn node(&self) -> Node {
        match &self.0 {
            None => Node::Chance,
            Some(s) if s.is_over() => Node::Terminal,
            Some(s) => Node::Decision(s.turn()),
        }
    }

    fn sample_chance(&self, rng: &mut dyn RngCore) -> Self {
        let hands = deal(rng);
        let mano = rng.gen_range(0..2);
        let scores = sample_scores(rng);
        TrucoGame(Some(TrucoState::new_hand(hands, mano, scores)))
    }

    fn legal_actions(&self) -> ActionMask {
        self.state().legal_actions()
    }

    fn apply(&mut self, a: Action) {
        self.0.as_mut().expect("todavía no se repartió").apply(a)
    }

    fn returns(&self) -> [f32; 2] {
        self.state().returns()
    }

    fn encode(&self, p: Player, out: &mut [u8]) {
        encode(&self.state().observation(p), out)
    }

    fn feature_scale() -> Vec<f32> {
        feature_scale()
    }
}
```

Reemplazar `engine/src/truco/mod.rs` por:
```rust
//! Truco argentino 1 contra 1, a 30, sin flor.
pub mod actions;
pub mod deal;
pub mod encode;
mod envido_calls;
pub mod observation;
pub mod state;
mod truco_calls;

pub use actions::*;
pub use deal::*;
pub use encode::{encode, feature_scale, ENCODING_SIZE};
pub use observation::*;
pub use state::*;
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine`
Expected: todo en verde (`truco_observation`: 4 passed; `truco_random_play`: 2 passed).

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): truco observation, 304-byte encoding and Game adapter"
```

---

### Task 10: Agentes — al azar y heurístico

**En criollo:** dos rivales simples. El "al azar" elige cualquier jugada legal; es el control. El heurístico juega como un jugador "de reglas fijas": canta envido con 27 o más, canta truco si tiene dos cartas altas, tira la carta más baja que gana la baza... Es la vara principal para medir si el bot aprendió algo.

**Files:**
- Create: `engine/src/agents.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod agents;`)
- Test: `engine/tests/agents.rs`

**Interfaces:**
- Consumes: `Observation`, constantes de acciones, `actions_of`, `bit`.
- Produces: `trait Agent: Send { fn name(&self) -> String; fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action; }`, `RandomAgent`, `HeuristicAgent`, `fn is_high(card: Card) -> bool` (rango ≥ 10).

- [ ] **Step 1: Tests que fallan**

`engine/tests/agents.rs`:
```rust
mod truco_common;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_common::*;
use truco_engine::agents::{Agent, HeuristicAgent, RandomAgent};
use truco_engine::truco::*;

fn heur(s: &TrucoState) -> usize {
    let mut rng = SmallRng::seed_from_u64(0);
    HeuristicAgent.act(&s.observation(s.turn()), &mut rng)
}

#[test]
fn heuristic_envido_thresholds() {
    assert_eq!(heur(&new("7E 6E 1C", "12O 11O 4B")), REAL_ENVIDO, "33 tantos");
    assert_eq!(heur(&new("7E 1E 4C", "12O 11O 4B")), ENVIDO, "28 tantos");
    let pending = play(new("12O 11O 4B", "6E 1E 4C"), &[ENVIDO]);
    assert_eq!(heur(&pending), QUIERO, "27 >= 26");
    let pending = play(new("12O 11O 4B", "5E 1E 4C"), &[ENVIDO]);
    assert_eq!(heur(&pending), QUIERO, "26 >= 26");
    let pending = play(new("12O 11O 4B", "4E 1E 5C"), &[ENVIDO]);
    assert_eq!(heur(&pending), NO_QUIERO, "25 < 26");
}

#[test]
fn heuristic_truco_with_two_high_cards() {
    // Palos distintos: 3 de tantos, no canta envido. Dos cartas altas (1E, 3O): canta truco.
    let s = new("1E 3O 12C", "4C 5B 6O");
    assert_eq!(heur(&s), TRUCO);
}

#[test]
fn heuristic_answers_truco() {
    let s = play(new("4C 5B 6O", "1E 11O 12C"), &[TRUCO]);
    assert_eq!(heur(&s), QUIERO, "tiene una carta alta");
    let s = play(new("1E 7E 3C", "4C 5B 12O"), &[TRUCO]);
    assert_eq!(heur(&s), NO_QUIERO);
}

#[test]
fn heuristic_plays_lowest_winning_card() {
    // El pie tiene una sola carta alta (7O) y 7 de tantos: no canta nada, juega.
    let s = play(new("12C 11B 4E", "7O 2B 4C"), &[JUGAR0]); // el mano tiró el 12C
    assert_eq!(heur(&s), JUGAR1, "2B es la más baja que le gana al 12C");
    let s = play(new("1E 12C 11B", "3E 2O 4C"), &[JUGAR0]); // tiró el 1E
    assert_eq!(heur(&s), JUGAR2, "si no puede ganar, tira la más baja");
}

#[test]
fn heuristic_leads_lowest_in_first_baza() {
    let s = new("1E 12C 4C", "3E 2O 5C");
    assert_eq!(heur(&s), JUGAR2);
}

#[test]
fn random_agent_only_plays_legal() {
    let mut rng = SmallRng::seed_from_u64(3);
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    for _ in 0..200 {
        let a = RandomAgent.act(&s.observation(1), &mut rng);
        assert_ne!(s.legal_actions() & (1 << a), 0);
    }
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test agents`
Expected: error de compilación (no existe `agents`).

- [ ] **Step 3: Implementación**

`engine/src/agents.rs`:
```rust
//! Agentes que juegan al truco a partir de una Observation.
use crate::cards::Card;
use crate::game::{actions_of, bit, Action};
use crate::truco::*;
use rand::{Rng, RngCore};

pub trait Agent: Send {
    fn name(&self) -> String;
    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action;
}

/// Elige cualquier jugada legal con la misma probabilidad.
pub struct RandomAgent;

impl Agent for RandomAgent {
    fn name(&self) -> String {
        "random".into()
    }

    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action {
        let acts: Vec<Action> = actions_of(obs.legal).collect();
        assert!(!acts.is_empty(), "le pidieron jugar sin acciones legales");
        acts[rng.gen_range(0..acts.len())]
    }
}

/// Carta alta = un 3 o mejor.
pub fn is_high(card: Card) -> bool {
    card.rank() >= 10
}

/// Jugador de reglas fijas (ver spec, sección 3.3, y las precisiones del Plan 1).
pub struct HeuristicAgent;

impl HeuristicAgent {
    fn high_unplayed(o: &Observation) -> usize {
        (0..3)
            .filter(|&slot| !o.my_played.contains(&Some(slot)) && is_high(o.hand[slot]))
            .count()
    }

    fn play_card(o: &Observation) -> Action {
        // Slots sin jugar, de la carta más fuerte a la más débil.
        let unplayed: Vec<usize> = (0..3).filter(|&s| o.legal & bit(JUGAR0 + s) != 0).collect();
        let weakest = *unplayed.last().expect("sin cartas para jugar");
        if let Some(opp) = o.opp_played[o.baza] {
            return match unplayed.iter().rev().find(|&&s| o.hand[s].rank() > opp.rank()) {
                Some(&s) => JUGAR0 + s,
                None => JUGAR0 + weakest,
            };
        }
        if o.baza == 0 {
            JUGAR0 + weakest
        } else {
            JUGAR0 + unplayed[0]
        }
    }
}

impl Agent for HeuristicAgent {
    fn name(&self) -> String {
        "heuristic".into()
    }

    fn act(&mut self, o: &Observation, _rng: &mut dyn RngCore) -> Action {
        let can = |a: Action| o.legal & bit(a) != 0;
        let envido_call = |t: u8| if t >= 30 { REAL_ENVIDO } else { ENVIDO };

        if o.envido_status == EnvidoStatus::Pending {
            return if o.my_tantos >= 26 { QUIERO } else { NO_QUIERO };
        }
        if o.truco_pending.is_some() {
            if can(ENVIDO) && o.my_tantos >= 27 {
                return envido_call(o.my_tantos);
            }
            return if Self::high_unplayed(o) >= 1 { QUIERO } else { NO_QUIERO };
        }
        if can(ENVIDO) && o.my_tantos >= 27 {
            return envido_call(o.my_tantos);
        }
        for a in [TRUCO, RETRUCO, VALE_CUATRO] {
            if can(a) && Self::high_unplayed(o) >= 2 {
                return a;
            }
        }
        Self::play_card(o)
    }
}
```

En `engine/src/lib.rs` agregar: `pub mod agents;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test agents`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): random and heuristic agents"
```

---

### Task 11: Partidos a 30 y formato duplicado

**En criollo:** hasta acá jugábamos manos sueltas. Ahora jugamos **partidos completos a 30**, alternando quién es mano, y guardamos todo lo que pasó (para el análisis posterior). También armamos el **formato duplicado**: el mismo partido se juega dos veces con las cartas intercambiadas, así la suerte del reparto se compensa.

**Files:**
- Create: `engine/src/match_runner.rs`
- Modify: `engine/src/lib.rs` (agregar `pub mod match_runner;`)
- Test: `engine/tests/match_runner.rs`

**Interfaces:**
- Consumes: `Agent`, `RandomAgent`, `HeuristicAgent`, `TrucoState`, `deal`.
- Produces: `HandRecord { mano: Player, start_scores: [u8; 2], hands: [[Card; 3]; 2], actions: Vec<(Player, Action)>, points: [u8; 2] }` (todo indexado por **asiento**); `MatchResult { winner: Player, final_scores: [u8; 2], hands: Vec<HandRecord> }` (por asiento); `play_match(seats: [&mut dyn Agent; 2], deal_seed: u64, rng: &mut dyn RngCore) -> MatchResult`; `play_duplicate(a: &mut dyn Agent, b: &mut dyn Agent, deal_seed: u64, rng: &mut dyn RngCore) -> DuplicateResult { a_as_seat0: MatchResult, a_as_seat1: MatchResult }` con `a_wins(&self) -> u32` (0, 1 o 2).

- [ ] **Step 1: Tests que fallan**

`engine/tests/match_runner.rs`:
```rust
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::agents::{HeuristicAgent, RandomAgent};
use truco_engine::match_runner::{play_duplicate, play_match};
use truco_engine::truco::TARGET;

#[test]
fn match_ends_with_one_winner_at_30() {
    let mut rng = SmallRng::seed_from_u64(1);
    let (mut a, mut b) = (RandomAgent, RandomAgent);
    let r = play_match([&mut a, &mut b], 42, &mut rng);
    assert_eq!(r.final_scores[r.winner], TARGET);
    assert!(r.final_scores[1 - r.winner] < TARGET);
    for (k, h) in r.hands.iter().enumerate() {
        assert_eq!(h.mano, k % 2, "el mano se alterna");
    }
    let total: u32 = r.hands.iter().map(|h| (h.points[0] + h.points[1]) as u32).sum();
    assert_eq!(total, (r.final_scores[0] + r.final_scores[1]) as u32);
}

#[test]
fn duplicate_uses_same_deals_by_seat() {
    let mut rng = SmallRng::seed_from_u64(2);
    let (mut a, mut b) = (HeuristicAgent, RandomAgent);
    let d = play_duplicate(&mut a, &mut b, 99, &mut rng);
    let n = d.a_as_seat0.hands.len().min(d.a_as_seat1.hands.len());
    for k in 0..n {
        assert_eq!(d.a_as_seat0.hands[k].hands, d.a_as_seat1.hands[k].hands);
    }
    assert!(d.a_wins() <= 2);
}

#[test]
fn heuristic_beats_random() {
    let mut rng = SmallRng::seed_from_u64(3);
    let (mut h, mut r) = (HeuristicAgent, RandomAgent);
    let mut wins = 0;
    for seed in 0..100 {
        wins += play_duplicate(&mut h, &mut r, seed, &mut rng).a_wins();
    }
    let rate = wins as f64 / 200.0;
    assert!(rate >= 0.8, "el heurístico ganó solo el {:.0}%", rate * 100.0);
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test match_runner`
Expected: error de compilación (no existe `match_runner`).

- [ ] **Step 3: Implementación**

`engine/src/match_runner.rs`:
```rust
//! Partidos completos a 30 y formato duplicado.
use crate::agents::Agent;
use crate::cards::Card;
use crate::game::{bit, Action, Player};
use crate::truco::{deal, TrucoState, ACTION_NAMES, TARGET};
use rand::rngs::SmallRng;
use rand::{RngCore, SeedableRng};

/// Una mano jugada. Todo indexado por asiento (0 o 1).
#[derive(Clone, Debug)]
pub struct HandRecord {
    pub mano: Player,
    pub start_scores: [u8; 2],
    pub hands: [[Card; 3]; 2],
    pub actions: Vec<(Player, Action)>,
    pub points: [u8; 2],
}

#[derive(Clone, Debug)]
pub struct MatchResult {
    pub winner: Player,
    pub final_scores: [u8; 2],
    pub hands: Vec<HandRecord>,
}

pub struct DuplicateResult {
    pub a_as_seat0: MatchResult,
    pub a_as_seat1: MatchResult,
}

impl DuplicateResult {
    pub fn a_wins(&self) -> u32 {
        (self.a_as_seat0.winner == 0) as u32 + (self.a_as_seat1.winner == 1) as u32
    }
}

/// El reparto de la mano `k` depende solo de `deal_seed` y `k`, nunca de cómo jueguen los agentes.
fn deal_for(deal_seed: u64, k: u64) -> [[Card; 3]; 2] {
    let mut rng = SmallRng::seed_from_u64(deal_seed ^ k.wrapping_mul(0x9E37_79B9_7F4A_7C15));
    deal(&mut rng)
}

pub fn play_match(seats: [&mut dyn Agent; 2], deal_seed: u64, rng: &mut dyn RngCore) -> MatchResult {
    let mut seats = seats;
    let mut scores = [0u8; 2];
    let mut hands = Vec::new();
    for k in 0u64.. {
        let dealt = deal_for(deal_seed, k);
        let mano = (k % 2) as Player;
        let mut s = TrucoState::new_hand(dealt, mano, scores);
        let mut actions = Vec::new();
        while !s.is_over() {
            let p = s.turn();
            let a = seats[p].act(&s.observation(p), rng);
            assert!(
                s.legal_actions() & bit(a) != 0,
                "el agente {} eligió una acción ilegal: {}",
                seats[p].name(),
                ACTION_NAMES.get(a).unwrap_or(&"?")
            );
            actions.push((p, a));
            s.apply(a);
        }
        hands.push(HandRecord {
            mano,
            start_scores: scores,
            hands: [s.hand(0), s.hand(1)],
            actions,
            points: s.points(),
        });
        scores = [s.score(0), s.score(1)];
        if let Some(winner) = (0..2).find(|&p| scores[p] >= TARGET) {
            return MatchResult { winner, final_scores: scores, hands };
        }
    }
    unreachable!()
}

pub fn play_duplicate(
    a: &mut dyn Agent,
    b: &mut dyn Agent,
    deal_seed: u64,
    rng: &mut dyn RngCore,
) -> DuplicateResult {
    let a_as_seat0 = play_match([&mut *a, &mut *b], deal_seed, rng);
    let a_as_seat1 = play_match([&mut *b, &mut *a], deal_seed, rng);
    DuplicateResult { a_as_seat0, a_as_seat1 }
}
```

En `engine/src/lib.rs` agregar: `pub mod match_runner;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test match_runner`
Expected: `3 passed`. Si `heuristic_beats_random` falla, **no bajar el umbral**: imprimir algunos partidos (`dbg!(&r.hands[0])`) y revisar si hay un bug en el heurístico o en las reglas.

- [ ] **Step 5: Commit**

```bash
git add engine
git commit -m "feat(engine): full matches to 30 and duplicate format"
```

---

### Task 12: MLP en Rust y formato de pesos `TCFRW1`

**En criollo:** la red neuronal, pero solo la parte de "usarla" (el forward): entran los 304 números y salen 12 valores, uno por jugada. El entrenamiento lo hace PyTorch en la GPU (Plan 2), que después guarda los pesos en un archivo con un formato simple que definimos acá. Rust lo lee para usar la red durante el entrenamiento y en el navegador.

**Files:**
- Create: `engine/src/mlp.rs`, `docs/weights-format.md`
- Modify: `engine/src/lib.rs` (agregar `pub mod mlp;`)
- Test: `engine/tests/mlp.rs`

**Interfaces:**
- Produces: `Mlp` con `new(layers: Vec<Layer>, input_scale: Vec<f32>) -> Mlp`, `random(sizes: &[usize], input_scale: Vec<f32>, rng: &mut dyn RngCore) -> Mlp`, `from_bytes(&[u8]) -> Result<Mlp, String>`, `to_bytes() -> Vec<u8>`, `input_size()`, `output_size()`, `forward(x: &[u8], out: &mut [f32])`; `Layer { inp: usize, out: usize, w: Vec<f32> /* [out][inp] por filas */, b: Vec<f32> }`; `MAGIC: [u8; 8] = *b"TCFRW1\0\0"`.

**Formato `TCFRW1`** (todo little-endian): `magic[8]` · `u32 n_layers` · `u32 input_size` · `f32 input_scale[input_size]` · por cada capa: `u32 in` · `u32 out` · `f32 w[out*in]` (por filas: fila = neurona de salida) · `f32 b[out]`. Hay ReLU entre capas; la última es lineal.

- [ ] **Step 1: Tests que fallan**

`engine/tests/mlp.rs`:
```rust
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::mlp::{Layer, Mlp};

fn tiny() -> Mlp {
    Mlp::new(
        vec![
            Layer { inp: 2, out: 2, w: vec![1.0, -1.0, 0.5, 2.0], b: vec![0.0, -1.0] },
            Layer { inp: 2, out: 1, w: vec![1.0, 1.0], b: vec![0.5] },
        ],
        vec![1.0, 0.5],
    )
}

#[test]
fn forward_known_value() {
    // entrada escalada [2, 2]; oculta = relu([0, 4]); salida = 0 + 4 + 0.5
    let mut out = [0.0f32; 1];
    tiny().forward(&[2, 4], &mut out);
    assert!((out[0] - 4.5).abs() < 1e-6, "salida {}", out[0]);
}

#[test]
fn bytes_roundtrip() {
    let m = tiny();
    let back = Mlp::from_bytes(&m.to_bytes()).unwrap();
    let (mut a, mut b) = ([0.0f32; 1], [0.0f32; 1]);
    m.forward(&[3, 7], &mut a);
    back.forward(&[3, 7], &mut b);
    assert_eq!(a, b);
    assert_eq!(back.input_size(), 2);
    assert_eq!(back.output_size(), 1);
}

#[test]
fn rejects_bad_files() {
    let bytes = tiny().to_bytes();
    let mut bad = bytes.clone();
    bad[0] = b'X';
    assert!(Mlp::from_bytes(&bad).is_err(), "magic incorrecto");
    assert!(Mlp::from_bytes(&bytes[..bytes.len() - 3]).is_err(), "archivo truncado");
    let mut extra = bytes.clone();
    extra.push(0);
    assert!(Mlp::from_bytes(&extra).is_err(), "bytes de sobra");
}

#[test]
fn random_has_requested_shape() {
    let mut rng = SmallRng::seed_from_u64(0);
    let m = Mlp::random(&[304, 64, 12], vec![1.0; 304], &mut rng);
    let mut out = [0.0f32; 12];
    m.forward(&[1u8; 304], &mut out);
    assert!(out.iter().all(|x| x.is_finite()));
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cargo test -p truco-engine --test mlp`
Expected: error de compilación (no existe `mlp`).

- [ ] **Step 3: Implementación**

`engine/src/mlp.rs`:
```rust
//! Perceptrón multicapa: solo el forward, con pesos en formato TCFRW1 (ver docs/weights-format.md).
use rand::{Rng, RngCore};

pub const MAGIC: [u8; 8] = *b"TCFRW1\0\0";

#[derive(Clone, Debug)]
pub struct Layer {
    pub inp: usize,
    pub out: usize,
    /// Pesos por filas: `w[o * inp + i]`.
    pub w: Vec<f32>,
    pub b: Vec<f32>,
}

#[derive(Clone, Debug)]
pub struct Mlp {
    layers: Vec<Layer>,
    input_scale: Vec<f32>,
}

impl Mlp {
    pub fn new(layers: Vec<Layer>, input_scale: Vec<f32>) -> Mlp {
        assert!(!layers.is_empty(), "red sin capas");
        assert_eq!(layers[0].inp, input_scale.len(), "input_scale no coincide con la primera capa");
        for pair in layers.windows(2) {
            assert_eq!(pair[0].out, pair[1].inp, "capas encadenadas con tamaños distintos");
        }
        for l in &layers {
            assert_eq!(l.w.len(), l.inp * l.out);
            assert_eq!(l.b.len(), l.out);
        }
        Mlp { layers, input_scale }
    }

    /// Pesos uniformes en [-0.1, 0.1]: solo para benchmarks y tests.
    pub fn random(sizes: &[usize], input_scale: Vec<f32>, rng: &mut dyn RngCore) -> Mlp {
        let layers = sizes
            .windows(2)
            .map(|w| Layer {
                inp: w[0],
                out: w[1],
                w: (0..w[0] * w[1]).map(|_| rng.gen_range(-0.1..0.1)).collect(),
                b: (0..w[1]).map(|_| rng.gen_range(-0.1..0.1)).collect(),
            })
            .collect();
        Mlp::new(layers, input_scale)
    }

    pub fn input_size(&self) -> usize {
        self.layers[0].inp
    }

    pub fn output_size(&self) -> usize {
        self.layers.last().unwrap().out
    }

    pub fn forward(&self, x: &[u8], out: &mut [f32]) {
        assert_eq!(x.len(), self.input_size());
        assert_eq!(out.len(), self.output_size());
        let mut cur: Vec<f32> = x.iter().zip(&self.input_scale).map(|(&v, &s)| v as f32 * s).collect();
        let last = self.layers.len() - 1;
        for (li, l) in self.layers.iter().enumerate() {
            let mut next = l.b.clone();
            for (o, acc) in next.iter_mut().enumerate() {
                let row = &l.w[o * l.inp..(o + 1) * l.inp];
                *acc += row.iter().zip(&cur).map(|(w, v)| w * v).sum::<f32>();
                if li != last {
                    *acc = acc.max(0.0);
                }
            }
            cur = next;
        }
        out.copy_from_slice(&cur);
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(&MAGIC);
        v.extend_from_slice(&(self.layers.len() as u32).to_le_bytes());
        v.extend_from_slice(&(self.input_scale.len() as u32).to_le_bytes());
        self.input_scale.iter().for_each(|f| v.extend_from_slice(&f.to_le_bytes()));
        for l in &self.layers {
            v.extend_from_slice(&(l.inp as u32).to_le_bytes());
            v.extend_from_slice(&(l.out as u32).to_le_bytes());
            l.w.iter().chain(&l.b).for_each(|f| v.extend_from_slice(&f.to_le_bytes()));
        }
        v
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Mlp, String> {
        let mut r = Reader { bytes, pos: 0 };
        if r.take(8)? != MAGIC {
            return Err("no es un archivo TCFRW1".into());
        }
        let n_layers = r.u32()? as usize;
        let input_size = r.u32()? as usize;
        let input_scale = r.f32s(input_size)?;
        let mut layers = Vec::with_capacity(n_layers);
        for _ in 0..n_layers {
            let inp = r.u32()? as usize;
            let out = r.u32()? as usize;
            let w = r.f32s(inp * out)?;
            let b = r.f32s(out)?;
            layers.push(Layer { inp, out, w, b });
        }
        if r.pos != bytes.len() {
            return Err(format!("sobran {} bytes al final", bytes.len() - r.pos));
        }
        if layers.is_empty() || layers[0].inp != input_size {
            return Err("capas inconsistentes con input_size".into());
        }
        if layers.windows(2).any(|p| p[0].out != p[1].inp) {
            return Err("capas encadenadas con tamaños distintos".into());
        }
        Ok(Mlp { layers, input_scale })
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.pos.checked_add(n).filter(|&e| e <= self.bytes.len()).ok_or("archivo truncado")?;
        let s = &self.bytes[self.pos..end];
        self.pos = end;
        Ok(s)
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn f32s(&mut self, n: usize) -> Result<Vec<f32>, String> {
        let raw = self.take(n.checked_mul(4).ok_or("tamaño inválido")?)?;
        Ok(raw.chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect())
    }
}
```

`docs/weights-format.md`:
````markdown
# Formato de pesos TCFRW1

Archivo binario, todo little-endian:

| Campo | Tipo | Descripción |
|---|---|---|
| magic | 8 bytes | `TCFRW1\0\0` |
| n_layers | u32 | cantidad de capas lineales |
| input_size | u32 | tamaño de la entrada (304 en el truco) |
| input_scale | f32 × input_size | factor por el que se multiplica cada byte de entrada |
| por capa: in | u32 | entradas |
| por capa: out | u32 | salidas |
| por capa: w | f32 × out·in | pesos por filas (`w[o*in + i]`), igual que `torch.nn.Linear.weight` |
| por capa: b | f32 × out | sesgos |

ReLU entre capas; la última capa es lineal. No puede sobrar ningún byte.

Escritura desde PyTorch (referencia para el Plan 2):

```python
import struct
import numpy as np

def write_tcfrw1(path, linears, input_scale):
    with open(path, "wb") as f:
        f.write(b"TCFRW1\0\0")
        f.write(struct.pack("<II", len(linears), len(input_scale)))
        f.write(np.asarray(input_scale, dtype="<f4").tobytes())
        for lin in linears:
            w = lin.weight.detach().cpu().numpy().astype("<f4")
            b = lin.bias.detach().cpu().numpy().astype("<f4")
            f.write(struct.pack("<II", w.shape[1], w.shape[0]))
            f.write(w.tobytes(order="C"))
            f.write(b.tobytes())
```
````

En `engine/src/lib.rs` agregar: `pub mod mlp;`

- [ ] **Step 4: Correr y ver que pasa**

Run: `cargo test -p truco-engine --test mlp`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add engine docs/weights-format.md
git commit -m "feat(engine): MLP forward pass and TCFRW1 weights format"
```

---

### Task 13: Benchmark de velocidad

**En criollo:** medimos cuántas manos por segundo juega el motor y cuánto tarda la red en decidir una jugada. Con esos números elegimos, en el Plan 2, cuántas manos simular por iteración y de qué tamaño hacer la red para que el entrenamiento entre en una noche.

**Files:**
- Create: `engine/examples/bench.rs`
- Create: `docs/benchmarks.md` (resultados)

**Interfaces:**
- Consumes: `TrucoGame`, `Game`, `actions_of`, `Mlp::random`, `feature_scale`, `ENCODING_SIZE`, `NUM_ACTIONS`.

- [ ] **Step 1: Escribir el benchmark**

`engine/examples/bench.rs`:
```rust
//! cargo run --release -p truco-engine --example bench
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use std::time::Instant;
use truco_engine::game::{actions_of, Game, Node};
use truco_engine::mlp::Mlp;
use truco_engine::truco::{feature_scale, TrucoGame, ENCODING_SIZE, NUM_ACTIONS};

fn main() {
    let mut rng = SmallRng::seed_from_u64(1);

    let hands = 500_000;
    let mut nodes = 0u64;
    let t = Instant::now();
    for _ in 0..hands {
        let mut g = TrucoGame::root().sample_chance(&mut rng);
        while let Node::Decision(_) = g.node() {
            let acts: Vec<_> = actions_of(g.legal_actions()).collect();
            g.apply(acts[rng.gen_range(0..acts.len())]);
            nodes += 1;
        }
    }
    let secs = t.elapsed().as_secs_f64();
    println!(
        "motor (1 hilo): {:.0} manos/s, {:.0} decisiones/s, {:.1} decisiones por mano",
        hands as f64 / secs,
        nodes as f64 / secs,
        nodes as f64 / hands as f64
    );

    let mut x = [0u8; ENCODING_SIZE];
    TrucoGame::root().sample_chance(&mut rng).encode(0, &mut x);
    for width in [128usize, 256] {
        let mlp = Mlp::random(&[ENCODING_SIZE, width, width, width, NUM_ACTIONS], feature_scale(), &mut rng);
        let mut out = [0f32; NUM_ACTIONS];
        let n = 50_000;
        let t = Instant::now();
        for _ in 0..n {
            mlp.forward(&x, &mut out);
        }
        let us = t.elapsed().as_secs_f64() * 1e6 / n as f64;
        println!("MLP 3×{width}: {us:.1} µs por forward (1 hilo), checksum {:.3}", out[0]);
    }
}
```

- [ ] **Step 2: Correr**

Run: `cargo run --release -p truco-engine --example bench`
Expected: tres líneas de resultados. Como referencia, se espera más de 1 M de decisiones por segundo en el motor y menos de 100 µs por forward con la red de 256.

- [ ] **Step 3: Anotar resultados**

Crear `docs/benchmarks.md` con la salida textual del comando, la fecha y la máquina (RTX 5070 Ti, 8 hilos, 31 GB). Agregar una línea de estimación: `recorridos/s ≈ 8 hilos × 1e6 / (µs_forward × nodos_por_recorrido)`, con `nodos_por_recorrido` estimado en 150. Esa cifra es la que va a usar el Plan 2.

- [ ] **Step 4: Commit**

```bash
git add engine/examples docs/benchmarks.md
git commit -m "perf(engine): engine and MLP benchmark"
```

---

## Cierre del Plan 1

Al terminar:
- `cargo test -p truco-engine` en verde.
- `cargo clippy -p truco-engine -- -D warnings` sin advertencias. Si hay, se arreglan en un commit `chore: clippy`.
- `docs/benchmarks.md` con números reales.

Con esto se escribe el **Plan 2 (entrenamiento con Deep CFR)**, usando el benchmark para fijar `K` y el tamaño de la red.
