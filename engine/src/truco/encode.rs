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
