# Plan 4: web jugable con el modelo real y publicación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que en la web se juegue contra el bot entrenado de verdad (motor Rust compilado a WASM, en un Web Worker), con resultados, curva y manos destacadas reales, tests de punta a punta, modelo exportado para Hugging Face, README, CI y borradores del post y del video, todo listo para publicar cuando el usuario dé el OK.

**Architecture:** un crate nuevo `engine-wasm` arma, a partir del estado del motor, el JSON con la forma exacta de `TableView` que ya usa la web (así la web deja de tener reglas propias) y maneja el partido a 30 (humano en el asiento 0, bot en el 1). Se compila con `wasm-bindgen` a `web/src/engine/pkg/` (versionado, para que el deploy no necesite Rust). La web lo corre en un Worker que agrega la pausa de "pensar" y habla con la página por mensajes; `GameSource` gana estados de carga y error, nueva mano y nuevo partido. Los datos de `eval/results` y del entrenamiento se convierten con un binario Rust (`web-data`) a JSON que importan las páginas; las repeticiones se re-simulan con el mismo motor.

**Tech Stack:** Rust 1.99 (edition 2021), wasm-bindgen 0.2.129, serde/serde_json; Vite 8 + React 19 + TypeScript 7, Vitest 5, Playwright; Python 3.12 + PyTorch (exportación a safetensors y ONNX); GitHub Actions y GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-13-truco-cfr-design.md`

## Global Constraints

- Juego: truco argentino 1 contra 1, a 30, sin flor, "reglas de bar" (las del motor; la web no tiene reglas propias al terminar este plan).
- Costo cero: nada pago. Deploy estático gratis en GitHub Pages (el spec decía Vercel por defecto; GitHub Pages evita sumar otra cuenta, porque el código ya va a GitHub). Sin servidores, sin API keys.
- Sin bots de terceros: los rivales son el azar, el heurístico propio y Claude Haiku (ya jugado en el Plan 3).
- Textos de la web en español rioplatense con voseo. README en inglés, con una sección "Cómo funciona" también en español.
- Crédito visible del arte: "Card art by Jose Angel Canabal"; `web/public/cards/LICENSE-ART.md` tiene que llegar al build. El arte de las cartas no es MIT.
- El bot "piensa" entre 400 y 900 ms antes de cada jugada (pausa artificial en el Worker). La inferencia en sí: menos de 300 ms por jugada.
- El sitio entero (dist) pesa menos de 5 MB. Se juega en un celular de 360 px de ancho; en escritorio (1366×768 y 1920×1080) sin scroll.
- Modelo: `models/strategy.tcfrw` (SHA-256 `194e1f83f8ccfe4a3842b5d3d00e6ba7c4f84007393bf8933827120a4a2219f7`), jugado con `PolicyKind::Strategy` (muestrea de la política). No se copia al repo en otro lado: la web lo copia a `web/public/models/` al compilar (ignorado por git).
- Versiones fijas: `wasm-bindgen = "=0.2.129"` y `wasm-bindgen-cli` 0.2.129 (tienen que coincidir exacto).
- Publicar (push, Hugging Face, deploy) y mergear a main: solo con OK explícito del usuario. Ninguna tarea de 1 a 8 publica nada.
- Todos los comandos se corren en WSL: desde Windows, `wsl -d Ubuntu --exec bash -lc "cd ~/projects/truco-cfr/.worktrees/plan-4-web && ..."`. Commits con `git commit -F <archivo>`, terminados en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Verificación al cerrar cada tarea que toque Rust: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test`. Cada tarea que toque la web: `cd web && npm test` y `npm run build`.
- La identidad de git es la del usuario (ya configurada). No tocar los otros worktrees.

## Review Focus

1. **Clics durante la pausa del bot o doble clic** sobre una carta: no tienen que llegar al motor como jugada ilegal ni romper la partida; se ignoran. Test: `web/src/engine/session.test.ts` ("ignora una acción que ya no es legal") en la Tarea 3.
2. **El partido termina en mitad de una mano** (un envido o una falta lleva a alguien a 30): la vista tiene que mostrar el ganador del partido, rechazar "nueva mano" y ofrecer "Nuevo partido". Tests: `engine-wasm/src/controller.rs` ("partido_que_termina_con_el_envido") en la Tarea 2 y `Mesa.test.tsx` ("fin de partido") en la Tarea 3.
3. **El bot es mano en la mano nueva**: tiene que jugar solo apenas empieza la mano (y al iniciar el partido), sin esperar un clic. Test: `session.test.ts` ("el bot juega primero cuando es mano") en la Tarea 3.
4. **Deploy en una subcarpeta** (GitHub Pages sirve en `/truco-cfr/`): el modelo, el Worker, el WASM y el favicon tienen que cargar igual. Tests: `engineSource.test.ts` ("modelUrl con base relativa") en la Tarea 3, `index-html.test.ts` en la Tarea 4 y el e2e servido en `/truco-cfr/` en la Tarea 6.
5. **El modelo no carga** (404, archivo corrupto): la página muestra un error con "Reintentar" en lugar de quedarse en "Cargando" para siempre. Tests: `session.test.ts` ("un modelo inválido manda un error") y `Jugar.test.tsx` ("error y reintentar") en la Tarea 3.

---

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `engine-wasm/Cargo.toml`, `Cargo.toml` (raíz) | 1 | Crate nuevo en el workspace |
| `engine-wasm/src/view.rs` | 1 | Estado del motor → `TableView` (JSON) visto por un asiento |
| `engine-wasm/src/mood.rs` | 1 | Humor de Fosfo: farol, descubierto, gana, pierde |
| `engine-wasm/src/controller.rs` | 2 | Partido a 30: humano contra bot, manos encadenadas, rayos X |
| `engine-wasm/src/lib.rs` | 1, 2 | Módulos y API `#[wasm_bindgen]` (`WasmMatch`) |
| `scripts/build-wasm.sh`, `web/src/engine/pkg/*` | 2 | Compilar a WASM; paquete generado y versionado |
| `web/src/engine/{protocol,session,worker,createWorker,engineSource}.ts` | 3 | Worker del motor y `GameSource` real |
| `web/src/game/source.ts`, `web/src/game/session.ts` | 3 | Contrato con carga, error, nueva mano, nuevo partido |
| `web/src/table/{types,result,validate}.ts` | 3 | `result` y `matchWinner` en `TableView` |
| `web/src/pages/Jugar.tsx`, `components/Mesa.tsx`, `audio/useGameSounds.ts`, `components/Nav.tsx`, `App.tsx` | 3, 4 | Integración y pulido |
| `web/src/game/{demo,rules}.ts` (+tests) | 3 | Se borran |
| `web/scripts/sync-model.ts` | 3 | Copia el modelo a `public/models/` |
| `eval/src/highlights.rs`, `eval/src/main.rs` | 5 | Manos destacadas elegidas por rival |
| `train/scripts/export_curves.py`, `train/configs/minitruco.toml` | 5 | Curva de aprendizaje y explotabilidad a `eval/results/` |
| `engine-wasm/src/replay.rs`, `engine-wasm/src/bin/web-data.rs` | 5 | `eval/results` → `web/src/data/real/*.json` |
| `web/src/data/real.ts`, páginas | 5 | Las páginas usan datos reales |
| `web/e2e/*`, `web/playwright.config.ts`, `web/scripts/check-size.ts` | 6 | Tests de punta a punta y presupuesto de tamaño |
| `train/scripts/export_hf.py`, `train/tests/test_hf_export.py`, `hf/README.md`, `web/src/engine/parity.test.ts` | 7 | Exportación a Hugging Face y paridad |
| `README.md`, `LICENSE`, `.github/workflows/*`, `docs/linkedin/*` | 8 | Documentación, CI, deploy, post y guion |

---

### Task 1: crate `engine-wasm` con la vista de la mesa y el humor del bot

La web hoy dibuja un `TableView` (ver `web/src/table/types.ts`). Esta tarea hace que el motor Rust lo produzca: dado un `TrucoState` y el asiento que mira, arma la misma estructura y la serializa a JSON con los mismos nombres de campos. También define el humor de la mascota.

**Files:**
- Modify: `Cargo.toml` (raíz)
- Create: `engine-wasm/Cargo.toml`, `engine-wasm/src/lib.rs`, `engine-wasm/src/view.rs`, `engine-wasm/src/mood.rs`

**Interfaces:**
- Consumes: `truco_engine::truco::{TrucoState, BazaResult, EnvidoKind, EnvidoStatus, ACTION_NAMES, TARGET, ...}`, `TrucoState::observation(p)`, `truco_engine::agents::is_high`, `truco_engine::game::{actions_of, other, Action, Player}`, `truco_engine::policy::Probs`.
- Produces (los usan las Tareas 2 y 5):
  - `mood::Mood` (`Neutral | Farol | Descubierto | Gana | Pierde`) con `fn name(self) -> &'static str`.
  - `mood::is_bluff(s: &TrucoState, bot: Player, a: Action) -> bool` (se llama ANTES de aplicar `a`).
  - `mood::end_mood(points: [u8; 2], bot: Player, bluffed: bool) -> Mood`.
  - `view::ViewExtra { xray: Option<Probs>, mood: Mood, reveal_bot_hand: bool }`.
  - `view::table_view(s: &TrucoState, viewer: Player, extra: &ViewExtra) -> TableView` (`TableView: Serialize`, camelCase).
  - `view::card_label(c: Card) -> String` ("4 de espada").

- [ ] **Step 1: crear el crate y sumarlo al workspace**

`Cargo.toml` (raíz), reemplazar las líneas de `members` y `default-members`:

```toml
members = ["engine", "engine-py", "eval", "engine-wasm"]
# `cargo test` / `cargo build` en la raíz tocan el motor, la evaluación y el puente a la web; engine-py se compila con maturin.
default-members = ["engine", "eval", "engine-wasm"]
```

`engine-wasm/Cargo.toml`:

```toml
[package]
name = "truco-engine-wasm"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
# cdylib para el navegador; rlib para los tests nativos y el binario web-data.
crate-type = ["cdylib", "rlib"]

[dependencies]
truco-engine = { path = "../engine" }
rand = { version = "0.8", features = ["small_rng"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
wasm-bindgen = "=0.2.129"

[target.'cfg(target_arch = "wasm32")'.dependencies]
# rand usa getrandom; en el navegador los números al azar salen de crypto.getRandomValues.
getrandom = { version = "0.2", features = ["js"] }
```

`engine-wasm/src/lib.rs`:

```rust
//! El motor en el navegador: la mesa como la ve la web y el partido contra el bot.
pub mod mood;
pub mod view;
```

- [ ] **Step 2: escribir los tests del humor (fallan: el módulo no existe)**

`engine-wasm/src/mood.rs` (solo el bloque de tests por ahora, con el `use super::*;`):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use truco_engine::cards::Card;

    fn h(a: &str, b: &str, c: &str) -> [Card; 3] {
        [a, b, c].map(|s| Card::parse(s).expect("carta"))
    }

    #[test]
    fn envido_con_siete_o_menos_es_farol() {
        // el bot es el asiento 1: 4E 5B 6O = 6 tantos
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(is_bluff(&s, 1, ENVIDO));
        assert!(is_bluff(&s, 1, FALTA_ENVIDO));
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("7E", "6E", "4B")], 1, [0, 0]);
        assert!(!is_bluff(&s, 1, ENVIDO), "33 tantos no es farol");
    }

    #[test]
    fn truco_sin_cartas_altas_es_farol() {
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(is_bluff(&s, 1, TRUCO));
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("1E", "4B", "5O")], 1, [0, 0]);
        assert!(!is_bluff(&s, 1, TRUCO), "con el ancho de espada no es farol");
    }

    #[test]
    fn despues_de_jugar_la_carta_alta_el_truco_es_farol() {
        let mut s = TrucoState::new_hand([h("4C", "5C", "6C"), h("1E", "4B", "5O")], 1, [0, 0]);
        s.apply(JUGAR0); // el bot (mano) juega el 1 de espada
        s.apply(JUGAR0); // el humano juega su carta más alta y pierde la baza
        assert_eq!(s.turn(), 1);
        assert!(is_bluff(&s, 1, TRUCO));
    }

    #[test]
    fn jugar_una_carta_o_responder_no_es_farol() {
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(!is_bluff(&s, 1, JUGAR0));
        assert!(!is_bluff(&s, 1, MAZO));
    }

    #[test]
    fn humor_al_terminar_la_mano() {
        assert_eq!(end_mood([0, 3], 1, false), Mood::Gana);
        assert_eq!(end_mood([2, 0], 1, true), Mood::Descubierto);
        assert_eq!(end_mood([2, 0], 1, false), Mood::Pierde);
        assert_eq!(end_mood([2, 2], 1, true), Mood::Neutral);
        assert_eq!(Mood::Descubierto.name(), "descubierto");
    }
}
```

- [ ] **Step 3: correr y ver que falla**

Run: `cargo test -p truco-engine-wasm mood 2>&1 | tail -5`
Expected: error de compilación (`is_bluff`, `end_mood`, `Mood` no existen).

- [ ] **Step 4: implementar el humor** (arriba del bloque de tests en `mood.rs`)

```rust
//! El humor de Fosfo, la mascota del bot. Sale de lo que hizo el bot en la mano.
use truco_engine::agents::is_high;
use truco_engine::game::{other, Action, Player};
use truco_engine::truco::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mood {
    Neutral,
    Farol,
    Descubierto,
    Gana,
    Pierde,
}

impl Mood {
    /// El nombre que usa la web (`MOODS` en web/src/table/types.ts).
    pub fn name(self) -> &'static str {
        match self {
            Mood::Neutral => "neutral",
            Mood::Farol => "farol",
            Mood::Descubierto => "descubierto",
            Mood::Gana => "gana",
            Mood::Pierde => "pierde",
        }
    }
}

/// ¿El canto `a` del `bot` es un farol? Se mira ANTES de aplicarlo: envido con 7 tantos o menos,
/// o truco, retruco o vale cuatro sin ninguna carta alta (un 3 o mejor) entre las que le quedan.
pub fn is_bluff(s: &TrucoState, bot: Player, a: Action) -> bool {
    match a {
        ENVIDO | REAL_ENVIDO | FALTA_ENVIDO => s.tantos(bot) <= 7,
        TRUCO | RETRUCO | VALE_CUATRO => {
            let played = s.played(bot);
            let hand = s.hand(bot);
            !(0..3).any(|slot| !played.contains(&Some(slot)) && is_high(hand[slot]))
        }
        _ => false,
    }
}

/// Humor al terminar la mano según los puntos que sumó cada uno en ella.
pub fn end_mood(points: [u8; 2], bot: Player, bluffed: bool) -> Mood {
    let (b, h) = (points[bot], points[other(bot)]);
    if b > h {
        Mood::Gana
    } else if h > b && bluffed {
        Mood::Descubierto
    } else if h > b {
        Mood::Pierde
    } else {
        Mood::Neutral
    }
}
```

- [ ] **Step 5: correr y ver que pasa**

Run: `cargo test -p truco-engine-wasm mood 2>&1 | tail -5`
Expected: 5 passed.

- [ ] **Step 6: escribir los tests de la vista (fallan)**

`engine-wasm/src/view.rs`, bloque de tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use truco_engine::truco::*;

    fn h(a: &str, b: &str, c: &str) -> [Card; 3] {
        [a, b, c].map(|s| Card::parse(s).expect("carta"))
    }

    fn plain() -> ViewExtra {
        ViewExtra { xray: None, mood: Mood::Neutral, reveal_bot_hand: false }
    }

    fn start() -> TrucoState {
        TrucoState::new_hand([h("4B", "1E", "7O"), h("5O", "3C", "6B")], 0, [3, 5])
    }

    fn js(s: &TrucoState, viewer: Player) -> Value {
        serde_json::to_value(table_view(s, viewer, &plain())).unwrap()
    }

    #[test]
    fn inicio_de_mano_visto_por_el_mano() {
        let v = js(&start(), 0);
        assert_eq!(
            v,
            json!({
                "hand": [
                    { "card": { "suit": "espada", "number": 1 }, "played": false },
                    { "card": { "suit": "oro", "number": 7 }, "played": false },
                    { "card": { "suit": "basto", "number": 4 }, "played": false }
                ],
                "tricks": [],
                "score": [3, 5],
                "mano": "yo",
                "truco": { "acceptedLevel": 1, "pending": null },
                "envido": { "calls": [], "pending": null, "reveal": null },
                "actions": ["jugar0", "jugar1", "jugar2", "envido", "realEnvido", "faltaEnvido", "truco", "mazo"],
                "mood": "neutral",
                "phase": "jugando"
            })
        );
    }

    #[test]
    fn el_que_no_juega_no_tiene_acciones() {
        let v = js(&start(), 1);
        assert_eq!(v["actions"], json!([]));
        assert_eq!(v["mano"], json!("bot"));
        assert_eq!(v["score"], json!([5, 3]));
    }

    #[test]
    fn una_baza_jugada() {
        let mut s = start();
        s.apply(JUGAR0); // 1 de espada
        s.apply(JUGAR0); // 3 de copa
        let v = js(&s, 0);
        assert_eq!(
            v["tricks"],
            json!([{ "mine": { "suit": "espada", "number": 1 }, "bot": { "suit": "copa", "number": 3 }, "winner": "yo" }])
        );
        assert_eq!(v["hand"][0]["played"], json!(true));
        let v1 = js(&s, 1);
        assert_eq!(v1["tricks"][0]["winner"], json!("bot"), "visto del otro lado");
    }

    #[test]
    fn baza_a_medio_jugar() {
        let mut s = start();
        s.apply(JUGAR1); // 7 de oro
        let v = js(&s, 1);
        assert_eq!(
            v["tricks"],
            json!([{ "mine": null, "bot": { "suit": "oro", "number": 7 }, "winner": null }])
        );
    }

    #[test]
    fn truco_pendiente() {
        let mut s = start();
        s.apply(TRUCO);
        let v = js(&s, 1);
        assert_eq!(v["truco"], json!({ "acceptedLevel": 1, "pending": { "call": "truco", "by": "bot" } }));
        let actions: Vec<String> = serde_json::from_value(v["actions"].clone()).unwrap();
        for a in ["quiero", "noQuiero", "retruco"] {
            assert!(actions.contains(&a.to_string()), "falta {a} en {actions:?}");
        }
        assert_eq!(js(&s, 0)["truco"]["pending"]["by"], json!("yo"));
    }

    #[test]
    fn envido_querido_son_buenas() {
        let mut s = start();
        s.apply(ENVIDO); // el mano (7 tantos) canta
        let v = js(&s, 1);
        assert_eq!(v["envido"]["pending"], json!({ "by": "bot" }));
        s.apply(QUIERO); // el pie (6 tantos) quiere y pierde: "son buenas"
        let v = js(&s, 0);
        assert_eq!(
            v["envido"],
            json!({ "calls": [{ "call": "envido", "by": "yo" }], "pending": null, "reveal": { "yo": 7, "bot": null } })
        );
        assert_eq!(v["score"], json!([5, 5]));
    }

    #[test]
    fn fin_de_mano_y_de_partido() {
        // el bot tiene 28: el humano se va al mazo antes del envido y le da 2
        let mut s = TrucoState::new_hand([h("4B", "1E", "7O"), h("5O", "3C", "6B")], 0, [3, 28]);
        s.apply(MAZO);
        let v = js(&s, 0);
        assert_eq!(v["phase"], json!("finDeMano"));
        assert_eq!(v["actions"], json!([]));
        assert_eq!(v["score"], json!([3, 30]));
        assert_eq!(v["result"], json!({ "yo": 0, "bot": 2, "winner": "bot" }));
        assert_eq!(v["matchWinner"], json!("bot"));
        assert_eq!(v["botHand"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn fin_de_mano_sin_fin_de_partido() {
        let mut s = start();
        s.apply(MAZO);
        let v = js(&s, 0);
        assert_eq!(v["result"], json!({ "yo": 0, "bot": 2, "winner": "bot" }));
        assert!(v.get("matchWinner").is_none());
    }

    #[test]
    fn rayos_x_solo_con_probabilidad() {
        let mut probs = [0.0f32; 12];
        probs[JUGAR0] = 0.75;
        probs[TRUCO] = 0.25;
        let extra = ViewExtra { xray: Some(probs), mood: Mood::Farol, reveal_bot_hand: true };
        let v = serde_json::to_value(table_view(&start(), 0, &extra)).unwrap();
        assert_eq!(v["xray"], json!([{ "action": "jugar0", "prob": 0.75 }, { "action": "truco", "prob": 0.25 }]));
        assert_eq!(v["mood"], json!("farol"));
        assert_eq!(v["botHand"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn etiqueta_de_carta() {
        assert_eq!(card_label(Card::parse("12C").unwrap()), "12 de copa");
    }
}
```

