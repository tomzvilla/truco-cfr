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
        let (level, _) = self
            .truco_pending
            .take()
            .expect("quiero sin truco pendiente");
        self.truco_level = level;
        self.truco_holder = Some(p);
        self.turn = self.truco_resume;
    }

    pub(crate) fn decline_truco(&mut self) {
        let (_, caller) = self
            .truco_pending
            .take()
            .expect("no quiero sin truco pendiente");
        self.award(caller, self.truco_level);
        self.over = true;
    }
}
