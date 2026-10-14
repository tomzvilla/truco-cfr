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
        matches!(
            self.history.as_slice(),
            [0, 0] | [1, 0] | [1, 1] | [0, 1, 0] | [0, 1, 1]
        )
    }
}

impl Game for Kuhn {
    const NUM_ACTIONS: usize = 2;
    const ENCODING_SIZE: usize = 9;

    fn root() -> Self {
        Kuhn {
            cards: None,
            history: vec![],
        }
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
        Kuhn {
            cards: Some(DEALS[rng.gen_range(0..DEALS.len())]),
            history: vec![],
        }
    }

    fn legal_actions(&self) -> ActionMask {
        match self.node() {
            Node::Decision(_) => 0b11,
            _ => 0,
        }
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

    /// 9 bytes = carta propia one-hot (3) + 2 lugares de historia × (vacío, pasar, apostar) (6).
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
            .map(|&d| {
                (
                    Kuhn {
                        cards: Some(d),
                        history: vec![],
                    },
                    1.0 / 6.0,
                )
            })
            .collect()
    }

    fn infoset_key(&self, p: Player) -> u64 {
        let card = self.cards.expect("sin repartir")[p] as u64;
        let bits = self
            .history
            .iter()
            .enumerate()
            .fold(0u64, |acc, (i, &a)| acc | ((a as u64) << i));
        card | ((self.history.len() as u64) << 2) | (bits << 4) | ((p as u64) << 63)
    }
}