- [ ] **Step 7: correr y ver que falla**

Run: `cargo test -p truco-engine-wasm view 2>&1 | tail -5`
Expected: error de compilación (`table_view` no existe).

- [ ] **Step 8: implementar la vista** (arriba de los tests en `view.rs`)

```rust
//! La mesa vista por un jugador, con la misma forma que `TableView` de la web
//! (web/src/table/types.ts). El que mira es "yo"; el otro asiento es "bot".
use crate::mood::Mood;
use serde::Serialize;
use truco_engine::cards::{Card, Suit};
use truco_engine::game::{actions_of, other, Player};
use truco_engine::policy::Probs;
use truco_engine::truco::{BazaResult, EnvidoKind, EnvidoStatus, TrucoState, ACTION_NAMES, TARGET};

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct CardView {
    pub suit: &'static str,
    pub number: u8,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HandCard {
    pub card: CardView,
    pub played: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct TrickView {
    pub mine: Option<CardView>,
    pub bot: Option<CardView>,
    /// "yo", "bot", "parda" o null si la baza no se definió.
    pub winner: Option<&'static str>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Call {
    pub call: &'static str,
    pub by: &'static str,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrucoView {
    pub accepted_level: u8,
    pub pending: Option<Call>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Pending {
    pub by: &'static str,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Reveal {
    pub yo: Option<u8>,
    pub bot: Option<u8>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct EnvidoView {
    pub calls: Vec<Call>,
    pub pending: Option<Pending>,
    pub reveal: Option<Reveal>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct XRayEntry {
    pub action: &'static str,
    pub prob: f32,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HandResult {
    pub yo: u8,
    pub bot: u8,
    /// Quien sumó más puntos en la mano; null si sumaron lo mismo.
    pub winner: Option<&'static str>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableView {
    pub hand: Vec<HandCard>,
    pub tricks: Vec<TrickView>,
    pub score: [u8; 2],
    pub mano: &'static str,
    pub truco: TrucoView,
    pub envido: EnvidoView,
    pub actions: Vec<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xray: Option<Vec<XRayEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_hand: Option<Vec<CardView>>,
    pub mood: &'static str,
    pub phase: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<HandResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_winner: Option<&'static str>,
}

/// Lo que la vista no puede sacar del estado: la última decisión del bot, su humor y si se
/// muestran sus cartas (al terminar la mano siempre se muestran).
pub struct ViewExtra {
    pub xray: Option<Probs>,
    pub mood: Mood,
    pub reveal_bot_hand: bool,
}

fn suit_name(s: Suit) -> &'static str {
    match s {
        Suit::Espada => "espada",
        Suit::Basto => "basto",
        Suit::Oro => "oro",
        Suit::Copa => "copa",
    }
}

pub fn card_view(c: Card) -> CardView {
    CardView { suit: suit_name(c.suit()), number: c.number() }
}

/// "4 de espada": para los textos de las repeticiones.
pub fn card_label(c: Card) -> String {
    format!("{} de {}", c.number(), suit_name(c.suit()))
}

fn envido_name(k: EnvidoKind) -> &'static str {
    match k {
        EnvidoKind::Envido => "envido",
        EnvidoKind::Real => "realEnvido",
        EnvidoKind::Falta => "faltaEnvido",
    }
}

fn truco_name(level: u8) -> &'static str {
    match level {
        2 => "truco",
        3 => "retruco",
        4 => "valeCuatro",
        _ => unreachable!("nivel de truco inválido: {level}"),
    }
}

pub fn table_view(s: &TrucoState, viewer: Player, extra: &ViewExtra) -> TableView {
    let rival = other(viewer);
    let seat = |p: Player| if p == viewer { "yo" } else { "bot" };
    let by = |mine: bool| if mine { "yo" } else { "bot" };
    let obs = s.observation(viewer);
    let over = s.is_over();

    let hand = s.hand(viewer);
    let played = s.played(viewer);
    let hand_view = (0..3)
        .map(|i| HandCard { card: card_view(hand[i]), played: played.contains(&Some(i)) })
        .collect();

    let rival_hand = s.hand(rival);
    let rival_played = s.played(rival);
    let mut tricks = Vec::new();
    for b in 0..3 {
        let mine = played[b].map(|slot| card_view(hand[slot]));
        let theirs = rival_played[b].map(|slot| card_view(rival_hand[slot]));
        if mine.is_none() && theirs.is_none() {
            break;
        }
        let winner = s.baza_results()[b].map(|r| match r {
            BazaResult::Won(p) => seat(p),
            BazaResult::Parda => "parda",
        });
        tricks.push(TrickView { mine, bot: theirs, winner });
    }

    let calls: Vec<Call> = obs
        .envido_calls
        .iter()
        .flatten()
        .map(|&(k, mine)| Call { call: envido_name(k), by: by(mine) })
        .collect();
    let envido_pending = if s.envido_status() == EnvidoStatus::Pending {
        calls.last().map(|c| Pending { by: c.by })
    } else {
        None
    };
    let revealed = s.revealed_tantos();
    let reveal = if revealed.iter().any(Option::is_some) {
        Some(Reveal { yo: revealed[viewer], bot: revealed[rival] })
    } else {
        None
    };

    let actions = if !over && s.turn() == viewer {
        actions_of(s.legal_actions()).map(|a| ACTION_NAMES[a]).collect()
    } else {
        Vec::new()
    };

    let xray = extra.xray.map(|p| {
        (0..ACTION_NAMES.len())
            .filter(|&a| p[a] > 0.0)
            .map(|a| XRayEntry { action: ACTION_NAMES[a], prob: p[a] })
            .collect()
    });

    let points = s.points();
    let result = over.then(|| HandResult {
        yo: points[viewer],
        bot: points[rival],
        winner: match points[viewer].cmp(&points[rival]) {
            std::cmp::Ordering::Greater => Some("yo"),
            std::cmp::Ordering::Less => Some("bot"),
            std::cmp::Ordering::Equal => None,
        },
    });
    let match_winner = [viewer, rival].into_iter().find(|&p| s.score(p) >= TARGET).map(seat);

    TableView {
        hand: hand_view,
        tricks,
        score: [s.score(viewer), s.score(rival)],
        mano: seat(s.mano()),
        truco: TrucoView {
            accepted_level: s.truco_level(),
            pending: obs.truco_pending.map(|(level, mine)| Call { call: truco_name(level), by: by(mine) }),
        },
        envido: EnvidoView { calls, pending: envido_pending, reveal },
        actions,
        xray,
        bot_hand: (over || extra.reveal_bot_hand).then(|| rival_hand.iter().map(|&c| card_view(c)).collect()),
        mood: extra.mood.name(),
        phase: if over { "finDeMano" } else { "jugando" },
        result,
        match_winner,
    }
}
```

Nota: `s.played(p)[b]` es la ranura de la mano que jugó `p` en la baza `b` (ver `engine/src/truco/state.rs`, campo `played`). Las bazas se juegan en orden, así que el primer `b` sin cartas corta la lista.

- [ ] **Step 9: correr y ver que pasa**

Run: `cargo test -p truco-engine-wasm 2>&1 | tail -5`
Expected: 15 passed (5 de humor y 10 de vista). Si `inicio_de_mano_visto_por_el_mano` falla por el orden de la mano, revisar el criterio de `TrucoState::new_hand` (ordena por jerarquía, la más alta primero) antes de tocar el test.

- [ ] **Step 10: fmt, clippy, tests de todo el workspace**

Run: `cargo fmt && cargo clippy --workspace --all-targets -- -D warnings 2>&1 | tail -3 && cargo test 2>&1 | grep -E '^test result' | tail -8`
Expected: sin warnings; todos los `test result: ok`.

- [ ] **Step 11: commit**

```bash
git add Cargo.toml Cargo.lock engine-wasm
git commit -F /tmp/msg-t1.txt   # "feat(engine-wasm): vista de la mesa (TableView) y humor del bot desde el motor"
```

---

### Task 2: partido contra el bot y API WASM

Un partido a 30: el humano en el asiento 0 y el bot en el 1, el mano alterna mano a mano (la primera al azar), el bot juega con la red y deja sus probabilidades para los rayos X. Se expone a JavaScript con `wasm-bindgen` y se compila a `web/src/engine/pkg/`.

**Files:**
- Create: `engine-wasm/src/controller.rs`, `scripts/build-wasm.sh`, `web/src/engine/pkg/` (generado), `web/src/engine/wasm.test.ts`, `.gitattributes`
- Modify: `engine-wasm/src/lib.rs`

**Interfaces:**
- Consumes: `view::{table_view, ViewExtra, TableView}`, `mood::{Mood, is_bluff, end_mood}` (Tarea 1); `truco_engine::mlp::Mlp`, `truco_engine::mlp_agent::MlpAgent`, `truco_engine::policy::{sample_action, PolicyKind, Probs}`, `truco_engine::truco::{deal, TrucoState, ENCODING_SIZE, NUM_ACTIONS}`.
- Produces:
  - Rust: `controller::{HUMAN, BOT, Match}` con `Match::new(net: Mlp, seed: u64) -> Result<Match, String>`, `view(&self) -> TableView`, `bot_to_move(&self) -> bool`, `act(&mut self, a: Action) -> Result<(), String>`, `bot_step(&mut self) -> Result<Action, String>`, `new_hand(&mut self) -> Result<(), String>`, `new_match(&mut self, seed: u64)`, `match_winner(&self) -> Option<Player>`, `state(&self) -> &TrucoState`, `logits(&self, x: &[u8]) -> Result<Vec<f32>, String>`.
  - JS (`web/src/engine/pkg/truco_engine_wasm.js`): `default init()`, `initSync({ module })`, `class WasmMatch { constructor(model: Uint8Array, seed: number); view(): string; botToMove(): boolean; act(action: number): string; botStep(): string; newHand(): string; newMatch(seed: number): string; logits(features: Uint8Array): Float32Array; free(): void }`. Todas las vistas son JSON de `TableView`. Los errores llegan como excepciones de JS.

- [ ] **Step 1: instalar el compilador de wasm-bindgen (gratis, una sola vez)**

Run: `rustup target list --installed | grep wasm32-unknown-unknown && (wasm-bindgen --version 2>/dev/null || cargo install wasm-bindgen-cli --version 0.2.129 --locked 2>&1 | tail -2) && wasm-bindgen --version`
Expected: `wasm32-unknown-unknown` y `wasm-bindgen 0.2.129`.

- [ ] **Step 2: escribir los tests del partido (fallan)**

`engine-wasm/src/controller.rs`, bloque de tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::SmallRng;
    use rand::{Rng, SeedableRng};
    use truco_engine::game::{actions_of, bit};
    use truco_engine::truco::feature_scale;

    fn tiny_net(seed: u64) -> Mlp {
        let mut rng = SmallRng::seed_from_u64(seed);
        Mlp::random(&[ENCODING_SIZE, 16, NUM_ACTIONS], feature_scale(), &mut rng)
    }

    /// Juega el humano al azar y el bot con la red hasta que alguien llega a 30.
    fn play_out(m: &mut Match, rng: &mut SmallRng) -> Vec<Player> {
        let mut manos = vec![m.state().mano()];
        loop {
            while m.bot_to_move() {
                m.bot_step().unwrap();
            }
            if m.state().is_over() {
                if m.match_winner().is_some() {
                    return manos;
                }
                m.new_hand().unwrap();
                manos.push(m.state().mano());
                continue;
            }
            let legal: Vec<_> = actions_of(m.state().legal_actions()).collect();
            m.act(legal[rng.gen_range(0..legal.len())]).unwrap();
        }
    }

    #[test]
    fn partidos_completos_terminan_y_el_mano_alterna() {
        let mut rng = SmallRng::seed_from_u64(1);
        for seed in 0..30 {
            let mut m = Match::new(tiny_net(seed), seed).unwrap();
            let manos = play_out(&mut m, &mut rng);
            let w = m.match_winner().unwrap();
            assert_eq!(m.state().score(w), 30);
            assert!(m.state().score(1 - w) < 30);
            for pair in manos.windows(2) {
                assert_ne!(pair[0], pair[1], "el mano tiene que alternar");
            }
            let v = m.view();
            assert_eq!(v.phase, "finDeMano");
            assert!(v.match_winner.is_some());
        }
    }

    #[test]
    fn rechaza_jugadas_fuera_de_turno_o_ilegales() {
        let mut m = Match::new(tiny_net(0), 3).unwrap();
        while m.bot_to_move() {
            m.bot_step().unwrap();
        }
        assert!(m.bot_step().is_err(), "no es el turno del bot");
        let legal = m.state().legal_actions();
        let illegal = (0..NUM_ACTIONS).find(|&a| legal & bit(a) == 0).unwrap();
        let before = m.view();
        assert!(m.act(illegal).is_err());
        assert!(m.act(99).is_err());
        assert_eq!(m.view(), before, "una jugada rechazada no cambia nada");
        assert!(m.new_hand().is_err(), "la mano no terminó");
    }

    #[test]
    fn el_bot_deja_sus_probabilidades() {
        let mut m = Match::new(tiny_net(0), 4).unwrap();
        while !m.bot_to_move() {
            let a = actions_of(m.state().legal_actions()).next().unwrap();
            m.act(a).unwrap();
        }
        m.bot_step().unwrap();
        let xray = m.view().xray.expect("rayos X después de la jugada del bot");
        let total: f32 = xray.iter().map(|e| e.prob).sum();
        assert!((total - 1.0).abs() < 1e-4, "suman {total}");
    }

    #[test]
    fn misma_semilla_mismo_partido() {
        let run = |seed| {
            let mut m = Match::new(tiny_net(9), seed).unwrap();
            let mut rng = SmallRng::seed_from_u64(0);
            play_out(&mut m, &mut rng);
            m.view()
        };
        assert_eq!(run(5), run(5));
    }

    #[test]
    fn partido_que_termina_con_el_envido() {
        let mut m = Match::new(tiny_net(0), 1).unwrap();
        // humano 28, bot 0; el humano es mano y canta falta envido con 33 tantos
        let hands = [[Card::parse("7E").unwrap(), Card::parse("6E").unwrap(), Card::parse("4B").unwrap()],
                     [Card::parse("4C").unwrap(), Card::parse("5O").unwrap(), Card::parse("6B").unwrap()]];
        m.set_hand_for_test(TrucoState::new_hand(hands, HUMAN, [28, 0]));
        m.act(FALTA_ENVIDO).unwrap();
        if m.bot_to_move() {
            // el bot contesta: si quiere, el humano gana con 33; si no quiere, suma 1 y llega a 29
            let a = m.bot_step().unwrap();
            if a == QUIERO {
                assert_eq!(m.match_winner(), Some(HUMAN));
                let v = m.view();
                assert_eq!(v.phase, "finDeMano");
                assert_eq!(v.match_winner, Some("yo"));
                assert!(m.new_hand().is_err(), "el partido terminó");
                m.new_match(2);
                assert_eq!(m.view().score, [0, 0]);
                assert!(m.view().match_winner.is_none());
            }
        }
    }

    #[test]
    fn modelo_invalido() {
        let wrong = Mlp::random(&[10, 4, 2], vec![1.0; 10], &mut SmallRng::seed_from_u64(0));
        assert!(Match::new(wrong, 0).is_err());
    }

    #[test]
    fn logits_por_fila() {
        let m = Match::new(tiny_net(0), 0).unwrap();
        let out = m.logits(&vec![0u8; ENCODING_SIZE * 2]).unwrap();
        assert_eq!(out.len(), 2 * NUM_ACTIONS);
        assert!(m.logits(&[0u8; 5]).is_err());
    }

    #[test]
    fn el_modelo_publicado_carga() {
        let bytes = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../models/strategy.tcfrw")).unwrap();
        let mut m = Match::new(Mlp::from_bytes(&bytes).unwrap(), 11).unwrap();
        let mut rng = SmallRng::seed_from_u64(0);
        play_out(&mut m, &mut rng);
        assert!(m.match_winner().is_some());
    }
}
```

- [ ] **Step 3: correr y ver que falla**

Run: `cargo test -p truco-engine-wasm controller 2>&1 | tail -5`
Expected: error de compilación (`Match` no existe).

- [ ] **Step 4: implementar el partido** (arriba de los tests en `controller.rs`; sumar `pub mod controller;` en `lib.rs`)

```rust
//! Un partido a 30 en la web: el humano en el asiento 0 contra el bot en el 1.
use crate::mood::{end_mood, is_bluff, Mood};
use crate::view::{table_view, TableView, ViewExtra};
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use std::sync::Arc;
use truco_engine::game::{bit, other, Action, Player};
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::{sample_action, PolicyKind, Probs};
use truco_engine::truco::*;

