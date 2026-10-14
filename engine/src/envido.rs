//! Cálculo de los tantos del envido.
use crate::cards::Card;

/// Tantos de una mano: 20 + la mejor pareja del mismo palo, o la carta más alta si no hay pareja.
pub fn envido_points(hand: &[Card]) -> u8 {
    let mut best = 0;
    for i in 0..hand.len() {
        best = best.max(hand[i].envido_value());
        for j in i + 1..hand.len() {
            if hand[i].suit() == hand[j].suit() {
                best = best.max(20 + hand[i].envido_value() + hand[j].envido_value());
            }
        }
    }
    best
}
