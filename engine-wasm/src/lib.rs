//! El motor en el navegador: la mesa como la ve la web y el partido contra el bot.
pub mod controller;
pub mod mood;
pub mod view;

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
