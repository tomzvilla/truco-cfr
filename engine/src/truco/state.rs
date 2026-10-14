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
