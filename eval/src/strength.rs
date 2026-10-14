//! Fuerza de una mano para el truco: probabilidad de ganar las bazas contra una mano al azar si
//! los dos tiran cartas con la regla del heurístico y nadie canta. Es una equidad heurística.
use rand::rngs::SmallRng;
use rand::seq::SliceRandom;
use rand::SeedableRng;
use std::collections::HashMap;
use truco_engine::agents::heuristic_card;
use truco_engine::cards::{full_deck, Card};
use truco_engine::truco::TrucoState;

/// "Mano floja" = percentil de fuerza menor que esto.
pub const WEAK: f64 = 0.30;

type Key = [u8; 3];

fn key(hand: [Card; 3]) -> Key {
    let mut k = hand.map(|c| c.id());
    k.sort_unstable();
    k
}

pub struct StrengthTable {
    /// Equidad por mano: [como pie, como mano].
    equity: HashMap<Key, [f64; 2]>,
    /// Equidades ordenadas de las 9880 manos, por rol.
    sorted: [Vec<f64>; 2],
}

/// Gana las bazas la mano `hand` (asiento 0) contra `opp`, tirando cartas con la regla del heurístico.
fn wins(hand: [Card; 3], opp: [Card; 3], is_mano: bool) -> bool {
    let mut s = TrucoState::new_hand([hand, opp], if is_mano { 0 } else { 1 }, [0, 0]);
    while !s.is_over() {
        let p = s.turn();
        s.apply(heuristic_card(&s.observation(p)));
    }
    s.points()[0] > 0
}

fn equity_of(k: Key, is_mano: bool, samples: u32, seed: u64) -> f64 {
    let hand = k.map(Card::from_id);
    let rest: Vec<Card> = full_deck()
        .into_iter()
        .filter(|c| !k.contains(&c.id()))
        .collect();
    let tag = (k[0] as u64) << 16 | (k[1] as u64) << 8 | k[2] as u64;
    let mut rng = SmallRng::seed_from_u64(seed ^ tag.wrapping_mul(0x9E37_79B9) ^ is_mano as u64);
    let won = (0..samples)
        .filter(|_| {
            let opp: Vec<Card> = rest.choose_multiple(&mut rng, 3).copied().collect();
            wins(hand, [opp[0], opp[1], opp[2]], is_mano)
        })
        .count();
    won as f64 / samples as f64
}

impl StrengthTable {
    pub fn build(samples: u32, seed: u64, threads: usize) -> StrengthTable {
        let mut keys = Vec::with_capacity(9880);
        for a in 0..40u8 {
            for b in a + 1..40 {
                for c in b + 1..40 {
                    keys.push([a, b, c]);
                }
            }
        }
        let threads = threads.max(1);
        let parts: Vec<Vec<(Key, [f64; 2])>> = std::thread::scope(|s| {
            let handles: Vec<_> = (0..threads)
                .map(|w| {
                    let keys = &keys;
                    s.spawn(move || {
                        keys.iter()
                            .skip(w)
                            .step_by(threads)
                            .map(|&k| {
                                (
                                    k,
                                    [
                                        equity_of(k, false, samples, seed),
                                        equity_of(k, true, samples, seed),
                                    ],
                                )
                            })
                            .collect()
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().expect("hilo de la tabla de fuerza"))
                .collect()
        });
        let equity: HashMap<Key, [f64; 2]> = parts.into_iter().flatten().collect();
        let sorted = [0, 1].map(|r| {
            let mut v: Vec<f64> = equity.values().map(|e| e[r]).collect();
            v.sort_by(|a, b| a.partial_cmp(b).expect("equidad no numérica"));
            v
        });
        StrengthTable { equity, sorted }
    }

    pub fn equity(&self, hand: [Card; 3], is_mano: bool) -> f64 {
        self.equity[&key(hand)][is_mano as usize]
    }

    /// Fracción de las manos posibles más flojas que esta (los empates cuentan la mitad).
    pub fn percentile(&self, hand: [Card; 3], is_mano: bool) -> f64 {
        let e = self.equity(hand, is_mano);
        let v = &self.sorted[is_mano as usize];
        let below = v.partition_point(|&x| x < e);
        let not_above = v.partition_point(|&x| x <= e);
        (below as f64 + 0.5 * (not_above - below) as f64) / v.len() as f64
    }

    /// Percentil de cada una de las 9880 manos (para tests y gráficos).
    pub fn all_percentiles(&self, is_mano: bool) -> impl Iterator<Item = f64> + '_ {
        self.equity
            .keys()
            .map(move |k| self.percentile(k.map(Card::from_id), is_mano))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(s: &str) -> [Card; 3] {
        let v: Vec<Card> = s
            .split_whitespace()
            .map(|c| Card::parse(c).unwrap())
            .collect();
        [v[0], v[1], v[2]]
    }

    #[test]
    fn the_best_hand_beats_the_worst() {
        let t = StrengthTable::build(200, 1, 4);
        let best = h("1E 1B 7E");
        let worst = h("4E 4B 4O");
        for mano in [true, false] {
            assert!(t.equity(best, mano) > 0.95, "{}", t.equity(best, mano));
            assert!(t.equity(worst, mano) < 0.2, "{}", t.equity(worst, mano));
            assert!(t.percentile(best, mano) > 0.98);
            assert!(t.percentile(worst, mano) < 0.05);
        }
    }

    #[test]
    fn order_of_cards_does_not_matter_and_percentiles_are_spread() {
        let t = StrengthTable::build(100, 2, 4);
        assert_eq!(t.equity(h("3C 1E 4O"), true), t.equity(h("4O 3C 1E"), true));
        let weak = t.all_percentiles(true).filter(|&p| p < WEAK).count() as f64 / 9880.0;
        assert!((weak - WEAK).abs() < 0.04, "{weak}");
    }

    #[test]
    fn build_is_reproducible() {
        let a = StrengthTable::build(50, 9, 1);
        let b = StrengthTable::build(50, 9, 3);
        assert_eq!(
            a.equity(h("2E 5C 12O"), false),
            b.equity(h("2E 5C 12O"), false)
        );
    }
}
