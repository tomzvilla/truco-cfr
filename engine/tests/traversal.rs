use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::game::{bit, Game};
use truco_engine::kuhn::Kuhn;
use truco_engine::mlp::Mlp;
use truco_engine::traversal::run_traversals;
use truco_engine::truco::{feature_scale, TrucoGame, ENCODING_SIZE, NUM_ACTIONS};

#[test]
fn kuhn_uniform_traversal_has_consistent_samples() {
    let out = run_traversals::<Kuhn>([None, None], 0, 7, 0, 200);
    assert!(!out.adv.is_empty() && !out.strat.is_empty());
    assert_eq!(out.adv.enc.len(), out.adv.len() * Kuhn::ENCODING_SIZE);
    assert_eq!(out.adv.values.len(), out.adv.len() * 2);
    assert_eq!(out.strat.values.len(), out.strat.len() * 2);
    assert!(out.nodes >= (out.adv.len() + out.strat.len()) as u64);
    for (i, &m) in out.adv.masks.iter().enumerate() {
        assert_eq!(m, 0b11);
        // Con estrategia uniforme, sum(prob * arrepentimiento) = 0.
        let r = &out.adv.values[i * 2..i * 2 + 2];
        assert!((r[0] + r[1]).abs() < 1e-5, "arrepentimientos {r:?}");
    }
    for i in 0..out.strat.len() {
        let p = &out.strat.values[i * 2..i * 2 + 2];
        assert!((p[0] - 0.5).abs() < 1e-6 && (p[1] - 0.5).abs() < 1e-6);
    }
}

#[test]
fn kuhn_regret_of_betting_with_a_king_matches_the_hand_computation() {
    // Jugador 0 con K, primer turno, todos uniformes: apostar vale 1.5, pasar vale 0.75,
    // valor del nodo 1.125 => arrepentimiento de apostar +0.375 y de pasar -0.375.
    let out = run_traversals::<Kuhn>([None, None], 0, 11, 0, 6000);
    let (mut n, mut bet, mut pass) = (0.0f64, 0.0f64, 0.0f64);
    for i in 0..out.adv.len() {
        let e = &out.adv.enc[i * 9..(i + 1) * 9];
        let is_root_with_king = e[2] == 1 && e[3] == 1 && e[6] == 1;
        if is_root_with_king {
            n += 1.0;
            pass += out.adv.values[i * 2] as f64;
            bet += out.adv.values[i * 2 + 1] as f64;
        }
    }
    assert!(n > 500.0, "muy pocas muestras: {n}");
    assert!((bet / n - 0.375).abs() < 0.05, "apostar: {}", bet / n);
    assert!((pass / n + 0.375).abs() < 0.05, "pasar: {}", pass / n);
}

#[test]
fn traversals_are_deterministic_and_independent_of_chunking() {
    let whole = run_traversals::<Kuhn>([None, None], 1, 3, 0, 40);
    let again = run_traversals::<Kuhn>([None, None], 1, 3, 0, 40);
    assert_eq!(whole.adv.enc, again.adv.enc);
    assert_eq!(whole.adv.values, again.adv.values);
    let mut parts = run_traversals::<Kuhn>([None, None], 1, 3, 0, 25);
    parts.append(run_traversals::<Kuhn>([None, None], 1, 3, 25, 15));
    assert_eq!(whole.adv.enc, parts.adv.enc);
    assert_eq!(whole.adv.values, parts.adv.values);
    assert_eq!(whole.strat.enc, parts.strat.enc);
    assert_eq!(whole.strat.masks, parts.strat.masks);
    assert_eq!(whole.nodes, parts.nodes);
    let other = run_traversals::<Kuhn>([None, None], 1, 4, 0, 40);
    assert_ne!(whole.adv.enc, other.adv.enc, "otra semilla, otras manos");
}

#[test]
fn truco_traversal_with_random_nets_emits_valid_samples() {
    let mut rng = SmallRng::seed_from_u64(1);
    let a = Mlp::random(&[ENCODING_SIZE, 32, NUM_ACTIONS], feature_scale(), &mut rng);
    let b = Mlp::random(&[ENCODING_SIZE, 32, NUM_ACTIONS], feature_scale(), &mut rng);
    let out = run_traversals::<TrucoGame>([Some(&a), Some(&b)], 1, 5, 0, 30);
    assert!(
        out.adv.len() >= 10,
        "casi todos los recorridos tienen alguna decisión propia (salvo si el mano cierra de entrada)"
    );
    assert!(!out.strat.is_empty());
    assert_eq!(out.adv.enc.len(), out.adv.len() * ENCODING_SIZE);
    for blk in [&out.adv, &out.strat] {
        assert_eq!(blk.width, NUM_ACTIONS);
        for i in 0..blk.len() {
            let m = blk.masks[i];
            assert_ne!(m, 0);
            let v = &blk.values[i * NUM_ACTIONS..(i + 1) * NUM_ACTIONS];
            for (act, &x) in v.iter().enumerate() {
                if m & bit(act) == 0 {
                    assert_eq!(x, 0.0, "valor distinto de cero en una acción ilegal");
                }
            }
        }
    }
    for i in 0..out.strat.len() {
        let p = &out.strat.values[i * NUM_ACTIONS..(i + 1) * NUM_ACTIONS];
        assert!((p.iter().sum::<f32>() - 1.0).abs() < 1e-4);
    }
}

#[test]
fn kuhn_samples_belong_to_the_right_player() {
    // El jugador 0 decide con la historia vacía o con 2 jugadas; el jugador 1, con 1 jugada.
    // Con 1 jugada, el primer lugar de la historia está ocupado y el segundo vacío.
    let out = run_traversals::<Kuhn>([None, None], 0, 21, 0, 300);
    for i in 0..out.adv.len() {
        let e = &out.adv.enc[i * 9..(i + 1) * 9];
        assert!(
            !(e[3] == 0 && e[6] == 1),
            "muestra de ventaja en un nodo del rival"
        );
    }
    for i in 0..out.strat.len() {
        let e = &out.strat.enc[i * 9..(i + 1) * 9];
        assert!(
            e[3] == 0 && e[6] == 1,
            "muestra de estrategia fuera de un nodo del rival"
        );
    }
}

#[test]
fn truco_start_scores_follow_the_training_distribution() {
    let mut rng = SmallRng::seed_from_u64(4);
    let n = 4000;
    let mut zero_zero = 0;
    let mut seen = std::collections::HashSet::new();
    for _ in 0..n {
        let g = TrucoGame::root().sample_chance(&mut rng);
        let s = g.state();
        let scores = [s.score(0), s.score(1)];
        assert!(
            scores.iter().all(|&x| x < 30),
            "puntaje de inicio {scores:?}"
        );
        if scores == [0, 0] {
            zero_zero += 1;
        }
        seen.insert(scores[0]);
    }
    let share = zero_zero as f64 / n as f64;
    assert!((share - 0.3).abs() < 0.03, "el 0-0 aparece el {share:.3}");
    assert_eq!(
        seen.len(),
        30,
        "los puntajes 0..29 tienen que aparecer todos"
    );
}
