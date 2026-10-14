use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::sync::Arc;
use truco_engine::mlp::Mlp;
use truco_engine::truco::{feature_scale, ENCODING_SIZE};
use truco_eval::bluff::analyze;
use truco_eval::strength::StrengthTable;

fn tiny_net() -> Arc<Mlp> {
    let mut rng = SmallRng::seed_from_u64(3);
    Arc::new(Mlp::random(
        &[ENCODING_SIZE, 16, 12],
        feature_scale(),
        &mut rng,
    ))
}

#[test]
fn envido_curve_has_only_possible_tantos_and_valid_numbers() {
    let table = StrengthTable::build(30, 1, 8);
    let (curve, low, contention, truco) = analyze(Some(tiny_net()), &table, 3000, 5);
    assert!(!curve.is_empty());
    for p in &curve {
        assert!(
            p.tantos <= 7 || (20..=33).contains(&p.tantos),
            "tantos imposibles: {}",
            p.tantos
        );
        assert!(p.n > 0);
        for x in [p.p_any, p.p_envido, p.p_real, p.p_falta] {
            assert!(x.is_finite() && (0.0..=1.0).contains(&x));
        }
        assert!((p.p_any - (p.p_envido + p.p_real + p.p_falta)).abs() < 1e-9);
        assert!(p.called <= p.n);
        assert!(p.role == "mano" || p.role == "pie");
    }
    for r in low.iter().chain(&contention) {
        assert!(r.rate.is_finite() && r.p_any.is_finite());
    }
    assert!(truco.weak_calls <= truco.calls);
    let json = serde_json::to_string(&curve).unwrap();
    assert!(!json.contains("null") && !json.contains("NaN"));
}

#[test]
fn the_heuristic_never_bluffs() {
    let table = StrengthTable::build(30, 1, 8);
    let (curve, low, _, truco) = analyze(None, &table, 3000, 6);
    // Canta envido solo con 27 o más, y truco solo con dos cartas altas.
    for p in curve.iter().filter(|p| p.tantos < 27) {
        assert_eq!(p.called, 0, "{p:?}");
        assert_eq!(p.p_any, 0.0);
    }
    assert!(low.iter().all(|r| r.called == 0));
    assert!(truco.calls > 0);
    assert!(truco.weak_share < 0.05, "{truco:?}");
}
