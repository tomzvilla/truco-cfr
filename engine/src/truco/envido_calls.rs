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
            let winner = if self.tantos[mano] >= self.tantos[pie] {
                mano
            } else {
                pie
            };
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
                calls[..n - 1]
                    .iter()
                    .flatten()
                    .map(|&(k, _)| kind_value(k))
                    .sum()
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
