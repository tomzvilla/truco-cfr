//! MiniTruco: 6 cartas de fuerza 0..5 (5 la más alta), una carta por jugador, una sola baza.
//! El jugador 0 es mano. Cantos: truco (2), retruco (3), vale cuatro (4); quiero, no quiero, mazo.
//!
//! Las constantes de acción y la máquina de estados de cantos replican a propósito las del truco
//! completo; se mantienen separadas para que MiniTruco sea un juego de prueba chico y autocontenido.
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
        MiniTruco {
            cards: Some(cards),
            ..*self
        }
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
        d.into_iter()
            .map(|cards| (self.with_cards(cards), p))
            .collect()
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
