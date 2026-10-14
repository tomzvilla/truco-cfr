//! Partidos completos a 30 y formato duplicado.
use crate::agents::Agent;
use crate::cards::Card;
use crate::game::{bit, Action, Player};
use crate::truco::{deal, TrucoState, ACTION_NAMES, TARGET};
use rand::rngs::SmallRng;
use rand::{RngCore, SeedableRng};

/// Una mano jugada. Todo indexado por asiento (0 o 1).
#[derive(Clone, Debug)]
pub struct HandRecord {
    pub mano: Player,
    pub start_scores: [u8; 2],
    pub hands: [[Card; 3]; 2],
    pub actions: Vec<(Player, Action)>,
    pub points: [u8; 2],
}

#[derive(Clone, Debug)]
pub struct MatchResult {
    pub winner: Player,
    pub final_scores: [u8; 2],
    pub hands: Vec<HandRecord>,
}

pub struct DuplicateResult {
    pub a_as_seat0: MatchResult,
    pub a_as_seat1: MatchResult,
}

impl DuplicateResult {
    pub fn a_wins(&self) -> u32 {
        (self.a_as_seat0.winner == 0) as u32 + (self.a_as_seat1.winner == 1) as u32
    }
}

/// El reparto de la mano `k` depende solo de `deal_seed` y `k`, nunca de cómo jueguen los agentes.
fn deal_for(deal_seed: u64, k: u64) -> [[Card; 3]; 2] {
    let mut rng = SmallRng::seed_from_u64(deal_seed ^ k.wrapping_mul(0x9E37_79B9_7F4A_7C15));
    deal(&mut rng)
}

pub fn play_match(seats: [&mut dyn Agent; 2], deal_seed: u64, rng: &mut dyn RngCore) -> MatchResult {
    let mut scores = [0u8; 2];
    let mut hands = Vec::new();
    for k in 0u64.. {
        let dealt = deal_for(deal_seed, k);
        let mano = (k % 2) as Player;
        let mut s = TrucoState::new_hand(dealt, mano, scores);
        let mut actions = Vec::new();
        while !s.is_over() {
            let p = s.turn();
            let a = seats[p].act(&s.observation(p), rng);
            assert!(
                s.legal_actions() & bit(a) != 0,
                "el agente {} eligió una acción ilegal: {}",
                seats[p].name(),
                ACTION_NAMES.get(a).unwrap_or(&"?")
            );
            actions.push((p, a));
            s.apply(a);
        }
        hands.push(HandRecord {
            mano,
            start_scores: scores,
            hands: [s.hand(0), s.hand(1)],
            actions,
            points: s.points(),
        });
        scores = [s.score(0), s.score(1)];
        if let Some(winner) = (0..2).find(|&p| scores[p] >= TARGET) {
            return MatchResult { winner, final_scores: scores, hands };
        }
    }
    unreachable!()
}

pub fn play_duplicate(
    a: &mut dyn Agent,
    b: &mut dyn Agent,
    deal_seed: u64,
    rng: &mut dyn RngCore,
) -> DuplicateResult {
    let a_as_seat0 = play_match([&mut *a, &mut *b], deal_seed, rng);
    let a_as_seat1 = play_match([&mut *b, &mut *a], deal_seed, rng);
    DuplicateResult { a_as_seat0, a_as_seat1 }
}
