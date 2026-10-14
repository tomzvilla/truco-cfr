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
