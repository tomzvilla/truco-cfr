use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::agents::{HeuristicAgent, RandomAgent};
use truco_engine::match_runner::{play_duplicate, play_match};
use truco_engine::truco::TARGET;

#[test]
fn match_ends_with_one_winner_at_30() {
    let mut rng = SmallRng::seed_from_u64(1);
    let (mut a, mut b) = (RandomAgent, RandomAgent);
    let r = play_match([&mut a, &mut b], 42, &mut rng);
    assert_eq!(r.final_scores[r.winner], TARGET);
    assert!(r.final_scores[1 - r.winner] < TARGET);
    for (k, h) in r.hands.iter().enumerate() {
        assert_eq!(h.mano, k % 2, "el mano se alterna");
    }
    let total: u32 = r
        .hands
        .iter()
        .map(|h| (h.points[0] + h.points[1]) as u32)
        .sum();
    assert_eq!(total, (r.final_scores[0] + r.final_scores[1]) as u32);
}

#[test]
fn duplicate_uses_same_deals_by_seat() {
    let mut rng = SmallRng::seed_from_u64(2);
    let (mut a, mut b) = (HeuristicAgent, RandomAgent);
    let d = play_duplicate(&mut a, &mut b, 99, &mut rng);
    let n = d.a_as_seat0.hands.len().min(d.a_as_seat1.hands.len());
    assert!(
        n > 0,
        "el duplicado tiene que haber jugado manos en ambos partidos"
    );
    for k in 0..n {
        assert_eq!(d.a_as_seat0.hands[k].hands, d.a_as_seat1.hands[k].hands);
    }
    for m in [&d.a_as_seat0, &d.a_as_seat1] {
        assert_eq!(
            m.final_scores[m.winner], TARGET,
            "el ganador de cada partido llegó a 30"
        );
    }
}

#[test]
fn heuristic_beats_random() {
    let mut rng = SmallRng::seed_from_u64(3);
    let (mut h, mut r) = (HeuristicAgent, RandomAgent);
    let mut wins = 0;
    for seed in 0..100 {
        wins += play_duplicate(&mut h, &mut r, seed, &mut rng).a_wins();
    }
    let rate = wins as f64 / 200.0;
    eprintln!("HEURISTIC_VS_RANDOM_RATE {rate}");
    assert!(
        rate >= 0.8,
        "el heurístico ganó solo el {:.0}%",
        rate * 100.0
    );
}