pub const HUMAN: Player = 0;
pub const BOT: Player = 1;

pub struct Match {
    net: Arc<Mlp>,
    agent: MlpAgent,
    rng: SmallRng,
    state: TrucoState,
    /// Probabilidades de la última decisión del bot en esta mano (rayos X).
    xray: Option<Probs>,
    bluffed: bool,
    mood: Mood,
}

impl Match {
    pub fn new(net: Mlp, seed: u64) -> Result<Match, String> {
        if net.input_size() != ENCODING_SIZE || net.output_size() != NUM_ACTIONS {
            return Err(format!(
                "el modelo no es de truco: espera {} entradas y {} salidas, tiene {} y {}",
                ENCODING_SIZE,
                NUM_ACTIONS,
                net.input_size(),
                net.output_size()
            ));
        }
        let net = Arc::new(net);
        let agent = MlpAgent::shared(net.clone(), PolicyKind::Strategy, "bot");
        let mut rng = SmallRng::seed_from_u64(seed);
        let mano = rng_mano(&mut rng);
        let state = Self::deal_hand(&mut rng, mano, [0, 0]);
        Ok(Match { net, agent, rng, state, xray: None, bluffed: false, mood: Mood::Neutral })
    }

    fn deal_hand(rng: &mut SmallRng, mano: Player, scores: [u8; 2]) -> TrucoState {
        TrucoState::new_hand(deal(rng), mano, scores)
    }

    pub fn state(&self) -> &TrucoState {
        &self.state
    }

    pub fn view(&self) -> TableView {
        let extra = ViewExtra { xray: self.xray, mood: self.mood, reveal_bot_hand: false };
        table_view(&self.state, HUMAN, &extra)
    }

    pub fn bot_to_move(&self) -> bool {
        !self.state.is_over() && self.state.turn() == BOT
    }

    pub fn match_winner(&self) -> Option<Player> {
        (0..2).find(|&p| self.state.score(p) >= TARGET)
    }

    fn after_move(&mut self) {
        if self.state.is_over() {
            self.mood = end_mood(self.state.points(), BOT, self.bluffed);
        }
    }

    /// Jugada del humano.
    pub fn act(&mut self, a: Action) -> Result<(), String> {
        if self.state.is_over() || self.state.turn() != HUMAN {
            return Err("no es tu turno".to_string());
        }
        if a >= NUM_ACTIONS || self.state.legal_actions() & bit(a) == 0 {
            return Err(format!("jugada ilegal: {a}"));
        }
        self.state.apply(a);
        self.after_move();
        Ok(())
    }

    /// Una jugada del bot: calcula las probabilidades con la red, muestrea y aplica.
    pub fn bot_step(&mut self) -> Result<Action, String> {
        if !self.bot_to_move() {
            return Err("no es el turno del bot".to_string());
        }
        let obs = self.state.observation(BOT);
        let probs = self.agent.probabilities(&obs);
        let a = sample_action(&probs, obs.legal, &mut self.rng);
        if is_bluff(&self.state, BOT, a) {
            self.bluffed = true;
            self.mood = Mood::Farol;
        }
        self.xray = Some(probs);
        self.state.apply(a);
        self.after_move();
        Ok(a)
    }

    /// Reparte la mano siguiente (con el marcador acumulado y el otro de mano).
    pub fn new_hand(&mut self) -> Result<(), String> {
        if !self.state.is_over() {
            return Err("la mano todavía no terminó".to_string());
        }
        if self.match_winner().is_some() {
            return Err("el partido terminó: empezá uno nuevo".to_string());
        }
        let scores = [self.state.score(0), self.state.score(1)];
        let mano = other(self.state.mano());
        self.state = Self::deal_hand(&mut self.rng, mano, scores);
        self.reset_hand_extras();
        Ok(())
    }

    /// Partido nuevo desde 0 a 0 (se puede pedir en cualquier momento).
    pub fn new_match(&mut self, seed: u64) {
        self.rng = SmallRng::seed_from_u64(seed);
        let mano = rng_mano(&mut self.rng);
        self.state = Self::deal_hand(&mut self.rng, mano, [0, 0]);
        self.reset_hand_extras();
    }

    fn reset_hand_extras(&mut self) {
        self.xray = None;
        self.bluffed = false;
        self.mood = Mood::Neutral;
    }

    /// Salida cruda de la red (para el test de paridad con PyTorch y ONNX).
    pub fn logits(&self, x: &[u8]) -> Result<Vec<f32>, String> {
        if x.is_empty() || x.len() % ENCODING_SIZE != 0 {
            return Err(format!("{} bytes no es un múltiplo de {ENCODING_SIZE}", x.len()));
        }
        let mut out = vec![0f32; x.len() / ENCODING_SIZE * NUM_ACTIONS];
        for (row, dst) in x.chunks_exact(ENCODING_SIZE).zip(out.chunks_exact_mut(NUM_ACTIONS)) {
            self.net.forward(row, dst);
        }
        Ok(out)
    }

    #[cfg(test)]
    pub(crate) fn set_hand_for_test(&mut self, s: TrucoState) {
        self.state = s;
        self.reset_hand_extras();
    }
}

fn rng_mano(rng: &mut SmallRng) -> Player {
    rng.gen_range(0..2)
}
```

El test `partido_que_termina_con_el_envido` usa `Card`: sumar `use truco_engine::cards::Card;` en el bloque de tests.

- [ ] **Step 5: correr y ver que pasa**

Run: `cargo test -p truco-engine-wasm 2>&1 | tail -5`
Expected: 23 passed.

- [ ] **Step 6: la API para JavaScript** (agregar al final de `engine-wasm/src/lib.rs`)

```rust
use controller::Match;
use truco_engine::mlp::Mlp;
use wasm_bindgen::prelude::*;

/// El partido, tal como lo usa el Worker de la web. Las vistas se devuelven como JSON de `TableView`.
#[wasm_bindgen]
pub struct WasmMatch(Match);

fn js_err(e: String) -> JsError {
    JsError::new(&e)
}

fn json(m: &Match) -> String {
    serde_json::to_string(&m.view()).expect("la vista siempre se puede serializar")
}

#[wasm_bindgen]
impl WasmMatch {
    #[wasm_bindgen(constructor)]
    pub fn new(model: &[u8], seed: u32) -> Result<WasmMatch, JsError> {
        let net = Mlp::from_bytes(model).map_err(js_err)?;
        Match::new(net, seed as u64).map(WasmMatch).map_err(js_err)
    }

    pub fn view(&self) -> String {
        json(&self.0)
    }

    #[wasm_bindgen(js_name = botToMove)]
    pub fn bot_to_move(&self) -> bool {
        self.0.bot_to_move()
    }

    pub fn act(&mut self, action: u32) -> Result<String, JsError> {
        self.0.act(action as usize).map_err(js_err)?;
        Ok(json(&self.0))
    }

    #[wasm_bindgen(js_name = botStep)]
    pub fn bot_step(&mut self) -> Result<String, JsError> {
        self.0.bot_step().map_err(js_err)?;
        Ok(json(&self.0))
    }

    #[wasm_bindgen(js_name = newHand)]
    pub fn new_hand(&mut self) -> Result<String, JsError> {
        self.0.new_hand().map_err(js_err)?;
        Ok(json(&self.0))
    }

    #[wasm_bindgen(js_name = newMatch)]
    pub fn new_match(&mut self, seed: u32) -> String {
        self.0.new_match(seed as u64);
        json(&self.0)
    }

    pub fn logits(&self, features: &[u8]) -> Result<Vec<f32>, JsError> {
        self.0.logits(features).map_err(js_err)
    }
}
```

Los `use` van arriba del archivo, junto a los `pub mod` (`pub mod controller;` ya está desde el paso 4). Correr `cargo test -p truco-engine-wasm 2>&1 | tail -3` (sigue en 23 passed; `wasm-bindgen` compila también en nativo).

- [ ] **Step 7: script de compilación a WASM**

`scripts/build-wasm.sh` (con `chmod +x`):

```bash
#!/usr/bin/env bash
# Compila engine-wasm para el navegador y deja el paquete en web/src/engine/pkg (se versiona:
# así el deploy y el CI de la web no necesitan Rust). Requiere: rustup target add wasm32-unknown-unknown
# y cargo install wasm-bindgen-cli --version 0.2.129 --locked
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-unknown-unknown -p truco-engine-wasm
rm -rf web/src/engine/pkg
wasm-bindgen --target web --out-dir web/src/engine/pkg \
  target/wasm32-unknown-unknown/release/truco_engine_wasm.wasm
rm -f web/src/engine/pkg/.gitignore
ls -l web/src/engine/pkg
```

`.gitattributes` (raíz, nuevo):

```
# Generado por scripts/build-wasm.sh
web/src/engine/pkg/** linguist-generated=true -diff
```

Run: `bash scripts/build-wasm.sh 2>&1 | tail -8`
Expected: `truco_engine_wasm.js`, `truco_engine_wasm_bg.wasm` (menos de 1 MB), `truco_engine_wasm.d.ts`, `truco_engine_wasm_bg.wasm.d.ts`. Si la compilación falla por `getrandom`, revisar que la dependencia `[target.'cfg(target_arch = "wasm32")']` de la Tarea 1 esté en `engine-wasm/Cargo.toml`.

- [ ] **Step 8: test del paquete WASM desde la web (falla antes del paso 7, pasa después)**

`web/src/engine/wasm.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initSync, WasmMatch } from './pkg/truco_engine_wasm.js';
import { validateTableView } from '../table/validate';
import type { TableView } from '../table/types';
import { actionIndex } from '../table/types';

initSync({ module: readFileSync(new URL('./pkg/truco_engine_wasm_bg.wasm', import.meta.url)) });
const model = readFileSync(new URL('../../../models/strategy.tcfrw', import.meta.url));

const parse = (json: string) => JSON.parse(json) as TableView;

describe('WasmMatch', () => {
  it('juega un partido entero con vistas válidas', () => {
    const m = new WasmMatch(model, 7);
    let view = parse(m.view());
    let steps = 0;
    for (;;) {
      expect(validateTableView(view)).toEqual([]);
      if (m.botToMove()) view = parse(m.botStep());
      else if (view.phase === 'finDeMano') {
        if (view.matchWinner) break;
        view = parse(m.newHand());
      } else view = parse(m.act(actionIndex(view.actions[0]!)));
      steps += 1;
      expect(steps).toBeLessThan(5000);
    }
    expect(view.score).toContain(30);
    expect(() => m.newHand()).toThrow();
    m.free();
  });

  it('cada jugada del bot tarda menos de 300 ms', () => {
    const m = new WasmMatch(model, 8);
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const view = parse(m.view());
      if (m.botToMove()) {
        const t = performance.now();
        m.botStep();
        worst = Math.max(worst, performance.now() - t);
      } else if (view.phase === 'finDeMano') {
        if (view.matchWinner) m.newMatch(i);
        else m.newHand();
      } else m.act(actionIndex(view.actions[0]!));
    }
    expect(worst).toBeLessThan(300);
  });

  it('rechaza un modelo inválido', () => {
    expect(() => new WasmMatch(new Uint8Array([1, 2, 3]), 0)).toThrow();
  });
});
```

Run: `cd web && npx vitest run src/engine/wasm.test.ts 2>&1 | tail -6`
Expected: 3 passed. Si `validateTableView` se queja de `result` o `matchWinner` (no existen todavía en el validador), es esperable: el validador ignora campos desconocidos; si los rechaza, registrar el error exacto en el informe y dejar el test como está (la Tarea 3 agrega los campos al tipo y al validador).

- [ ] **Step 9: verificación y commit**

Run: `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings 2>&1 | tail -2 && cargo test 2>&1 | grep -E '^test result' | tail -8 && cd web && npm test 2>&1 | tail -4`
Expected: todo verde.

```bash
git add engine-wasm scripts/build-wasm.sh .gitattributes web/src/engine
git commit -F /tmp/msg-t2.txt   # "feat(engine-wasm): partido a 30 contra el bot y API WasmMatch compilada a web/src/engine/pkg"
```

---

### Task 3: la web juega contra el motor real

Se cambia el contrato `GameSource` (carga, error, nueva mano, nuevo partido), se agrega el Worker que corre el WASM con la pausa de "pensar", y Jugar pasa a usar el bot real. Se borran el demo y las reglas en TypeScript: el resultado de la mano lo dice el motor (`view.result`, `view.matchWinner`).

**Files:**
- Create: `web/src/engine/protocol.ts`, `web/src/engine/session.ts`, `web/src/engine/session.test.ts`, `web/src/engine/worker.ts`, `web/src/engine/createWorker.ts`, `web/src/engine/engineSource.ts`, `web/src/engine/engineSource.test.ts`, `web/src/table/result.ts`, `web/src/table/result.test.ts`, `web/src/test/fakeSource.ts`, `web/src/pages/Jugar.test.tsx` (si ya existe, modificar), `web/scripts/sync-model.ts`
- Modify: `web/src/game/source.ts`, `web/src/game/session.ts`, `web/src/table/types.ts`, `web/src/table/validate.ts`, `web/src/table/fixtures.ts`, `web/src/pages/Jugar.tsx`, `web/src/components/Mesa.tsx`, `web/src/audio/useGameSounds.ts`, `web/src/components/Nav.tsx`, `web/src/App.tsx`, `web/vite.config.ts`, `web/package.json`, y los tests que usen lo que cambia (`Nav.test.tsx`, `App.test.tsx`, `Mesa.test.tsx`, `useGameSounds.test.ts`)
- Delete: `web/src/game/demo.ts`, `web/src/game/demo.test.ts`, `web/src/game/rules.ts`, `web/src/game/rules.test.ts`

**Interfaces:**
- Consumes: `WasmMatch` (Tarea 2), con la forma de `TableView` + `result` + `matchWinner` (Tarea 1).
- Produces (los usan las Tareas 4 a 6):
  - `table/types.ts`: `HandResult { yo: number; bot: number; winner: Seat | null }`; `TableView.result?: HandResult`; `TableView.matchWinner?: Seat`.
  - `game/source.ts`: `GameSnapshot`, `GameSource { getSnapshot; subscribe; dispatch; newHand; newMatch; retry }`, `useGame(source)`.
  - `game/session.ts`: `registerNewMatch(fn)`, `useNewMatch()`.
  - `engine/engineSource.ts`: `createEngineSource(makePort, seed?)`, `modelUrl(base?, page?)`, `randomSeed()`.
  - `table/result.ts`: `resultLine(view: TableView): string`, `outcomeOf(view: TableView): Seat | 'none'`.
  - `test/fakeSource.ts`: `createFakeSource(initial: GameSnapshot): FakeSource`.
  - `Mesa` props: `onNewHand?: () => void`, `onNewMatch?: () => void`.

- [ ] **Step 1: tipos nuevos y validador**

En `web/src/table/types.ts`, antes de `TableView`:

```ts
/** Puntos que sumó cada uno en la mano. `winner` = quien sumó más; `null` si sumaron lo mismo. */
export interface HandResult {
  yo: number;
  bot: number;
  winner: Seat | null;
}
```

y al final de `TableView`:

```ts
  /** Solo en finDeMano: lo que sumó cada uno en la mano (lo calcula el motor). */
  result?: HandResult;
  /** Quién llegó a 30. Solo cuando terminó el partido. */
  matchWinner?: Seat;
```

En `web/src/table/validate.ts`, antes del `return errors`:

```ts
  if (v.result && v.phase !== 'finDeMano') errors.push('result solo existe en finDeMano');
  if (v.matchWinner) {
    if (v.phase !== 'finDeMano') errors.push('matchWinner solo existe en finDeMano');
    const idx = v.matchWinner === 'yo' ? 0 : 1;
    if (v.score[idx] !== 30) errors.push(`matchWinner = ${v.matchWinner} pero tiene ${v.score[idx]} puntos`);
  }
```

Con su test en `validate.test.ts` (los casos: `result` en `jugando` da error; `matchWinner: 'yo'` con `score: [30, 4]` y `finDeMano` no da error; con `score: [29, 4]` da error). En `fixtures.ts`, a `finDeManoRayosX` agregarle `result: { yo: 0, bot: 1, winner: 'bot' }`.

- [ ] **Step 2: `table/result.ts` con su test**

`web/src/table/result.test.ts`:

```ts
import { FIXTURES } from './fixtures';
import { outcomeOf, resultLine } from './result';
import type { TableView } from './types';

