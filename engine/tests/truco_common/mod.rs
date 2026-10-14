#![allow(dead_code)]
use truco_engine::cards::Card;
use truco_engine::game::bit;
use truco_engine::truco::{TrucoState, ACTION_NAMES};

pub fn hand(s: &str) -> [Card; 3] {
    let v: Vec<Card> = s
        .split_whitespace()
        .map(|t| Card::parse(t).unwrap())
        .collect();
    [v[0], v[1], v[2]]
}

/// Mano nueva: jugador 0 es mano, puntaje 0 a 0.
pub fn new(p0: &str, p1: &str) -> TrucoState {
    TrucoState::new_hand([hand(p0), hand(p1)], 0, [0, 0])
}

pub fn new_with(p0: &str, p1: &str, mano: usize, scores: [u8; 2]) -> TrucoState {
    TrucoState::new_hand([hand(p0), hand(p1)], mano, scores)
}

pub fn play(mut s: TrucoState, actions: &[usize]) -> TrucoState {
    for &a in actions {
        assert!(
            s.legal_actions() & bit(a) != 0,
            "acción ilegal {} (legales: {:#014b})",
            ACTION_NAMES[a],
            s.legal_actions()
        );
        s.apply(a);
    }
    s
}

pub fn mask(actions: &[usize]) -> u16 {
    actions.iter().fold(0, |m, &a| m | bit(a))
}
