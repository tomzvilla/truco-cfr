use truco_engine::cfr::TabularCfr;
use truco_engine::exact::{expected_values, exploitability};
use truco_engine::game::Player;
use truco_engine::kuhn::Kuhn;

#[test]
fn uniform_policy_is_exploitable() {
    let uniform = |_: &Kuhn, _: Player| vec![0.5, 0.5];
    assert!(exploitability::<Kuhn>(&uniform) > 0.1);
}

#[test]
fn cfr_converges_on_kuhn() {
    let mut cfr = TabularCfr::<Kuhn>::new();
    cfr.run(2000);
    assert_eq!(cfr.iterations(), 2000);
    let policy = |s: &Kuhn, p: Player| cfr.average_strategy(s, p);
    let expl = exploitability::<Kuhn>(&policy);
    assert!(expl < 0.01, "explotabilidad demasiado alta: {expl}");
    let v = expected_values::<Kuhn>(&policy);
    assert!(
        (v[0] + 1.0 / 18.0).abs() < 0.01,
        "valor del jugador 0: {}",
        v[0]
    );
    assert!((v[0] + v[1]).abs() < 1e-9, "tiene que ser suma cero");
}

#[test]
fn exploitability_decreases_with_iterations() {
    let mut cfr = TabularCfr::<Kuhn>::new();
    cfr.run(20);
    let early = exploitability::<Kuhn>(&|s: &Kuhn, p: Player| cfr.average_strategy(s, p));
    cfr.run(980);
    let late = exploitability::<Kuhn>(&|s: &Kuhn, p: Player| cfr.average_strategy(s, p));
    assert!(late < early, "early={early} late={late}");
}