const end = (extra: Partial<TableView>): TableView => ({ ...FIXTURES.finDeManoRayosX, ...extra });

describe('resultLine', () => {
  it('mano ganada, perdida y pareja', () => {
    expect(resultLine(end({ result: { yo: 3, bot: 0, winner: 'yo' } }))).toBe('Ganaste la mano: +3');
    expect(resultLine(end({ result: { yo: 2, bot: 1, winner: 'yo' } }))).toBe('Ganaste la mano: +2 (el bot +1)');
    expect(resultLine(end({ result: { yo: 1, bot: 2, winner: 'bot' } }))).toBe('Ganó el bot: +2 (vos +1)');
    expect(resultLine(end({ result: { yo: 2, bot: 2, winner: null } }))).toBe('Mano pareja: +2 cada uno');
  });
  it('fin de partido', () => {
    expect(resultLine(end({ score: [30, 12], matchWinner: 'yo', result: { yo: 2, bot: 0, winner: 'yo' } }))).toBe('¡Ganaste el partido!');
    expect(resultLine(end({ score: [8, 30], matchWinner: 'bot' }))).toBe('El bot ganó el partido');
  });
  it('sin resultado', () => {
    expect(resultLine(end({ result: undefined }))).toBe('Mano terminada');
    expect(outcomeOf(end({ result: undefined }))).toBe('none');
    expect(outcomeOf(end({ result: { yo: 0, bot: 1, winner: 'bot' } }))).toBe('bot');
    expect(outcomeOf(end({ score: [30, 0], matchWinner: 'yo', result: { yo: 0, bot: 1, winner: 'bot' } }))).toBe('yo');
  });
});
```

`web/src/table/result.ts`:

```ts
import type { Seat, TableView } from './types';

/** El cartel de fin de mano o de partido. Los puntos los calcula el motor. */
export function resultLine(view: TableView): string {
  if (view.matchWinner) return view.matchWinner === 'yo' ? '¡Ganaste el partido!' : 'El bot ganó el partido';
  const r = view.result;
  if (!r) return 'Mano terminada';
  if (r.winner === 'yo') return `Ganaste la mano: +${r.yo}${r.bot ? ` (el bot +${r.bot})` : ''}`;
  if (r.winner === 'bot') return `Ganó el bot: +${r.bot}${r.yo ? ` (vos +${r.yo})` : ''}`;
  return `Mano pareja: +${r.yo} cada uno`;
}

/** Para `data-outcome` del cartel: quién ganó el partido o, si no terminó, la mano. */
export function outcomeOf(view: TableView): Seat | 'none' {
  return view.matchWinner ?? view.result?.winner ?? 'none';
}
```

Run: `npx vitest run src/table 2>&1 | tail -4` → pasan.

- [ ] **Step 3: contrato `GameSource` y fuente falsa para tests**

`web/src/game/source.ts` (reemplazo completo):

```ts
import { useSyncExternalStore } from 'react';
import type { ActionId, TableView } from '../table/types';

export type GameSnapshot =
  | { status: 'cargando' }
  | { status: 'error'; message: string }
  | { status: 'listo'; view: TableView };

/**
 * Contrato entre la UI y quien juega la partida (en la web: un Worker con el motor en WASM).
 * Todas las funciones tienen que ser estables (no depender de `this`).
 */
export interface GameSource {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  /** Una jugada del humano. Si no está en `view.actions`, se ignora. */
  dispatch(action: ActionId): void;
  /** Reparte la mano siguiente; solo tiene efecto con la mano terminada y el partido en juego. */
  newHand(): void;
  /** Partido nuevo desde 0 a 0, en cualquier momento. */
  newMatch(): void;
  /** Vuelve a cargar el motor después de un error. */
  retry(): void;
}

export function useGame(source: GameSource): GameSnapshot {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
```

`web/src/test/fakeSource.ts`:

```ts
import type { GameSnapshot, GameSource } from '../game/source';
import type { ActionId } from '../table/types';

export interface FakeSource extends GameSource {
  set(s: GameSnapshot): void;
  /** Lo que se llamó, en orden: 'act:jugar0', 'newHand', 'newMatch', 'retry'. */
  calls: string[];
}

export function createFakeSource(initial: GameSnapshot): FakeSource {
  let snap = initial;
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  return {
    calls,
    set(s) {
      snap = s;
      listeners.forEach((l) => l());
    },
    getSnapshot: () => snap,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    dispatch: (a: ActionId) => {
      calls.push(`act:${a}`);
    },
    newHand: () => {
      calls.push('newHand');
    },
    newMatch: () => {
      calls.push('newMatch');
    },
    retry: () => {
      calls.push('retry');
    },
  };
}
```

`web/src/game/session.ts`: renombrar `registerNewHand` → `registerNewMatch` y `useNewHand` → `useNewMatch` (mismo cuerpo); actualizar el comentario ("cómo empezar un partido nuevo").

- [ ] **Step 4: protocolo y sesión del Worker, tests primero**

`web/src/engine/protocol.ts`:

```ts
import type { ActionId, TableView } from '../table/types';

/** De la página al Worker del motor. */
export type ToEngine =
  | { type: 'init'; modelUrl: string; seed: number }
  | { type: 'act'; action: ActionId }
  | { type: 'newHand' }
  | { type: 'newMatch'; seed: number };

/** Del Worker a la página. */
export type FromEngine = { type: 'view'; view: TableView } | { type: 'error'; message: string };

/** Lo que la página usa de un Worker (en los tests, un objeto falso). */
export interface EnginePort {
  postMessage(msg: ToEngine): void;
  onmessage: ((e: MessageEvent<FromEngine>) => void) | null;
  terminate(): void;
}
```

`web/src/engine/session.test.ts`:

```ts
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import type { FromEngine } from './protocol';
import { createSession, type MatchApi } from './session';

/** Un partido de mentira: el bot juega `botMoves` veces seguidas cuando le toca. */
function fakeMatch(opts: { botFirst?: boolean } = {}) {
  let botTurns = opts.botFirst ? 1 : 0;
  const log: string[] = [];
  const view = (extra: Partial<TableView> = {}) => JSON.stringify({ ...FIXTURES.inicioDeMano, ...extra });
  const api: MatchApi = {
    view: () => view(botTurns > 0 ? { actions: [] } : {}),
    botToMove: () => botTurns > 0,
    act: (a) => {
      log.push(`act:${a}`);
      botTurns = 2; // el bot canta y después juega
      return view({ actions: [] });
    },
    botStep: () => {
      botTurns -= 1;
      log.push('bot');
      return view(botTurns > 0 ? { actions: [] } : {});
    },
    newHand: () => {
      log.push('newHand');
      return view();
    },
    newMatch: (seed) => {
      log.push(`newMatch:${seed}`);
      return view();
    },
  };
  return { api, log };
}

function setup(match: MatchApi) {
  const posted: FromEngine[] = [];
  let thinks = 0;
  const handle = createSession({
    load: async () => match,
    post: (m) => posted.push(m),
    think: async () => {
      thinks += 1;
    },
  });
  return { handle, posted, thinks: () => thinks };
}

describe('sesión del motor', () => {
  it('init manda la primera vista', async () => {
    const { api } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(s.posted).toHaveLength(1);
    expect(s.posted[0]!.type).toBe('view');
  });

  it('el bot juega primero cuando es mano', async () => {
    const { api, log } = fakeMatch({ botFirst: true });
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(log).toEqual(['bot']);
    expect(s.posted).toHaveLength(2);
    expect(s.thinks()).toBe(1);
  });

  it('cada paso del bot es una vista aparte, con su pausa', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    await s.handle({ type: 'act', action: 'jugar0' });
    expect(log).toEqual(['act:0', 'bot', 'bot']);
    expect(s.posted).toHaveLength(4); // inicio, tu jugada, bot, bot
    expect(s.thinks()).toBe(2);
  });

  it('ignora una acción que ya no es legal', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    const first = s.handle({ type: 'act', action: 'jugar0' });
    const double = s.handle({ type: 'act', action: 'jugar0' }); // doble clic: llega mientras el bot piensa
    await Promise.all([first, double]);
    expect(log.filter((l) => l.startsWith('act'))).toHaveLength(1);
    expect(s.posted.some((m) => m.type === 'error')).toBe(false);
  });

  it('un modelo inválido manda un error', async () => {
    const posted: FromEngine[] = [];
    const s = createSession({
      load: async () => {
        throw new Error('modelo roto');
      },
      post: (m) => posted.push(m),
      think: async () => {},
    });
    await s({ type: 'init', modelUrl: 'x', seed: 1 });
    expect(posted).toEqual([{ type: 'error', message: 'modelo roto' }]);
  });

  it('nueva mano y nuevo partido', async () => {
    const { api, log } = fakeMatch();
    const s = setup(api);
    await s.handle({ type: 'init', modelUrl: 'x', seed: 1 });
    await s.handle({ type: 'newHand' });
    await s.handle({ type: 'newMatch', seed: 9 });
    expect(log).toEqual(['newHand', 'newMatch:9']);
  });
});
```

Run: `npx vitest run src/engine/session.test.ts 2>&1 | tail -4` → falla (no existe `session.ts`).

`web/src/engine/session.ts`:

```ts
import { actionIndex } from '../table/types';
import type { TableView } from '../table/types';
import type { FromEngine, ToEngine } from './protocol';

/** Lo que el Worker usa de `WasmMatch` (el partido en Rust). Las vistas vienen como JSON. */
export interface MatchApi {
  view(): string;
  botToMove(): boolean;
  act(action: number): string;
  botStep(): string;
  newHand(): string;
  newMatch(seed: number): string;
}

export interface SessionDeps {
  /** Crea el partido (en el Worker: bajar el modelo y construir `WasmMatch`). */
  load(modelUrl: string, seed: number): Promise<MatchApi>;
  post(msg: FromEngine): void;
  /** Pausa antes de cada jugada del bot (en el Worker, de 400 a 900 ms; en los tests, nada). */
  think(): Promise<void>;
}

/**
 * Atiende los mensajes de a uno, en orden: lo que llega mientras el bot "piensa" espera su turno.
 * Devuelve la función que recibe cada mensaje (la promesa se resuelve cuando terminó de atenderlo).
 */
export function createSession(deps: SessionDeps): (msg: ToEngine) => Promise<void> {
  let match: MatchApi | null = null;
  let queue: Promise<void> = Promise.resolve();

  const send = (json: string) => deps.post({ type: 'view', view: JSON.parse(json) as TableView });

  const botTurn = async (m: MatchApi) => {
    while (m.botToMove()) {
      await deps.think();
      send(m.botStep());
    }
  };

  const handle = async (msg: ToEngine) => {
    if (msg.type === 'init') {
      match = await deps.load(msg.modelUrl, msg.seed);
      send(match.view());
      await botTurn(match);
      return;
    }
    if (!match) throw new Error('El motor todavía no está listo');
    if (msg.type === 'act') {
      // un clic viejo (doble clic, o mientras el bot pensaba) no es un error: se ignora
      const current = JSON.parse(match.view()) as TableView;
      if (!current.actions.includes(msg.action)) return;
      send(match.act(actionIndex(msg.action)));
    } else if (msg.type === 'newHand') {
      send(match.newHand());
    } else {
      send(match.newMatch(msg.seed));
    }
    await botTurn(match);
  };

  return (msg) => {
    queue = queue
      .then(() => handle(msg))
      .catch((e: unknown) => {
        deps.post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return queue;
  };
}
```

Run: `npx vitest run src/engine/session.test.ts 2>&1 | tail -4` → 6 passed.

- [ ] **Step 5: sesión con el WASM real (test de integración)**

Agregar a `web/src/engine/wasm.test.ts` (los dos `import` nuevos van arriba, con los otros):

```ts
import { createSession } from './session';
import type { FromEngine } from './protocol';

it('la sesión juega un partido real de punta a punta', async () => {
  const posted: FromEngine[] = [];
  const handle = createSession({
    load: async (_url, seed) => new WasmMatch(model, seed),
    post: (m) => posted.push(m),
    think: async () => {},
  });
  await handle({ type: 'init', modelUrl: 'x', seed: 3 });
  for (let i = 0; i < 3000; i++) {
    const last = posted[posted.length - 1]!;
    if (last.type === 'error') throw new Error(last.message);
    const view = last.view;
    if (view.matchWinner) break;
    if (view.phase === 'finDeMano') await handle({ type: 'newHand' });
    else await handle({ type: 'act', action: view.actions[0]! });
  }
  const last = posted[posted.length - 1]!;
  expect(last.type === 'view' && last.view.matchWinner).toBeTruthy();
});
```

Run: `npx vitest run src/engine/wasm.test.ts 2>&1 | tail -4` → 4 passed.

- [ ] **Step 6: el Worker y la fuente real**

`web/src/engine/worker.ts`:

```ts
import init, { WasmMatch } from './pkg/truco_engine_wasm.js';
import type { FromEngine, ToEngine } from './protocol';
import { createSession } from './session';

const THINK_MIN_MS = 400;
const THINK_MAX_MS = 900;

// El tsconfig no carga los tipos de WebWorker (chocan con los del DOM): lo mínimo que se usa.
const ctx = self as unknown as {
  postMessage(msg: FromEngine): void;
  onmessage: ((e: MessageEvent<ToEngine>) => void) | null;
};

const handle = createSession({
  async load(modelUrl, seed) {
    await init();
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`No se pudo bajar el modelo (HTTP ${res.status})`);
    return new WasmMatch(new Uint8Array(await res.arrayBuffer()), seed);
  },
  post: (msg) => ctx.postMessage(msg),
  think: () => new Promise((r) => setTimeout(r, THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS))),
});

ctx.onmessage = (e) => {
  void handle(e.data);
};
```

`web/src/engine/createWorker.ts`:

```ts
import type { EnginePort } from './protocol';

/** El Worker del motor. Vite reconoce este patrón exacto (`new URL(..., import.meta.url)`) y lo empaqueta. */
export function createEngineWorker(): EnginePort {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as EnginePort;
}
```

`web/src/engine/engineSource.test.ts`:

```ts
import { FIXTURES } from '../table/fixtures';
import type { EnginePort, FromEngine, ToEngine } from './protocol';
import { createEngineSource, modelUrl } from './engineSource';

class FakePort implements EnginePort {
  sent: ToEngine[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<FromEngine>) => void) | null = null;
  postMessage(m: ToEngine) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  emit(m: FromEngine) {
    this.onmessage?.({ data: m } as MessageEvent<FromEngine>);
  }
}

describe('createEngineSource', () => {
  it('arranca cargando, inicia el Worker al suscribirse y pasa a listo', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 42);
    expect(src.getSnapshot()).toEqual({ status: 'cargando' });
    const off = src.subscribe(() => {});
    expect(sent[0]).toMatchObject({ type: 'init', seed: 42 });
    port.emit({ type: 'view', view: FIXTURES.inicioDeMano });
    expect(src.getSnapshot()).toEqual({ status: 'listo', view: FIXTURES.inicioDeMano });
    off();
    expect(port.terminated).toBe(true);
  });

  it('solo manda jugadas legales', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 1);
    src.subscribe(() => {});
    src.dispatch('jugar0'); // todavía cargando
    port.emit({ type: 'view', view: { ...FIXTURES.inicioDeMano, actions: ['jugar1'] } });
    src.dispatch('jugar0');
    src.dispatch('jugar1');
    expect(sent.filter((m) => m.type === 'act')).toEqual([{ type: 'act', action: 'jugar1' }]);
  });

  it('error y reintentar', () => {
    const ports = [new FakePort(), new FakePort()];
    let n = 0;
    const src = createEngineSource(() => ports[n++]!, () => 1);
    src.subscribe(() => {});
    ports[0]!.emit({ type: 'error', message: 'HTTP 404' });
    expect(src.getSnapshot()).toEqual({ status: 'error', message: 'HTTP 404' });
    src.retry();
    expect(ports[0]!.terminated).toBe(true);
    expect(src.getSnapshot()).toEqual({ status: 'cargando' });
    expect(ports[1]!.sent[0]).toMatchObject({ type: 'init' });
  });

  it('nueva mano y nuevo partido', () => {
    const port = new FakePort();
    const sent = port.sent;
    const src = createEngineSource(() => port, () => 5);
    src.subscribe(() => {});
    port.emit({ type: 'view', view: FIXTURES.finDeManoRayosX });
    src.newHand();
    src.newMatch();
    expect(sent.slice(1)).toEqual([{ type: 'newHand' }, { type: 'newMatch', seed: 5 }]);
  });

  it('modelUrl con base relativa', () => {
    expect(modelUrl('./', 'https://x.github.io/truco-cfr/index.html')).toBe(
      'https://x.github.io/truco-cfr/models/strategy.tcfrw',
    );
    expect(modelUrl('/', 'http://localhost:5173/')).toBe('http://localhost:5173/models/strategy.tcfrw');
  });
});
```

`web/src/engine/engineSource.ts`:

```ts
import type { GameSnapshot, GameSource } from '../game/source';
import type { ActionId } from '../table/types';
import type { EnginePort, FromEngine } from './protocol';

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/**
 * URL absoluta del modelo. El Worker vive en assets/, así que una ruta relativa se resolvería mal
 * ahí adentro: se resuelve acá, contra la página.
 */
export function modelUrl(base: string = import.meta.env.BASE_URL, page: string = document.baseURI): string {
  return new URL(`${base}models/strategy.tcfrw`, page).href;
}

