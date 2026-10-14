use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::sync::Arc;
use truco_engine::agents::RandomAgent;
use truco_engine::exact::exploitability;
use truco_engine::game::{bit, Player};
use truco_engine::kuhn::Kuhn;
use truco_engine::match_runner::play_duplicate;
use truco_engine::mlp::{Layer, Mlp};
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::net_eval::net_exploitability;
use truco_engine::policy::PolicyKind;
use truco_engine::truco::{deal, feature_scale, TrucoState, ENCODING_SIZE, NUM_ACTIONS};

fn random_net(seed: u64) -> Arc<Mlp> {
    let mut rng = SmallRng::seed_from_u64(seed);
    Arc::new(Mlp::random(
        &[ENCODING_SIZE, 32, NUM_ACTIONS],
        feature_scale(),
        &mut rng,
    ))
}

#[test]
fn mlp_agent_only_plays_legal_moves_in_full_matches() {
    // play_match hace panic si el agente elige una acción ilegal.
    for kind in [PolicyKind::Advantage, PolicyKind::Strategy] {
        let mut agent = MlpAgent::new([random_net(1), random_net(2)], kind, "net");
        let mut rival = RandomAgent;
        let mut rng = SmallRng::seed_from_u64(9);
        for seed in 0..8 {
            play_duplicate(&mut agent, &mut rival, seed, &mut rng);
        }
    }
}

#[test]
fn probabilities_are_a_distribution_over_the_legal_actions() {
    let mut rng = SmallRng::seed_from_u64(3);
    let agent = MlpAgent::shared(random_net(4), PolicyKind::Strategy, "net");
    let state = TrucoState::new_hand(deal(&mut rng), 0, [0, 0]);
    let obs = state.observation(0);
    assert_ne!(obs.legal, 0);
    let p = agent.probabilities(&obs);
    assert!((p.iter().sum::<f32>() - 1.0).abs() < 1e-5);
    for (a, &x) in p.iter().enumerate() {
        if obs.legal & bit(a) == 0 {
            assert_eq!(x, 0.0);
        }
    }
}

#[test]
fn net_exploitability_matches_the_closure_version_on_kuhn() {
    // Una red con pesos 0 y sesgos iguales da logits iguales: política uniforme.
    let net = Mlp::new(
        vec![Layer {
            inp: 9,
            out: 2,
            w: vec![0.0; 18],
            b: vec![0.0; 2],
        }],
        vec![1.0; 9],
    );
    let via_net = net_exploitability::<Kuhn>([&net, &net], PolicyKind::Strategy);
    let uniform = |_: &Kuhn, _: Player| vec![0.5, 0.5];
    let direct = exploitability::<Kuhn>(&uniform);
    assert!(via_net > 0.1);
    assert!((via_net - direct).abs() < 1e-6, "{via_net} vs {direct}");
}
