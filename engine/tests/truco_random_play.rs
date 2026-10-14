use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use truco_engine::game::{actions_of, other, Game, Node};
use truco_engine::truco::{TrucoGame, ENCODING_SIZE, TARGET};

#[test]
fn random_play_invariants() {
    let mut rng = SmallRng::seed_from_u64(7);
    let mut buf = [0u8; ENCODING_SIZE];
    for _ in 0..20_000 {
        let mut g = TrucoGame::root().sample_chance(&mut rng);
        let start = [g.state().score(0), g.state().score(1)];
        let mut steps = 0;
        while let Node::Decision(p) = g.node() {
            let legal = g.legal_actions();
            assert_ne!(legal, 0, "nodo de decisión sin acciones legales");
            g.encode(p, &mut buf);
            g.encode(other(p), &mut buf);
            let acts: Vec<_> = actions_of(legal).collect();
            g.apply(acts[rng.gen_range(0..acts.len())]);
            steps += 1;
            assert!(steps < 60, "la mano no termina");
        }
        assert_eq!(g.node(), Node::Terminal);
        let s = g.state();
        let r = g.returns();
        assert_eq!(r[0], -r[1]);
        for (p, &st) in start.iter().enumerate() {
            assert!(s.score(p) <= TARGET);
            assert!(s.score(p) >= st);
        }
        assert!(s.points().iter().any(|&x| x > 0), "toda mano reparte al menos un punto");
    }
}

#[test]
fn root_is_chance_and_deal_is_valid() {
    let mut rng = SmallRng::seed_from_u64(1);
    assert_eq!(TrucoGame::root().node(), Node::Chance);
    for _ in 0..1000 {
        let g = TrucoGame::root().sample_chance(&mut rng);
        let s = g.state();
        let mut ids: Vec<u8> = s.hand(0).iter().chain(s.hand(1).iter()).map(|c| c.id()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 6, "seis cartas distintas");
        assert!(s.score(0) < TARGET && s.score(1) < TARGET);
    }
}

#[test]
fn legal_actions_empty_outside_decision_nodes() {
    let mut rng = SmallRng::seed_from_u64(5);
    assert_eq!(TrucoGame::root().legal_actions(), 0, "nodo de azar (no debe entrar en pánico)");
    let mut g = TrucoGame::root().sample_chance(&mut rng);
    assert_ne!(g.legal_actions(), 0, "nodo de decisión");
    while g.node() != Node::Terminal {
        let acts: Vec<_> = actions_of(g.legal_actions()).collect();
        g.apply(acts[0]);
    }
    assert_eq!(g.legal_actions(), 0, "nodo terminal");
}