/** La partida contra el motor en WASM. El Worker arranca con el primer suscriptor y se cierra con el último. */
export function createEngineSource(makePort: () => EnginePort, seed: () => number = randomSeed): GameSource {
  let snap: GameSnapshot = { status: 'cargando' };
  let port: EnginePort | null = null;
  const listeners = new Set<() => void>();

  const set = (s: GameSnapshot) => {
    snap = s;
    listeners.forEach((l) => l());
  };

  const start = () => {
    port?.terminate();
    const p = makePort();
    port = p;
    p.onmessage = (e: MessageEvent<FromEngine>) => {
      if (port !== p) return; // mensaje de un Worker viejo
      const msg = e.data;
      set(msg.type === 'view' ? { status: 'listo', view: msg.view } : { status: 'error', message: msg.message });
    };
    p.postMessage({ type: 'init', modelUrl: modelUrl(), seed: seed() });
  };

  const stop = () => {
    port?.terminate();
    port = null;
  };

  return {
    getSnapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      if (!port) {
        snap = { status: 'cargando' };
        start();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    dispatch(action: ActionId) {
      if (snap.status === 'listo' && snap.view.actions.includes(action)) port?.postMessage({ type: 'act', action });
    },
    newHand() {
      if (snap.status === 'listo') port?.postMessage({ type: 'newHand' });
    },
    newMatch() {
      if (snap.status === 'listo') port?.postMessage({ type: 'newMatch', seed: seed() });
    },
    retry() {
      set({ status: 'cargando' });
      start();
    },
  };
}
```

Nota: el test "modelUrl" pasa `base` y `page` explícitos; en jsdom `document.baseURI` existe.

Run: `npx vitest run src/engine 2>&1 | tail -4` → todos pasan.

- [ ] **Step 7: copiar el modelo al compilar y configurar Vite**

`web/scripts/sync-model.ts`:

```ts
// Copia la red publicada (models/strategy.tcfrw, en la raíz del repo) a public/models/ para que Vite
// la sirva. La copia no se versiona (la raíz ignora *.tcfrw salvo models/strategy.tcfrw).
import { copyFileSync, mkdirSync } from 'node:fs';

const src = new URL('../../models/strategy.tcfrw', import.meta.url);
const dir = new URL('../public/models/', import.meta.url);
mkdirSync(dir, { recursive: true });
copyFileSync(src, new URL('strategy.tcfrw', dir));
console.log('modelo copiado a public/models/strategy.tcfrw');
```

`web/package.json`, en `scripts` agregar:

```json
"sync-model": "node scripts/sync-model.ts",
"predev": "node scripts/sync-model.ts",
"prebuild": "node scripts/sync-model.ts",
```

`web/vite.config.ts`: agregar `worker: { format: 'es' },` después de `plugins: [react()],`.

Run: `cd web && npm run sync-model && git status --short public/` → no aparece nada (ignorado). Si aparece, agregar `public/models/` a `web/.gitignore`.

- [ ] **Step 8: Jugar con el motor real, Mesa y sonidos sin `rules.ts`**

`web/src/pages/Jugar.tsx` (reemplazo completo):

```tsx
import { useEffect, useMemo } from 'react';
import { useGameSounds } from '../audio/useGameSounds';
import { ConfigDialog } from '../components/ConfigDialog';
import { Mesa } from '../components/Mesa';
import { MuteButton } from '../components/MuteButton';
import { createEngineWorker } from '../engine/createWorker';
import { createEngineSource } from '../engine/engineSource';
import { registerNewMatch } from '../game/session';
import { useGame } from '../game/source';
import type { GameSource } from '../game/source';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useViewport';
import { hrefFor } from '../router';
import { useSettings } from '../settings';
import { DEFAULT_SKIN } from '../skins';
import type { TableView } from '../table/types';

/** `source` solo se pasa en los tests; en la web se crea el Worker con el motor. */
export function Jugar({ source: given }: { source?: GameSource }) {
  const source = useMemo(() => given ?? createEngineSource(createEngineWorker), [given]);
  const snap = useGame(source);

  // "Nuevo partido" también se ofrece desde el menú de arriba (fuera de la mesa)
  useEffect(() => registerNewMatch(source.newMatch), [source]);

  if (snap.status === 'cargando') {
    return (
      <article className="page">
        <h1 className="title-sr-narrow">Jugar</h1>
        <p className="banner" role="status">
          Barajando… cargando el bot (menos de 1 MB).
        </p>
      </article>
    );
  }
  if (snap.status === 'error') {
    return (
      <article className="page">
        <h1 className="title-sr-narrow">Jugar</h1>
        <p className="banner" role="alert">
          No se pudo cargar el bot: {snap.message}
        </p>
        <button type="button" className="btn btn--brasa" onClick={source.retry}>
          Reintentar
        </button>
      </article>
    );
  }
  return <Partida view={snap.view} source={source} />;
}

function Partida({ view, source }: { view: TableView; source: GameSource }) {
  const { xray } = useSettings();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const onAction = useGameSounds(view, source.dispatch);

  return (
    <article className="page">
      <h1 className="title-sr-narrow">Jugar</h1>
      <Mesa
        view={view}
        skin={DEFAULT_SKIN}
        onAction={onAction}
        onNewHand={source.newHand}
        onNewMatch={source.newMatch}
        xrayOn={xray}
        head={
          desktop ? (
            <a className="brand mesa__brand" href={hrefFor('jugar')}>
              Truco CFR
            </a>
          ) : null
        }
        tools={
          desktop ? (
            <>
              <button type="button" className="btn btn--brasa" onClick={source.newMatch}>
                Nuevo partido
              </button>
              <div className="mesa__tools-row">
                <ConfigDialog />
                <MuteButton />
              </div>
            </>
          ) : null
        }
      />
    </article>
  );
}
```

`web/src/components/Mesa.tsx`:
- Borrar el import de `handOutcome` y la función local `resultLine`; importar `{ outcomeOf, resultLine } from '../table/result'`.
- En `MesaProps` agregar `onNewMatch?: () => void;` (con comentario: "Partido nuevo: el botón aparece en el cartel cuando el partido terminó").
- El cartel queda así (mismo lugar que hoy; la Tarea 4 lo mueve):

```tsx
{ended ? (
  <div className="mesa__end" data-outcome={outcomeOf(view)}>
    <p className="mesa__end-title">{resultLine(view)}</p>
    {view.matchWinner ? (
      onNewMatch ? (
        <button type="button" className="btn btn--brasa" onClick={onNewMatch}>
          Nuevo partido
        </button>
      ) : null
    ) : onNewHand ? (
      <button type="button" className="btn btn--brasa" onClick={onNewHand}>
        Nueva mano
      </button>
    ) : null}
  </div>
) : null}
```

`web/src/audio/useGameSounds.ts`: borrar el import de `handOutcome` y reemplazar el bloque de fin de mano por:

```ts
if (p.phase !== 'finDeMano' && view.phase === 'finDeMano') {
  if (view.matchWinner === 'yo') playSfx('matchWon');
  else if (view.matchWinner === 'bot' || view.result?.winner === 'bot') playSfx('handLost');
  else if (view.result?.winner === 'yo') playSfx('handWon');
}
```

`web/src/components/Nav.tsx`: la prop `onNewHand` pasa a `onNewMatch` y el botón del cajón dice "Nuevo partido". `web/src/App.tsx`: `useNewHand` → `useNewMatch`, y `<Nav route={route} onNewMatch={route === 'jugar' ? newMatch : null} />`.

Borrar `web/src/game/demo.ts`, `demo.test.ts`, `rules.ts`, `rules.test.ts`. Después:

Run: `grep -rn "game/demo\|game/rules\|handOutcome\|registerNewHand\|useNewHand\|createDemoSource" web/src`
Expected: nada.

- [ ] **Step 9: tests de Jugar, Mesa, Nav y sonidos**

`web/src/pages/Jugar.test.tsx` (crear o reemplazar):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { FIXTURES } from '../table/fixtures';
import { createFakeSource } from '../test/fakeSource';
import { Jugar } from './Jugar';

describe('Jugar', () => {
  it('cargando', () => {
    render(<Jugar source={createFakeSource({ status: 'cargando' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('cargando el bot');
  });

  it('error y reintentar', async () => {
    const src = createFakeSource({ status: 'error', message: 'HTTP 404' });
    render(<Jugar source={src} />);
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(src.calls).toEqual(['retry']);
  });

  it('listo: la mesa juega con el motor', async () => {
    const src = createFakeSource({ status: 'cargando' });
    render(<Jugar source={src} />);
    act(() => src.set({ status: 'listo', view: FIXTURES.inicioDeMano }));
    await userEvent.click(screen.getAllByRole('button', { name: /truco/i })[0]!);
    expect(src.calls).toContain('act:truco');
    expect(screen.queryByText(/Modo demostración/)).toBeNull();
  });

  it('fin de partido ofrece nuevo partido', async () => {
    const src = createFakeSource({
      status: 'listo',
      view: { ...FIXTURES.finDeManoRayosX, score: [30, 9], matchWinner: 'yo', result: { yo: 3, bot: 0, winner: 'yo' } },
    });
    render(<Jugar source={src} />);
    expect(screen.getByText('¡Ganaste el partido!')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Nuevo partido' })[0]!);
    expect(src.calls).toContain('newMatch');
  });
});
```

En `Mesa.test.tsx`, agregar el caso "fin de partido": con `matchWinner: 'bot'`, `score: [12, 30]` y `onNewMatch`, aparece "El bot ganó el partido" y el botón "Nuevo partido" (no "Nueva mano"). Ajustar los tests que esperaban "Ganó el bot"/"Ganaste la mano" del cálculo viejo para que pasen `result`. En `Nav.test.tsx` y `App.test.tsx`, "Nueva mano" del cajón pasa a "Nuevo partido". En `useGameSounds.test.ts`, los casos de fin de mano usan `result`/`matchWinner` en lugar de bazas.

Run: `cd web && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5`
Expected: todo verde; en `dist/assets/` aparece un archivo `worker-*.js` y uno `*.wasm`.

- [ ] **Step 10: probarlo a mano en el navegador**

Run (en segundo plano): `cd web && npm run preview -- --port 4180 --strictPort`. Desde Windows, abrir `http://localhost:4180/#/jugar` (WSL tiene `networkingMode=mirrored`) con Playwright de Windows (el script de capturas del scratchpad de la sesión, `scratchpad/shots`, con `channel: 'chrome'`) o con Chrome. Jugar una mano entera: tiene que aparecer "Barajando…", después la mesa, el bot tiene que tardar algo menos de un segundo en cada jugada y al final aparece el cartel con los puntos. Sin errores en la consola. Anotar en el informe lo que se vio (y las capturas, si se sacaron). Cortar el preview al terminar.

- [ ] **Step 11: commit**

```bash
git add -A web/src web/scripts web/package.json web/vite.config.ts
git commit -F /tmp/msg-t3.txt   # "feat(web): jugar contra el bot real (Worker + WASM); GameSource con carga, error, nueva mano y nuevo partido; fuera demo.ts y rules.ts"
```

---

### Task 4: pulido de la mesa

**Files:**
- Modify: `web/src/components/Mesa.tsx`, `web/src/components/Mesa.css`, `web/src/table/sizing.ts` (si hace falta), `web/src/App.tsx`, `web/index.html`, `web/src/index-html.test.ts`, `web/src/components/Mesa.test.tsx`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `resultLine`, `outcomeOf`, `onNewMatch` (Tarea 3).
- Produces: el cartel de fin de mano vive en una franja propia del paño (clase `.mesa__end`, sigue siendo la misma), que la Tarea 6 verifica con medidas.

- [ ] **Step 1: el cartel no tapa las bazas**

Hoy `.mesa__end` es `position: absolute` centrado sobre el paño (`Mesa.css` líneas 137-152) y tapa las bazas. Pasarlo a una franja en el flujo del paño, debajo de `.mesa__bazas`:

- En `Mesa.css`: `.mesa__end` deja de ser absoluto (`position: static`), se muestra como fila (`display: flex; align-items: center; justify-content: center; gap: var(--sp-3); flex-wrap: wrap`), con el mismo fondo y borde que hoy, y el paño reserva SIEMPRE esa franja: agregar `.mesa__endslot { min-height: 48px; display: flex; align-items: center; justify-content: center; }` y en `Mesa.tsx` envolver el cartel en `<div className="mesa__endslot">…</div>` que se renderiza siempre en una mesa interactiva (vacío mientras se juega). Así no salta el layout al terminar la mano y el alto que hoy sobra en 1366×768 lo usa la franja.
- Si al reservar la franja el escritorio queda con scroll en 1366×768 o 1920×1080, restar esos 48 px en el presupuesto de alto de `table/sizing.ts` (`DESKTOP_FIXED`) y en el de celular (`MOBILE_FIXED`) si en 360×740 aparece scroll. La Tarea 6 lo mide con Playwright; acá alcanza con capturas.

Test en `Mesa.test.tsx`: en una mesa interactiva en `jugando`, existe `.mesa__endslot` vacío; en `finDeMano`, el cartel está adentro de `.mesa__endslot` y aparece después de `.mesa__bazas` en el DOM (`compareDocumentPosition` con `Node.DOCUMENT_POSITION_FOLLOWING`).

- [ ] **Step 2: "Banco de pruebas" en el pie**

La navegación de arriba queda con las 4 secciones (decisión de diseño: el banco de pruebas es para curiosos, no una sección principal). En el `<footer>` de `App.tsx`, agregar un segundo párrafo: `<p><a href={hrefFor('playground')}>Banco de pruebas</a></p>` (el enlace al código lo agrega la Tarea 9, cuando el repo exista). Test en `App.test.tsx`: el pie tiene un enlace "Banco de pruebas" con `href="#/playground"`.

- [ ] **Step 3: favicon relativo**

`web/index.html` línea 7: `href="/favicon.svg"` → `href="./favicon.svg"`. En `index-html.test.ts` agregar: ningún `href=` ni `src=` de `index.html` empieza con `/` (regex `/(href|src)="\//` no matchea).

- [ ] **Step 4: capturas de control**

Con `npm run build && npm run preview -- --port 4180 --strictPort` en segundo plano, sacar capturas desde Windows (Playwright de `scratchpad/shots`, `channel: 'chrome'`) en 360×740, 1366×768 y 1920×1080 de `#/jugar` al empezar y al terminar una mano. Revisar: el cartel no tapa ninguna baza, no hay scroll en escritorio, el texto del cartel se lee. Guardarlas en el scratchpad (no en el repo) y describirlas en el informe.

- [ ] **Step 5: verificación y commit**

Run: `cd web && npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3`

```bash
git add -A web
git commit -F /tmp/msg-t4.txt   # "fix(web): el cartel de fin de mano va en su franja; banco de pruebas en el pie; favicon relativo"
```

---

### Task 5: datos reales en las páginas

Las páginas de Resultados, Manos y Cómo funciona dejan de usar datos inventados. Fuentes: `eval/results/*.json` (Plan 3), la curva de aprendizaje de la corrida `overnight-1` (Plan 2) y una corrida nueva de MiniTruco para la explotabilidad exacta. Un binario Rust convierte todo al formato de la web; las repeticiones se re-simulan con el motor y las probabilidades del bot salen del modelo.

**Files:**
- Modify: `eval/src/highlights.rs`, `eval/src/main.rs`, `eval/tests/highlights.rs`
- Create: `train/scripts/export_curves.py`, `train/tests/test_export_curves.py`, `train/configs/minitruco.toml`
- Create: `eval/results/learning.json`, `eval/results/minitruco.json`; regenerar `eval/results/highlights.json`
- Create: `engine-wasm/src/replay.rs`, `engine-wasm/src/bin/web-data.rs`
- Create: `web/src/data/real/results.json`, `web/src/data/real/envidoCurve.json`, `web/src/data/real/highlights.json`, `web/src/data/real.ts`, `web/src/data/real.test.ts`
- Modify: `web/src/pages/Resultados.tsx`, `web/src/pages/Manos.tsx`, `web/src/pages/ComoFunciona.tsx`, sus tests; `docs/eval-report.md` (sección Manos destacadas)

**Interfaces:**
- Consumes: `view::{table_view, ViewExtra, card_label}`, `mood::{is_bluff, end_mood, Mood}` (Tarea 1); `MlpAgent::probabilities`; tipos de `web/src/data/types.ts` (`ResultsData`, `TournamentRow`, `LearningPoint`, `ExploitPoint`, `Highlight`, `ReplayStep`) y `CurvePoint` de `web/src/logic/curve.ts`.
- Produces: `web/src/data/real.ts` exporta `REAL_RESULTS: ResultsData`, `REAL_ENVIDO_CURVE: CurvePoint[]`, `REAL_HIGHLIGHTS: Highlight[]`, que usan las páginas por defecto.

- [ ] **Step 1: manos destacadas elegidas por rival**

Hoy `select` toma las más flojas de todo el conjunto, y casi todas salen del heurístico (de 12, una sola es contra Haiku). En `eval/src/highlights.rs` agregar:

```rust
/// Como `select`, pero las `top_*` más flojas de CADA rival (en el orden en que aparecen en `found`).
pub fn select_per_rival(
    found: Vec<Highlight>,
    top_truco: usize,
    top_envido: usize,
) -> (Vec<Highlight>, Vec<Highlight>) {
    let mut rivals: Vec<String> = Vec::new();
    for h in &found {
        if !rivals.contains(&h.rival) {
            rivals.push(h.rival.clone());
        }
    }
    let (mut truco, mut envido) = (Vec::new(), Vec::new());
    for r in rivals {
        let mine: Vec<Highlight> = found.iter().filter(|h| h.rival == r).cloned().collect();
        let (t, e) = select(mine, top_truco, top_envido);
        truco.extend(t);
        envido.extend(e);
    }
    (truco, envido)
}
```

Test en `eval/tests/highlights.rs` (seguir el estilo de los tests que ya están ahí para armar `Highlight` de prueba): con 5 de truco del heurístico y 2 de Haiku, `select_per_rival(found, 3, 0)` devuelve 3 del heurístico y 2 de Haiku, cada grupo ordenado del más flojo al menos flojo.

En `eval/src/main.rs`, función `highlights`: leer `let per_rival: bool = args.get("per-rival", Some(false))?;` y usar `select_per_rival` si es `true`, `select` si no. Actualizar el comentario de uso del archivo.

Run: `cargo test -p truco-eval highlights 2>&1 | tail -3` → pasa.

Regenerar con los registros respaldados del Plan 3:

Run: `cargo run --release -p truco-eval -- highlights --logs ~/backups/truco-cfr/plan-3-logs --rivals heuristic,haiku --per-rival true --top-truco 3 --top-envido 2 2>&1 | tail -3`
Expected: `escrito eval/results/highlights.json` con 6 de truco y 4 de envido (si Haiku tiene menos de 3 faroles de truco o menos de 2 de envido en su lista, salen los que haya). Verificar con `python3 -c "import json;d=json.load(open('eval/results/highlights.json'));print([(h['rival'],h['kind']) for h in d['truco']+d['envido']])"`.

En `docs/eval-report.md`, sección "Manos destacadas", reemplazar la línea de `highlights.json` por: "`eval/results/highlights.json` guarda, para cada rival, los 3 faroles de truco y los 2 de envido con las manos más flojas (`highlights --per-rival true --top-truco 3 --top-envido 2`)." y en "Reproducir" el comando nuevo.

- [ ] **Step 2: exportar la curva de aprendizaje y la explotabilidad**

`train/scripts/export_curves.py`:

```python
"""Exporta las curvas del entrenamiento a archivos chicos y versionados en eval/results/.

  learning:    metrics.jsonl de una corrida de truco -> [{iteration, vsRandom, vsRandomCi, vsHeuristic, vsHeuristicCi, games}]
  minitruco:   metrics.jsonl + final.json de una corrida de MiniTruco -> {points: [{iteration, exploitability}], final}

Uso:
  python scripts/export_curves.py learning RUN_DIR OUT.json
  python scripts/export_curves.py minitruco RUN_DIR OUT.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def read_metrics(run_dir: Path) -> list[dict]:
    lines = (run_dir / "metrics.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def learning(run_dir: Path) -> dict:
    points = []
    for m in read_metrics(run_dir):
        ev = m.get("eval")
        if not ev or "heuristic" not in ev:
            continue
        points.append({
            "iteration": m["iter"],
            "vsRandom": ev["random"]["rate"],
            "vsRandomCi": [ev["random"]["lo"], ev["random"]["hi"]],
            "vsHeuristic": ev["heuristic"]["rate"],
            "vsHeuristicCi": [ev["heuristic"]["lo"], ev["heuristic"]["hi"]],
            "games": ev["heuristic"]["games"],
        })
    if not points:
        raise ValueError(f"{run_dir} no tiene evaluaciones de truco")
    return {"run": run_dir.name, "policy": "advantage (regret matching, la política de cada iteración)",
            "points": points}


def minitruco(run_dir: Path) -> dict:
    points = [{"iteration": m["iter"], "exploitability": m["eval"]["exploitability_current"]}
              for m in read_metrics(run_dir) if m.get("eval", {}).get("exploitability_current") is not None]
    if not points:
        raise ValueError(f"{run_dir} no tiene explotabilidad")
    final = json.loads((run_dir / "final.json").read_text(encoding="utf-8"))
    return {"run": run_dir.name, "points": points, "finalStrategyExploitability": final["exploitability"],
            "iterations": final["iterations"]}


def main(argv: list[str]) -> None:
    kind, run_dir, out = argv
    data = {"learning": learning, "minitruco": minitruco}[kind](Path(run_dir))
    Path(out).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
```

`train/tests/test_export_curves.py`:

```python
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_curves  # noqa: E402


def write_run(tmp_path, lines, final=None):
    (tmp_path / "metrics.jsonl").write_text("\n".join(json.dumps(x) for x in lines) + "\n")
    if final is not None:
        (tmp_path / "final.json").write_text(json.dumps(final))
    return tmp_path


def ev(rate_h, rate_r):
    return {"heuristic": {"wins": 1, "games": 400, "rate": rate_h, "lo": rate_h - 0.05, "hi": rate_h + 0.05},
            "random": {"wins": 1, "games": 400, "rate": rate_r, "lo": rate_r - 0.03, "hi": rate_r + 0.03}}


def test_learning_toma_solo_las_iteraciones_evaluadas(tmp_path):
    run = write_run(tmp_path, [{"iter": 1}, {"iter": 10, "eval": ev(0.58, 0.92)}, {"iter": 11},
                               {"iter": 20, "eval": ev(0.62, 0.93)}])
    out = export_curves.learning(run)
    assert [p["iteration"] for p in out["points"]] == [10, 20]
    assert out["points"][0]["vsHeuristic"] == 0.58
    assert out["points"][1]["vsRandomCi"] == [0.9, 0.96]


def test_learning_sin_evaluaciones_falla(tmp_path):
    with pytest.raises(ValueError):
        export_curves.learning(write_run(tmp_path, [{"iter": 1}]))


def test_minitruco(tmp_path):
    run = write_run(tmp_path, [{"iter": 5, "eval": {"exploitability_current": 0.4}},
                               {"iter": 10, "eval": {"exploitability_current": 0.2}}],
                    final={"exploitability": 0.05, "iterations": 10})
    out = export_curves.minitruco(run)
    assert out["points"] == [{"iteration": 5, "exploitability": 0.4}, {"iteration": 10, "exploitability": 0.2}]
    assert out["finalStrategyExploitability"] == 0.05
```

Run: `cd train && uv run pytest tests/test_export_curves.py -q 2>&1 | tail -3` → 3 passed.

Run: `cd train && uv run python scripts/export_curves.py learning ~/backups/truco-cfr/overnight-1-2026-10-14 ../eval/results/learning.json` (si esa carpeta no tiene `metrics.jsonl`, usar una carpeta temporal con `~/backups/truco-cfr/overnight-1-metrics.jsonl` copiado como `metrics.jsonl`). Expected: 59 puntos (una evaluación cada 10 iteraciones, de la 10 a la 590).

- [ ] **Step 3: corrida de MiniTruco (explotabilidad exacta)**

`train/configs/minitruco.toml`:

```toml
# MiniTruco: la variante chica donde la explotabilidad se calcula exacta. Muestra que Deep CFR converge.
game = "minitruco"
seed = 3
iterations = 150
traversals = 2_000
threads = 8
hidden = 64
n_hidden = 2
adv_capacity = 1_000_000
strat_capacity = 2_000_000
adv_steps = 500
batch_size = 2_048
lr = 0.001
warm_start = true
strat_steps = 5_000
eval_every = 5
eval_pairs = 1
checkpoint_every = 50
compress_checkpoints = false
final_pairs = 1
time_budget_s = 1_800
device = "cuda"
```

Primero una prueba de tiempos con 10 iteraciones (`--run-id minitruco-probe`, editando una copia temporal con `iterations = 10`): `cd train && uv run python -m truco_train run --config /tmp/minitruco-probe.toml --run-id minitruco-probe 2>&1 | tail -3`. Si 10 iteraciones tardan más de 2 minutos, bajar `traversals` hasta que 150 iteraciones entren en 30 minutos y anotar el cambio en el informe. Si `uv run` falla porque falta el módulo del motor, construirlo como en el Plan 2 (`uv run maturin develop --release -m ../engine-py/Cargo.toml`).

Correr la de verdad (en segundo plano, con salida a un log en el scratchpad; la protección de memoria de Claude Code puede cortar procesos de fondo: si se corta, relanzar con `uv run python -m truco_train resume runs/minitruco-1`):

Run: `cd train && uv run python -m truco_train run --config configs/minitruco.toml --run-id minitruco-1`
Expected: `listo: {... "exploitability": X ...}` con X menor que la primera explotabilidad registrada en `metrics.jsonl`.

Run: `cd train && uv run python scripts/export_curves.py minitruco runs/minitruco-1 ../eval/results/minitruco.json`

Si la explotabilidad no baja (la última `exploitability_current` no es menor que la primera), NO seguir: anotarlo en el informe como DONE_WITH_CONCERNS con los números; el controlador decide.

- [ ] **Step 4: repeticiones desde los registros (Rust)**

`engine-wasm/src/replay.rs`:

```rust
//! Repeticiones de las manos destacadas: se re-juega cada mano con el motor y se arma un
//! `TableView` por paso, visto desde el asiento del rival, con las cartas del bot a la vista y
//! las probabilidades del bot en cada decisión suya.
use crate::mood::{end_mood, is_bluff, Mood};
use crate::view::{card_label, table_view, TableView, ViewExtra};
use serde::{Deserialize, Serialize};
use truco_engine::cards::Card;
use truco_engine::game::{bit, other, Player};
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::truco::*;

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HandIn {
    pub mano: Player,
    pub start_scores: [u8; 2],
    pub hands: [[String; 3]; 2],
    pub actions: Vec<(Player, String)>,
    pub points: [u8; 2],
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HighlightIn {
    pub rival: String,
    pub kind: String,
    pub call: String,
    pub call_index: usize,
    pub bot_seat: Player,
    pub strength: f64,
    pub response: String,
    pub points_won: u8,
    pub hand: HandIn,
}

#[derive(Serialize, Clone, Debug)]
pub struct ReplayStep {
    pub caption: String,
    pub view: TableView,
}

#[derive(Serialize, Clone, Debug)]
pub struct HighlightOut {
    pub id: String,
    pub title: String,
    pub why: String,
    pub steps: Vec<ReplayStep>,
}

/// Nombre del rival como sujeto de una oración ("Claude Haiku no quiso").
pub fn rival_name(rival: &str) -> &'static str {
    match rival {
        "haiku" => "Claude Haiku",
        "heuristic" => "El heurístico",
        "random" => "El bot al azar",
        _ => "El rival",
    }
}

fn verb(a: Action, card: Option<Card>) -> String {
    match a {
        JUGAR0 | JUGAR1 | JUGAR2 => format!("juega el {}", card_label(card.expect("carta jugada"))),
        ENVIDO => "canta envido".into(),
        REAL_ENVIDO => "canta real envido".into(),
        FALTA_ENVIDO => "canta falta envido".into(),
        TRUCO => "canta truco".into(),
        RETRUCO => "canta retruco".into(),
        VALE_CUATRO => "canta vale cuatro".into(),
        QUIERO => "quiere".into(),
        NO_QUIERO => "no quiere".into(),
        MAZO => "se va al mazo".into(),
        _ => unreachable!("acción inválida {a}"),
    }
}

fn pct(x: f64) -> String {
    format!("{:.1}", x * 100.0).replace('.', ",")
}

fn cards_text(cards: &[Card; 3]) -> String {
    format!("{}, {} y {}", card_label(cards[0]), card_label(cards[1]), card_label(cards[2]))
}

pub fn replay(h: &HighlightIn, agent: &MlpAgent, id: String) -> Result<HighlightOut, String> {
    let bot = h.bot_seat;
    let viewer = other(bot);
    let parse = |s: &String| Card::parse(s).ok_or(format!("carta inválida: {s}"));
    let mut hands = [[Card::from_id(0); 3]; 2];
    for p in 0..2 {
        for i in 0..3 {
            hands[p][i] = parse(&h.hand.hands[p][i])?;
        }
    }
    let mut s = TrucoState::new_hand(hands, h.hand.mano, h.hand.start_scores);
    let bot_cards = s.hand(bot);
    let rival = rival_name(&h.rival);
    let detail = if h.kind == "truco" {
        format!("una mano del {} % más flojo", pct(h.strength))
    } else {
        format!("{} tantos", h.strength as u8)
    };

    let mut steps = vec![ReplayStep {
        caption: format!("Reparto. El bot tiene {}: {}.", cards_text(&bot_cards), detail),
        view: table_view(&s, viewer, &ViewExtra { xray: None, mood: Mood::Neutral, reveal_bot_hand: true }),
    }];
    let (mut mood, mut bluffed) = (Mood::Neutral, false);
    for (i, (p, name)) in h.hand.actions.iter().enumerate() {
        let a = ACTION_NAMES.iter().position(|n| *n == name.as_str()).ok_or(format!("acción desconocida: {name}"))?;
        if s.turn() != *p || s.legal_actions() & bit(a) == 0 {
            return Err(format!("{id}: la jugada {i} ({name}) no es legal al re-simular"));
        }
        let xray = (*p == bot).then(|| agent.probabilities(&s.observation(bot)));
        if *p == bot && is_bluff(&s, bot, a) {
            bluffed = true;
            mood = Mood::Farol;
        }
        let card = match a {
            JUGAR0 | JUGAR1 | JUGAR2 => Some(s.hand(*p)[a - JUGAR0]),
            _ => None,
        };
        s.apply(a);
        if s.is_over() {
            mood = end_mood(s.points(), bot, bluffed);
        }
        let actor = if *p == bot { "El bot" } else { rival };
        let mut caption = format!("{actor} {}.", verb(a, card));
        if i == h.call_index {
            caption = format!("{actor} {} con {detail}: farol.", verb(a, card));
        }
        if s.is_over() {
            caption.push_str(&format!(" Fin de la mano: el bot suma {}.", s.points()[bot]));
        }
        steps.push(ReplayStep {
            caption,
            view: table_view(&s, viewer, &ViewExtra { xray, mood, reveal_bot_hand: true }),
        });
    }
    if s.points() != h.hand.points {
        return Err(format!("{id}: los puntos re-simulados {:?} no coinciden con el registro {:?}", s.points(), h.hand.points));
    }

    let call_text = verb(ACTION_NAMES.iter().position(|n| *n == h.call).ok_or("canto desconocido")?, None)
        .replace("canta ", "");
    let answer = if h.response == "mazo" { "se fue al mazo" } else { "no quiso" };
    let title = if h.kind == "truco" {
        format!("{} con {} · {}", capitalize(&call_text), numbers_text(&bot_cards), rival)
    } else {
        format!("{} con {} · {}", capitalize(&call_text), detail, rival)
    };
    let why = format!(
        "El bot cantó {call_text} con {} ({detail}). {rival} {answer} y el bot sumó {} {} en la mano.",
        cards_text(&bot_cards),
        h.points_won,
        if h.points_won == 1 { "punto" } else { "puntos" }
    );
    Ok(HighlightOut { id, title, why, steps })
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

/// "10, 4 y 4": los números de las tres cartas, para el título.
fn numbers_text(cards: &[Card; 3]) -> String {
    format!("{}, {} y {}", cards[0].number(), cards[1].number(), cards[2].number())
}
```

(`Action` viene de `truco_engine::game::Action`; sumarlo al `use`. Sumar `pub mod replay;` en `lib.rs`.)

Tests en el mismo archivo, con la mano de ejemplo del informe del Plan 3 (la de Haiku: el bot es pie con 10C, 4E, 4C):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use truco_engine::mlp::Mlp;
    use truco_engine::policy::PolicyKind;

    fn agent() -> MlpAgent {
        let bytes = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../models/strategy.tcfrw")).unwrap();
        MlpAgent::shared(Arc::new(Mlp::from_bytes(&bytes).unwrap()), PolicyKind::Strategy, "bot")
    }

    fn haiku() -> HighlightIn {
        serde_json::from_str(r#"{"rival":"haiku","kind":"truco","call":"truco","callIndex":4,"botSeat":1,
            "strength":0.00298582995951417,"response":"noQuiero","pointsWon":3,
            "hand":{"mano":0,"startScores":[10,20],"hands":[["11C","6E","4O"],["10C","4E","4C"]],
            "actions":[[0,"jugar2"],[1,"envido"],[0,"quiero"],[1,"jugar0"],[1,"truco"],[0,"noQuiero"]],
            "points":[0,3]}}"#).unwrap()
    }

    #[test]
    fn repeticion_de_la_mano_de_haiku() {
        let out = replay(&haiku(), &agent(), "haiku-truco-1".into()).unwrap();
        assert_eq!(out.steps.len(), 7);
        assert_eq!(out.title, "Truco con 10, 4 y 4 · Claude Haiku");
        assert!(out.why.contains("Claude Haiku no quiso"), "{}", out.why);
        assert!(out.steps[0].caption.starts_with("Reparto. El bot tiene 10 de copa"), "{}", out.steps[0].caption);
        assert!(out.steps[5].caption.contains("farol"), "{}", out.steps[5].caption);
        assert!(out.steps[6].caption.ends_with("el bot suma 3."), "{}", out.steps[6].caption);
        assert!(out.steps[2].view.xray.is_some(), "el paso del envido del bot trae rayos X");
        assert!(out.steps[1].view.xray.is_none(), "la jugada de Haiku no");
        assert_eq!(out.steps[6].view.phase, "finDeMano");
        assert_eq!(out.steps[6].view.mood, "gana");
        assert!(out.steps.iter().all(|s| s.view.bot_hand.is_some()));
    }

    #[test]
    fn una_jugada_ilegal_es_un_error() {
        let mut h = haiku();
        h.hand.actions[0] = (1, "jugar0".into()); // no es el turno del asiento 1
        assert!(replay(&h, &agent(), "x".into()).is_err());
    }

    #[test]
    fn puntos_distintos_al_registro_es_un_error() {
        let mut h = haiku();
        h.hand.points = [0, 2];
        assert!(replay(&h, &agent(), "x".into()).is_err());
    }
}
```

Nota sobre el orden de las cartas en la mano del bot: `new_hand` ordena por jerarquía; el texto "10 de copa, 4 de espada y 4 de copa" sale de ese orden. Si el test del reparto falla por el orden, ajustar el `starts_with` a lo que devuelve el motor (no reordenar en `replay`).

Run: `cargo test -p truco-engine-wasm replay 2>&1 | tail -3` → 3 passed.

- [ ] **Step 5: el binario `web-data`**

`engine-wasm/src/bin/web-data.rs`:

```rust
//! Convierte los resultados de la evaluación y del entrenamiento al formato de la web.
//!
//!   cargo run --release -p truco-engine-wasm --bin web-data -- [--results eval/results]
//!       [--model models/strategy.tcfrw] [--out web/src/data/real] [--generated-at 2026-10-15]
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::PolicyKind;
use truco_engine_wasm::replay::{replay, HighlightIn};

