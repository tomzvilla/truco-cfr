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
            envido_calls: self
                .envido_calls
                .map(|c| c.map(|(k, caller)| (k, caller == p))),
            envido_status: self.envido_status,
            my_tantos: self.tantos[p],
            opp_revealed_tantos: self.revealed_tantos[o],
            my_score: self.score(p),
            opp_score: self.score(o),
            legal: if self.turn == p {
                self.legal_actions()
            } else {
                0
            },
        }
    }
}
