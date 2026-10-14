use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::game::bit;
use truco_engine::mlp::{Layer, Mlp};
use truco_engine::policy::{
    masked_softmax, policy_probs, regret_matching, sample_action, uniform, PolicyKind,
};

fn close(a: &[f32], b: &[f32]) {
    assert_eq!(a.len(), b.len());
    for (x, y) in a.iter().zip(b) {
        assert!((x - y).abs() < 1e-6, "{a:?} != {b:?}");
    }
}

#[test]
fn regret_matching_is_proportional_to_the_positive_part() {
    let adv = [2.0, -1.0, 6.0];
    let p = regret_matching(&adv, bit(0) | bit(1) | bit(2));
    close(&p[..3], &[0.25, 0.0, 0.75]);
    assert!(p[3..].iter().all(|&x| x == 0.0));
}

#[test]
fn regret_matching_ignores_illegal_actions_even_with_big_advantage() {
    let adv = [1.0, 100.0, 1.0];
    let p = regret_matching(&adv, bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn regret_matching_without_positive_regret_picks_the_best_legal_action() {
    let p = regret_matching(&[-3.0, -1.0, -2.0], bit(0) | bit(1) | bit(2));
    close(&p[..3], &[0.0, 1.0, 0.0]);
    // La acción 1 no es legal: gana la mejor de las legales (la 2).
    let p = regret_matching(&[-3.0, 5.0, -2.0], bit(0) | bit(2));
    close(&p[..3], &[0.0, 0.0, 1.0]);
}

#[test]
fn regret_matching_with_nan_is_uniform_over_legal() {
    let p = regret_matching(&[f32::NAN, f32::NAN, f32::NAN], bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn masked_softmax_is_uniform_for_equal_logits_and_zero_on_illegal() {
    let p = masked_softmax(&[0.0, 0.0, 0.0], bit(0) | bit(2));
    close(&p[..3], &[0.5, 0.0, 0.5]);
}

#[test]
fn masked_softmax_is_stable_for_huge_logits() {
    let p = masked_softmax(&[1000.0, 999.0], bit(0) | bit(1));
    assert!(p.iter().all(|x| x.is_finite()));
    assert!((p[0] + p[1] - 1.0).abs() < 1e-6);
    assert!(p[0] > p[1]);
}

#[test]
#[should_panic(expected = "fuera de las")]
fn rejects_mask_outside_the_network_outputs() {
    regret_matching(&[1.0, 2.0], bit(5));
}

#[test]
#[should_panic(expected = "máscara vacía")]
fn rejects_empty_mask() {
    uniform(0);
}

#[test]
fn policy_probs_without_net_is_uniform() {
    let p = policy_probs(
        None,
        PolicyKind::Advantage,
        &[0u8; 304],
        bit(3) | bit(9) | bit(11),
    );
    close(&p[..12], &uniform(bit(3) | bit(9) | bit(11))[..12]);
}

#[test]
fn policy_probs_applies_the_requested_rule_to_the_net_output() {
    // Una sola capa con pesos 0: la salida es exactamente el sesgo.
    let bias: Vec<f32> = (0..12).map(|i| i as f32 - 4.0).collect();
    let net = Mlp::new(
        vec![Layer {
            inp: 304,
            out: 12,
            w: vec![0.0; 304 * 12],
            b: bias.clone(),
        }],
        vec![1.0; 304],
    );
    let mask = bit(2) | bit(5) | bit(6) | bit(9);
    let x = [0u8; 304];
    close(
        &policy_probs(Some(&net), PolicyKind::Advantage, &x, mask),
        &regret_matching(&bias, mask),
    );
    close(
        &policy_probs(Some(&net), PolicyKind::Strategy, &x, mask),
        &masked_softmax(&bias, mask),
    );
}

#[test]
fn sample_action_follows_the_probabilities_and_the_mask() {
    let mut rng = SmallRng::seed_from_u64(5);
    let mask = bit(0) | bit(2);
    let probs = regret_matching(&[1.0, 0.0, 3.0], mask);
    let mut counts = [0u32; 3];
    for _ in 0..20_000 {
        counts[sample_action(&probs, mask, &mut rng)] += 1;
    }
    assert_eq!(counts[1], 0, "acción ilegal elegida");
    let share = counts[2] as f64 / 20_000.0;
    assert!((share - 0.75).abs() < 0.02, "participación {share}");
}