const TANTOS: [u32; 22] = [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];

fn read(path: &Path) -> Result<Value, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("no pude leer {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

fn write(dir: &Path, name: &str, v: &Value) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, serde_json::to_string_pretty(v).unwrap() + "\n").map_err(|e| e.to_string())?;
    println!("escrito {}", path.display());
    Ok(())
}

fn f(v: &Value, key: &str) -> Result<f64, String> {
    v[key].as_f64().ok_or(format!("falta el número {key}"))
}

fn tournament_row(results: &Path, rival: &str, name: &str, description: &str) -> Result<Value, String> {
    let t = read(&results.join(format!("tournament-{rival}.json")))?;
    let decisions = f(&t, "rivalDecisions")?;
    let fallback_pct = if rival == "haiku" { json!(100.0 * f(&t, "fallbacks")? / decisions) } else { Value::Null };
    Ok(json!({
        "rival": name,
        "description": description,
        "partidos": t["games"],
        "ganados": t["wins"],
        "winRate": t["winRate"],
        "ciLow": t["wilson95"][0],
        "ciHigh": t["wilson95"][1],
        "netPerHand": t["pointsPerHand"],
        "netCiLow": t["pointsPerHandCi95"][0],
        "netCiHigh": t["pointsPerHandCi95"][1],
        "fallbackPct": fallback_pct,
    }))
}

