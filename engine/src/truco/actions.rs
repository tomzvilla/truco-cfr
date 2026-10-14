//! Índices fijos de acciones. El orden es un contrato con la web y con los pesos entrenados.
use crate::game::Action;

pub const JUGAR0: Action = 0;
pub const JUGAR1: Action = 1;
pub const JUGAR2: Action = 2;
pub const ENVIDO: Action = 3;
pub const REAL_ENVIDO: Action = 4;
pub const FALTA_ENVIDO: Action = 5;
pub const TRUCO: Action = 6;
pub const RETRUCO: Action = 7;
pub const VALE_CUATRO: Action = 8;
pub const QUIERO: Action = 9;
pub const NO_QUIERO: Action = 10;
pub const MAZO: Action = 11;
pub const NUM_ACTIONS: usize = 12;

pub const ACTION_NAMES: [&str; NUM_ACTIONS] = [
    "jugar0",
    "jugar1",
    "jugar2",
    "envido",
    "realEnvido",
    "faltaEnvido",
    "truco",
    "retruco",
    "valeCuatro",
    "quiero",
    "noQuiero",
    "mazo",
];