fn results_json(results: &Path, generated_at: &str) -> Result<Value, String> {
    let tournament = vec![
        tournament_row(results, "random", "Bot al azar", "Juega cualquier acción legal")?,
        tournament_row(results, "heuristic", "Heurístico propio", "Reglas fijas: canta envido con 27 o más, truco con dos cartas altas")?,
        tournament_row(results, "haiku", "Claude Haiku", "IA de lenguaje de Anthropic que juega leyendo la mesa en texto (100 partidos)")?,
    ];
    let learning = read(&results.join("learning.json"))?;
    let learning: Vec<Value> = learning["points"].as_array().ok_or("learning.json sin points")?
        .iter()
        .map(|p| json!({ "iteration": p["iteration"], "vsRandom": p["vsRandom"], "vsHeuristic": p["vsHeuristic"] }))
        .collect();
    let mini = read(&results.join("minitruco.json"))?;
    let exploitability: Vec<Value> = mini["points"].as_array().ok_or("minitruco.json sin points")?
        .iter()
        .map(|p| json!({ "iteration": p["iteration"], "exploitability": p["exploitability"] }))
        .collect();
    Ok(json!({
        "isMock": false,
        "generatedAt": generated_at,
        "tournament": tournament,
        "learning": learning,
        "exploitability": exploitability,
        "exploitabilityFinal": mini["finalStrategyExploitability"],
    }))
}

fn envido_curve(results: &Path) -> Result<Value, String> {
    let bluff = read(&results.join("bluff.json"))?;
    let curve = bluff["envidoCurve"].as_array().ok_or("bluff.json sin envidoCurve")?;
    let p_any = |role: &str, tantos: u32| -> Result<f64, String> {
        curve
            .iter()
            .find(|c| c["role"] == role && c["tantos"].as_u64() == Some(tantos as u64))
            .and_then(|c| c["pAny"].as_f64())
            .ok_or(format!("bluff.json no tiene {role} con {tantos} tantos"))
    };
    let points: Result<Vec<Value>, String> = TANTOS
        .iter()
        .map(|&t| Ok(json!({ "tantos": t, "mano": p_any("mano", t)?, "pie": p_any("pie", t)? })))
        .collect();
    Ok(Value::Array(points?))
}

fn highlights(results: &Path, model: &Path) -> Result<Value, String> {
    let bytes = std::fs::read(model).map_err(|e| format!("no pude leer {}: {e}", model.display()))?;
    let agent = MlpAgent::shared(Arc::new(Mlp::from_bytes(&bytes)?), PolicyKind::Strategy, "bot");
    let report = read(&results.join("highlights.json"))?;
    let mut out = Vec::new();
    for kind in ["truco", "envido"] {
        let list: Vec<HighlightIn> = serde_json::from_value(report[kind].clone()).map_err(|e| e.to_string())?;
        let mut counts = std::collections::HashMap::new();
        for h in &list {
            let n = counts.entry(h.rival.clone()).or_insert(0);
            *n += 1;
            let id = format!("{}-{kind}-{n}", h.rival);
            out.push(serde_json::to_value(replay(h, &agent, id)?).unwrap());
        }
    }
    // primero Haiku, que es lo más llamativo; después el heurístico
    out.sort_by_key(|h| !h["id"].as_str().unwrap_or("").starts_with("haiku"));
    Ok(Value::Array(out))
}

fn arg(args: &[String], key: &str, default: &str) -> String {
    args.windows(2)
        .find(|w| w[0] == format!("--{key}"))
        .map(|w| w[1].clone())
        .unwrap_or_else(|| default.to_string())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let results = PathBuf::from(arg(&args, "results", "eval/results"));
    let model = PathBuf::from(arg(&args, "model", "models/strategy.tcfrw"));
    let out = PathBuf::from(arg(&args, "out", "web/src/data/real"));
    let generated_at = arg(&args, "generated-at", "2026-10-15");
    write(&out, "results.json", &results_json(&results, &generated_at)?)?;
    write(&out, "envidoCurve.json", &envido_curve(&results)?)?;
    write(&out, "highlights.json", &highlights(&results, &model)?)?;
    Ok(())
}

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::ExitCode::FAILURE
        }
    }
}
```

Run: `cargo run --release -p truco-engine-wasm --bin web-data 2>&1 | tail -4`
Expected: tres `escrito web/src/data/real/...`. Si `bluff.json` no tiene algún casillero de `TANTOS` para un rol, el binario falla con el mensaje: en ese caso anotar cuál falta y cambiar `p_any` para devolver `0.0` SOLO cuando `n` del casillero sea 0 o no exista, y documentarlo en el informe.

- [ ] **Step 6: la web usa los datos reales**

`web/src/data/real.ts`:

```ts
import type { CurvePoint } from '../logic/curve';
import type { Highlight, ResultsData } from './types';
import envidoCurve from './real/envidoCurve.json';
import highlights from './real/highlights.json';
import results from './real/results.json';

// Generado por `cargo run --release -p truco-engine-wasm --bin web-data` desde eval/results.
export const REAL_RESULTS = results as ResultsData;
export const REAL_ENVIDO_CURVE = envidoCurve as CurvePoint[];
export const REAL_HIGHLIGHTS = highlights as Highlight[];
```

`web/src/data/real.test.ts`:

```ts
import { TANTOS } from '../logic/curve';
import { validateTableView } from '../table/validate';
import { REAL_ENVIDO_CURVE, REAL_HIGHLIGHTS, REAL_RESULTS } from './real';

describe('datos reales', () => {
  it('torneo con los tres rivales del Plan 3', () => {
    expect(REAL_RESULTS.isMock).toBe(false);
    expect(REAL_RESULTS.tournament.map((r) => r.rival)).toEqual(['Bot al azar', 'Heurístico propio', 'Claude Haiku']);
    const haiku = REAL_RESULTS.tournament[2]!;
    expect(haiku.partidos).toBe(100);
    expect(haiku.ganados).toBe(59);
    expect(haiku.fallbackPct).toBe(0);
    expect(REAL_RESULTS.learning.length).toBeGreaterThan(10);
    expect(REAL_RESULTS.exploitability.length).toBeGreaterThan(5);
  });

  it('curva del envido completa y en 0..1', () => {
    expect(REAL_ENVIDO_CURVE.map((p) => p.tantos)).toEqual([...TANTOS]);
    for (const p of REAL_ENVIDO_CURVE) {
      expect(p.mano).toBeGreaterThanOrEqual(0);
      expect(p.pie).toBeLessThanOrEqual(1);
    }
  });

  it('repeticiones válidas, primero las de Haiku', () => {
    expect(REAL_HIGHLIGHTS.length).toBeGreaterThanOrEqual(4);
    expect(REAL_HIGHLIGHTS[0]!.id.startsWith('haiku')).toBe(true);
    expect(new Set(REAL_HIGHLIGHTS.map((h) => h.id)).size).toBe(REAL_HIGHLIGHTS.length);
    for (const h of REAL_HIGHLIGHTS) {
      for (const s of h.steps) expect(validateTableView(s.view), `${h.id}: ${s.caption}`).toEqual([]);
    }
  });
});
```

Páginas:
- `Resultados.tsx`: `data = REAL_RESULTS` como valor por defecto (el banner de `isMock` queda para los tests que pasan `MOCK_RESULTS`). Debajo del gráfico de aprendizaje, la aclaración: "Cada punto: 400 partidos de la política de esa iteración (no la red final) contra cada rival." Debajo del de explotabilidad: "MiniTruco, una versión chica del juego donde se puede calcular exacto cuánto perdería el bot contra el mejor rival posible. Red final: {valor con 3 decimales y coma}." El valor sale de `eval/results/minitruco.json` → agregarlo a `results.json` en `web-data` como `"exploitabilityFinal"` y al tipo `ResultsData` como `exploitabilityFinal?: number`.
- `Manos.tsx`: recibe `highlights = REAL_HIGHLIGHTS` como prop por defecto (como Resultados), sin el banner de "Repeticiones de ejemplo". El texto: "Faroles que funcionaron, sacados de los partidos del torneo: el bot cantó con una mano floja y el rival no se animó. Pasá los pasos para verlos; en cada decisión del bot ves sus probabilidades (rayos X)."
- `ComoFunciona.tsx`: `data={REAL_ENVIDO_CURVE}` y `note="20 000 manos del bot contra sí mismo (eval/results/bluff.json)."`.
- `mock.ts` y `envidoCurve.ts` (mock) quedan solo para tests; si después de esto nadie fuera de los tests importa `ENVIDO_CURVE_MOCK`, moverlo a `mock.ts` y borrar `data/envidoCurve.ts`.

Actualizar los tests de las páginas para que pasen los mocks explícitamente donde verifican el banner de ejemplo, y agregar uno por página que, sin props, no muestre ningún banner de "ejemplo".

Run: `cd web && npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3`

- [ ] **Step 7: verificación y commit**

Run: `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings 2>&1 | tail -2 && cargo test 2>&1 | grep -E '^test result' | tail -8`

```bash
git add eval engine-wasm train/scripts/export_curves.py train/tests/test_export_curves.py train/configs/minitruco.toml docs/eval-report.md web/src
git commit -F /tmp/msg-t5.txt   # "feat: datos reales en la web (torneo con Haiku, curva de aprendizaje, explotabilidad en MiniTruco, curva del envido y repeticiones re-simuladas)"
```

---

### Task 6: tests de punta a punta y presupuesto

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/serve.ts`, `web/e2e/jugar.spec.ts`, `web/e2e/paginas.spec.ts`, `web/scripts/check-size.ts`
- Modify: `web/package.json` (devDependency `@playwright/test`, scripts `e2e` y `size`), `web/tsconfig.json` (incluir `e2e` y `playwright.config.ts`), `web/vite.config.ts` (`test.exclude` para `e2e/**`)

**Interfaces:**
- Consumes: el build de la web (`dist/`), las etiquetas de la UI ("Tus cartas", "Acciones", "Quiero", "Nueva mano", "Nuevo partido", "Barajando…"), `.mesa__end`, `.mesa__endslot`, `.baza`.
- Produces: `npm run e2e` y `npm run size`, que usa el CI de la Tarea 8.

- [ ] **Step 1: instalar Playwright**

Run: `cd web && npm install -D @playwright/test@1 2>&1 | tail -2 && npx playwright install chromium 2>&1 | tail -2 && npx playwright --version`

Si al correr un test Chromium no arranca por librerías del sistema que faltan (error tipo `libnss3.so` o `Host system is missing dependencies`), PARAR y reportar BLOCKED con el mensaje exacto: instalar esas librerías requiere `sudo npx playwright install-deps chromium`, que solo puede correr el usuario. No buscar otro camino.

- [ ] **Step 2: servidor estático en una subcarpeta**

`web/e2e/serve.ts` (sirve `dist/` en `/truco-cfr/`, como GitHub Pages):

```ts
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const BASE = '/truco-cfr/';
const PORT = Number(process.env.PORT ?? 4190);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8', '.tcfrw': 'application/octet-stream',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  let path = normalize(join(ROOT, url.pathname.slice(BASE.length)));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`sirviendo dist/ en http://localhost:${PORT}${BASE}`));
```

`web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:4190/truco-cfr/' },
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4190/truco-cfr/', reuseExistingServer: false },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
});
```

- [ ] **Step 3: jugar una mano entera**

`web/e2e/jugar.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

/** Errores de consola y de la página: tienen que quedar vacíos. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Hace una jugada cualquiera de las que hay; devuelve false si no había ninguna. */
async function playSomething(page: Page): Promise<boolean> {
  const card = page.getByRole('group', { name: 'Tus cartas' }).getByRole('button').and(page.locator(':enabled'));
  if (await card.count()) {
    await card.first().click();
    return true;
  }
  const quiero = page.getByRole('button', { name: 'Quiero', exact: true });
  if (await quiero.count()) {
    await quiero.first().click();
    return true;
  }
  return false;
}

test('se juega una mano entera contra el bot real', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/jugar');
  await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
  const end = page.locator('.mesa__end');
  for (let i = 0; i < 60 && !(await end.isVisible()); i++) {
    if (!(await playSomething(page))) await page.waitForTimeout(300); // el bot está pensando
  }
  await expect(end).toBeVisible();
  await expect(end).toContainText(/Ganaste|Ganó el bot|pareja|partido/);

  // el cartel no tapa ninguna baza
  const endBox = (await end.boundingBox())!;
  for (const baza of await page.locator('.baza').all()) {
    const b = (await baza.boundingBox())!;
    const overlap = b.x < endBox.x + endBox.width && endBox.x < b.x + b.width && b.y < endBox.y + endBox.height && endBox.y < b.y + b.height;
    expect(overlap).toBe(false);
  }

  // sin scroll horizontal; en escritorio, tampoco vertical
  const { sw, cw, sh, ch } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
  if (test.info().project.name === 'escritorio') expect(sh).toBeLessThanOrEqual(ch);

  await page.getByRole('button', { name: /Nueva mano|Nuevo partido/ }).first().click();
  await expect(end).toBeHidden();
  expect(errors).toEqual([]);
});

test('el bot piensa entre 400 y 900 ms', async ({ page }) => {
  await page.goto('#/jugar');
  await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
  const waiting = page.getByText('El bot está pensando…');
  for (let i = 0; i < 20; i++) {
    if (await playSomething(page)) break;
    await page.waitForTimeout(200);
  }
  if (await waiting.isVisible()) {
    const t0 = Date.now();
    await expect(waiting).toBeHidden({ timeout: 5_000 });
    expect(Date.now() - t0).toBeLessThan(2_000);
  }
});
```

- [ ] **Step 4: todas las páginas cargan sin errores**

`web/e2e/paginas.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

for (const [route, heading] of [
  ['como-funciona', 'Cómo funciona'],
  ['resultados', 'Resultados'],
  ['manos', 'Manos destacadas'],
  ['playground', 'Banco de pruebas'],
] as const) {
  test(`${route} carga sin errores ni datos de ejemplo`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`#/${route}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    if (route !== 'playground') await expect(page.getByText(/de ejemplo/i)).toHaveCount(0);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    expect(errors).toEqual([]);
  });
}

test('el crédito del arte y su licencia llegan al sitio', async ({ page, request }) => {
  await page.goto('#/jugar');
  await expect(page.getByText(/Card art by Jose Angel Canabal/)).toBeVisible();
  const lic = await request.get('cards/LICENSE-ART.md');
  expect(lic.ok()).toBe(true);
});

test('una repetición se recorre paso a paso', async ({ page }) => {
  await page.goto('#/manos');
  await expect(page.getByText(/Paso 1 de/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText(/Paso 2 de/)).toBeVisible();
});
```

(Las cartas de la mano son `<button aria-label="Jugar …">` dentro del grupo "Tus cartas", ver `components/PixelCard.tsx`; el `h1` del banco de pruebas es "Banco de pruebas".)

- [ ] **Step 5: presupuesto de tamaño**

`web/scripts/check-size.ts`:

```ts
// Falla si dist/ pesa 5 MB o más (presupuesto del spec).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 5 * 1024 * 1024;
const root = new URL('../dist/', import.meta.url).pathname;

function size(dir: string): number {
  return readdirSync(dir).reduce((sum, name) => {
    const p = join(dir, name);
    const s = statSync(p);
    return sum + (s.isDirectory() ? size(p) : s.size);
  }, 0);
}

const total = size(root);
console.log(`dist/: ${(total / 1024 / 1024).toFixed(2)} MB (límite 5 MB)`);
if (total >= LIMIT) process.exit(1);
```

`web/package.json` scripts: `"e2e": "playwright test"`, `"size": "node scripts/check-size.ts"`. En `vite.config.ts`, dentro de `test`: `exclude: ['e2e/**', 'node_modules/**']`. En `tsconfig.json`, `include` suma `"e2e"` y `"playwright.config.ts"`.

- [ ] **Step 6: correr todo**

Run: `cd web && npm run build 2>&1 | tail -2 && npm run size && npm run e2e 2>&1 | tail -15`
Expected: `dist/` por debajo de 5 MB; todos los tests de Playwright pasan en los dos proyectos. Si el de "sin scroll vertical en escritorio" falla, ajustar `DESKTOP_FIXED` en `table/sizing.ts` (Tarea 4) y volver a correr. Si falla el de 360 px por el cartel, revisar `.mesa__endslot`.

- [ ] **Step 7: commit**

```bash
git add web
git commit -F /tmp/msg-t6.txt   # "test(web): e2e con Playwright (mano entera en celular y escritorio, páginas, subcarpeta) y presupuesto de 5 MB"
```

---

### Task 7: modelo para Hugging Face y paridad entre implementaciones

**Files:**
- Modify: `train/pyproject.toml` (grupo `export`)
- Create: `train/scripts/export_hf.py`, `train/tests/test_hf_export.py`, `hf/README.md`, `hf/.gitignore`, `web/src/engine/parity-fixture.json`, `web/src/engine/parity.test.ts`

**Interfaces:**
- Consumes: `truco_train.weights.read_tcfrw1`, `truco_train.model.ScaledMlp`, `truco_engine_py.{mlp_forward, Hand, game_info}`, `WasmMatch.logits` (Tarea 2).
- Produces: `hf/model.safetensors`, `hf/model.onnx`, `hf/strategy.tcfrw`, `hf/config.json` (generados, ignorados por git salvo `README.md` y `config.json`), `web/src/engine/parity-fixture.json`.

- [ ] **Step 1: dependencias de exportación (gratis)**

En `train/pyproject.toml`, dentro de `[dependency-groups]`:

```toml
export = ["safetensors>=0.4", "onnx>=1.16", "onnxruntime>=1.18"]
```

Run: `cd train && uv sync --group dev --group export 2>&1 | tail -2`

- [ ] **Step 2: test de exportación y paridad (falla)**

`train/tests/test_hf_export.py`:

```python
"""La red publicada da lo mismo en PyTorch, en Rust (el mismo código que corre el WASM) y en ONNX."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_hf  # noqa: E402

MODEL = Path(__file__).resolve().parents[2] / "models" / "strategy.tcfrw"


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    out = tmp_path_factory.mktemp("hf")
    export_hf.export(MODEL, out, fixture=out / "fixture.json", n_fixture=16)
    return out


def test_archivos(exported):
    for name in ("model.safetensors", "model.onnx", "strategy.tcfrw", "config.json"):
        assert (exported / name).exists(), name
    cfg = json.loads((exported / "config.json").read_text())
    assert cfg["input_size"] == 304 and cfg["n_actions"] == 12
    assert cfg["actions"][9] == "quiero"


def test_paridad_pytorch_rust_onnx(exported):
    diffs = export_hf.parity(MODEL, exported / "model.onnx", n=2000)
    assert diffs["rust"] < 1e-4, diffs
    assert diffs["onnx"] < 1e-4, diffs


def test_fixture_para_el_wasm(exported):
    fx = json.loads((exported / "fixture.json").read_text())
    assert len(fx["inputs"]) == 16 and len(fx["inputs"][0]) == 304
    assert len(fx["logits"][0]) == 12
    assert np.abs(np.array(fx["logits"])).max() > 0.1
```

Run: `cd train && uv run pytest tests/test_hf_export.py -q 2>&1 | tail -3` → falla (no existe `export_hf`).

- [ ] **Step 3: script de exportación**

`train/scripts/export_hf.py`:

```python
"""Exporta la red de estrategia a los formatos de Hugging Face y mide la paridad entre implementaciones.

  uv run python scripts/export_hf.py [--model ../models/strategy.tcfrw] [--out ../hf]
      [--fixture ../web/src/engine/parity-fixture.json]

Deja en --out: model.safetensors (pesos), model.onnx (red completa, entrada uint8[batch, 304]),
strategy.tcfrw (el formato propio que usa el motor) y config.json.
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
from pathlib import Path

import numpy as np
import torch
import truco_engine_py as eng
from safetensors.torch import save_file

from truco_train.model import ScaledMlp
from truco_train.weights import read_tcfrw1

ACTIONS = ["jugar0", "jugar1", "jugar2", "envido", "realEnvido", "faltaEnvido",
           "truco", "retruco", "valeCuatro", "quiero", "noQuiero", "mazo"]


def load(model: Path) -> ScaledMlp:
    layers, scale = read_tcfrw1(model.read_bytes())
    hidden = layers[0][0].shape[0]
    net = ScaledMlp(scale, hidden, len(layers) - 1, layers[-1][0].shape[0])
    with torch.no_grad():
        for lin, (w, b) in zip(net.linears(), layers):
            lin.weight.copy_(torch.from_numpy(w.copy()))
            lin.bias.copy_(torch.from_numpy(b.copy()))
    net.eval()
    assert net.to_bytes() == model.read_bytes(), "la red cargada no reproduce el archivo"
    return net


def encodings(n: int, seed: int = 0) -> np.ndarray:
    """Situaciones reales de truco (de manos jugadas al azar), como las ve cada jugador."""
    rng = random.Random(seed)
    rows, k = [], 0
    while len(rows) < n:
        hand = eng.Hand(seed * 100_000 + k)
        k += 1
        while not hand.is_terminal() and len(rows) < n:
            rows.append(hand.encode(hand.current_player()))
            mask = hand.legal_mask()
            hand.apply(rng.choice([a for a in range(12) if mask & (1 << a)]))
    return np.frombuffer(b"".join(rows), dtype=np.uint8).reshape(n, 304)


def export(model: Path, out: Path, fixture: Path | None = None, n_fixture: int = 64) -> None:
    out.mkdir(parents=True, exist_ok=True)
    net = load(model)
    save_file({k: v.contiguous() for k, v in net.state_dict().items()}, str(out / "model.safetensors"))
    torch.onnx.export(net, (torch.zeros(1, 304, dtype=torch.uint8),), str(out / "model.onnx"),
                      input_names=["features"], output_names=["logits"],
                      dynamic_axes={"features": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, dynamo=False)
    shutil.copyfile(model, out / "strategy.tcfrw")
    layers = net.linears()
    config = {
        "architecture": "MLP (ReLU), entrada uint8 multiplicada por input_scale",
        "input_size": 304, "hidden": layers[0].out_features, "n_hidden": len(layers) - 1,
        "n_actions": 12, "actions": ACTIONS,
        "policy": "softmax de los logits sobre las acciones legales (red de estrategia promedio de Deep CFR)",
        "encoding": "engine/src/truco/encode.rs",
    }
    (out / "config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    if fixture is not None:
        x = encodings(n_fixture, seed=7)
        with torch.no_grad():
            y = net(torch.from_numpy(x.copy())).numpy()
        fixture.write_text(json.dumps({"inputs": x.tolist(), "logits": y.tolist()}) + "\n", encoding="utf-8")


def parity(model: Path, onnx_path: Path, n: int = 2000) -> dict:
    """Diferencia máxima absoluta de los logits contra PyTorch."""
    import onnxruntime as ort

    net = load(model)
    x = encodings(n)
    with torch.no_grad():
        ref = net(torch.from_numpy(x.copy())).numpy()
    rust = np.frombuffer(eng.mlp_forward(model.read_bytes(), x.tobytes()), dtype="<f4").reshape(n, 12)
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    onnx = sess.run(["logits"], {"features": x})[0]
    return {"rust": float(np.abs(rust - ref).max()), "onnx": float(np.abs(onnx - ref).max())}


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    p = argparse.ArgumentParser()
    p.add_argument("--model", type=Path, default=root / "models" / "strategy.tcfrw")
    p.add_argument("--out", type=Path, default=root / "hf")
    p.add_argument("--fixture", type=Path, default=root / "web" / "src" / "engine" / "parity-fixture.json")
    a = p.parse_args()
    export(a.model, a.out, a.fixture)
    print("paridad (máx |Δ| contra PyTorch):", parity(a.model, a.out / "model.onnx"))


if __name__ == "__main__":
    main()
```

Run: `cd train && uv run pytest tests/test_hf_export.py -q 2>&1 | tail -3` → 3 passed.

Si `torch.onnx.export(..., dynamo=False)` se queja del tipo `uint8`, exportar con la entrada `float32` (cambiar el dummy a `torch.zeros(1, 304)` y en `parity` pasar `x.astype(np.float32)`) y anotar en `config.json` que la entrada es float con valores enteros de 0 a 255.

- [ ] **Step 4: generar `hf/` y el fixture del WASM**

Run: `cd train && uv run python scripts/export_hf.py 2>&1 | tail -2`
Expected: `paridad (máx |Δ| contra PyTorch): {'rust': <1e-4, 'onnx': <1e-4}`.

`hf/.gitignore`:

```
# Se generan con train/scripts/export_hf.py y se suben a Hugging Face, no a git.
model.safetensors
model.onnx
strategy.tcfrw
```

- [ ] **Step 5: paridad del WASM**

`web/src/engine/parity.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { initSync, WasmMatch } from './pkg/truco_engine_wasm.js';
import fixture from './parity-fixture.json';

initSync({ module: readFileSync(new URL('./pkg/truco_engine_wasm_bg.wasm', import.meta.url)) });
const model = readFileSync(new URL('../../../models/strategy.tcfrw', import.meta.url));

it('el WASM da los mismos logits que PyTorch (|Δ| < 1e-4)', () => {
  const m = new WasmMatch(model, 0);
  const x = Uint8Array.from(fixture.inputs.flat());
  const got = m.logits(x);
  const want = fixture.logits.flat();
  expect(got.length).toBe(want.length);
  let worst = 0;
  want.forEach((w, i) => {
    worst = Math.max(worst, Math.abs(got[i]! - w));
  });
  expect(worst).toBeLessThan(1e-4);
});
```

Run: `cd web && npx vitest run src/engine/parity.test.ts 2>&1 | tail -3` → passed.

- [ ] **Step 6: ficha del modelo**

`hf/README.md` (en inglés; YAML de Hugging Face arriba):

```markdown
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
```

- [ ] **Step 7: verificación y commit**

Run: `cd train && uv run pytest -q 2>&1 | tail -2 && cd ../web && npm test 2>&1 | tail -3`

```bash
git add train/pyproject.toml train/uv.lock train/scripts/export_hf.py train/tests/test_hf_export.py hf/README.md hf/.gitignore hf/config.json web/src/engine/parity-fixture.json web/src/engine/parity.test.ts
git commit -F /tmp/msg-t7.txt   # "feat: exportación a Hugging Face (safetensors, ONNX) y paridad PyTorch/Rust/ONNX/WASM"
```

---

### Task 8: README, licencia, CI, deploy, post y guion

**Files:**
- Create: `README.md`, `LICENSE`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `docs/linkedin/post.md`, `docs/linkedin/video-script.md`

**Interfaces:**
- Consumes: todo lo anterior (números de `docs/eval-report.md`, comandos de las Tareas 2, 5, 6 y 7).
- Produces: el repo listo para publicar. El README deja dos marcadores literales, `PLAY_URL` y `HF_URL`, que la Tarea 9 reemplaza cuando el usuario elija el nombre del repo de GitHub y del modelo.

- [ ] **Step 1: LICENSE**

`LICENSE`: texto MIT estándar con `Copyright (c) 2026 Tomás Villarreal`. Debajo del texto, una línea: `The card art in web/public/cards/ is NOT covered by this license; see web/public/cards/LICENSE-ART.md and NOTICE.`

- [ ] **Step 2: README en inglés**

`README.md`, con estas secciones en este orden (prosa breve, sin relleno):

1. Título "Truco CFR" y una línea: "An AI that learned to play (and bluff at) Argentine truco by playing against itself. Runs entirely in your browser."
2. Enlaces: "Play: PLAY_URL" · "Model: HF_URL" · captura `docs/img/mesa.png` (la saca la Tarea 9 desde el sitio publicado; hasta entonces, la línea de la imagen va comentada con `<!-- -->`).
3. "Results": la tabla de tres rivales (la misma de `hf/README.md`) y dos frases sobre el faroleo (38 % de envidos con ≤ 7; 17 % de trucos con mano floja contra 0 % del heurístico). Enlace a `docs/eval-report.md`.
4. "How it works" (inglés, 6 a 10 frases): Deep CFR en palabras simples (juega millones de manos contra sí mismo, anota cuánto se "arrepiente" de cada decisión, una red aprende a predecir esos arrepentimientos; la estrategia promedio converge a un equilibrio de Nash aproximado, por eso farolea en la proporción justa); motor en Rust compartido por el entrenamiento (PyO3) y la web (WebAssembly); entrenamiento de ~7 h en una RTX 5070 Ti; la web es estática (costo cero).
5. "Cómo funciona (en español)": la misma sección en español rioplatense.
6. "Repository layout": tabla `engine/`, `engine-py/`, `engine-wasm/`, `train/`, `eval/`, `web/`, `models/`, `hf/`, `docs/`.
7. "Reproduce": bloques de comandos: tests (`cargo test`, `cd web && npm ci && npm test`), compilar el WASM (`scripts/build-wasm.sh`), entrenar (`cd train && uv run python -m truco_train run --config configs/overnight.toml`), evaluar (los de `docs/eval-report.md`), datos de la web (`cargo run --release -p truco-engine-wasm --bin web-data`), exportar el modelo (`cd train && uv run python scripts/export_hf.py`).
8. "Credits and license": código y pesos MIT; "Card art by Jose Angel Canabal" (no MIT, ver `web/public/cards/LICENSE-ART.md`); Fosfo (la mascota) y el dorso son originales del proyecto.

- [ ] **Step 3: CI**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --check
      - run: cargo clippy --workspace --exclude truco-engine-py --all-targets -- -D warnings
      - run: cargo test

  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run size
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
```

Nota: `engine-py` (paquete `truco-engine-py`) necesita Python y PyO3 para compilar; por eso se excluye (`cargo test` en la raíz tampoco lo compila: no está en `default-members`). Verificar localmente que `cargo clippy --workspace --exclude truco-engine-py --all-targets -- -D warnings` pasa.

- [ ] **Step 4: deploy a GitHub Pages**

`.github/workflows/pages.yml`:

```yaml
name: Deploy a GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm run size
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

(`base: './'` en Vite hace que el sitio funcione en `https://<usuario>.github.io/<repo>/` sin configurar nada más; lo cubre el e2e en subcarpeta de la Tarea 6.)

- [ ] **Step 5: borradores del post y del guion (los escribe el controlador, no un subagente)**

`docs/linkedin/post.md`: post en español (con una versión corta en inglés debajo). Estructura: gancho de una línea ("Le enseñé a una IA a jugar al truco… y aprendió a mentir"); qué es (bot entrenado desde cero jugando contra sí mismo, sin partidas humanas); el dato llamativo (canta envido con 7 o menos el 38 % de las veces; contra Claude Haiku ganó el 59 % de 100 partidos y Haiku se achicó mucho menos que el heurístico); cómo (Deep CFR, Rust, una GPU de casa, corre en el navegador sin servidores); invitación a jugar (PLAY_URL) y enlaces (repo, modelo); hashtags (#AI #MachineLearning #Rust #WebAssembly #GameAI #Truco). Entre 150 y 250 palabras. Todos los números tienen que coincidir con `docs/eval-report.md`.

`docs/linkedin/video-script.md`: guion de 30 a 45 segundos en una tabla `Segundos | Pantalla | Voz/texto en pantalla`, con estas escenas: 0-3 s gancho (la mascota Fosfo y "¿Una IA puede mentir al truco?"); 3-12 s jugando en el celular (una mano real); 12-20 s rayos X prendidos mostrando las probabilidades en un farol; 20-28 s la repetición de la mano contra Haiku (10C, 4E, 4C, truco, "no quiero"); 28-36 s resultados (tabla y curva del envido); 36-45 s cierre con el enlace. Incluir notas de grabación: resolución vertical 1080×1920, grabar desde el navegador del celular o con el modo dispositivo de Chrome a 360×740, prender rayos X en Configuración, y la manera de llegar a la repetición (`#/manos`, primera de la lista).

- [ ] **Step 6: verificación y commit**

Run: `cargo clippy --workspace --exclude truco-engine-py --all-targets -- -D warnings 2>&1 | tail -2 && grep -n "PLAY_URL\|HF_URL" README.md docs/linkedin/*.md`
Expected: clippy limpio; los marcadores aparecen solo donde corresponde.

```bash
git add README.md LICENSE .github docs/linkedin
git commit -F /tmp/msg-t8.txt   # "docs: README (inglés y español), licencia MIT, CI, deploy a GitHub Pages, post y guion del video"
```

---

### Task 9: publicación (solo con OK explícito del usuario)

Esta tarea NO la ejecuta un subagente ni corre sola. Antes de cada paso, el controlador le explica al usuario qué va a pasar y espera un "sí".

- [ ] **Step 1: merge a main.** Con OK del usuario: `git merge --no-ff plan-4-web` desde main, y verificación completa en main (cargo test, fmt, clippy, `npm test`, `npm run build`, `npm run e2e`).
- [ ] **Step 2: repo en GitHub.** El usuario crea el repo vacío (público) en github.com con el nombre que elija (sugerido: `truco-cfr`) y en Settings → Pages elige "GitHub Actions" como fuente. Dice el usuario y el nombre. Con OK: `git remote add origin https://github.com/<usuario>/<repo>.git` y `git push -u origin main` (la autenticación la hace el usuario en su terminal si hace falta). En WSL no hay `gh`; no se instala nada.
- [ ] **Step 3: deploy.** El workflow de Pages corre solo con el push. Verificar el sitio publicado (`https://<usuario>.github.io/<repo>/`): jugar una mano en celular y escritorio, revisar que carguen las cuatro páginas y la licencia del arte.
- [ ] **Step 4: Hugging Face.** El usuario crea la cuenta o el repo del modelo y se loguea él mismo (`huggingface-cli login` en su terminal). Con OK: subir `hf/` (`huggingface-cli upload <usuario>/truco-cfr hf/ .`).
- [ ] **Step 5: enlaces.** Reemplazar `PLAY_URL` y `HF_URL` en `README.md` y `docs/linkedin/*.md`, sacar la captura `docs/img/mesa.png` del sitio publicado y descomentarla, agregar el enlace "Código" al pie de la web; commit y, con OK, push.
- [ ] **Step 6: lo que hace el usuario.** Escuchar el audio del sitio (nunca se escuchó: timbre y volumen de efectos y música), grabar el video con el guion y publicar el post.
