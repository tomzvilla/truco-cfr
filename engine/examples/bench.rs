//! cargo run --release -p truco-engine --example bench
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use std::time::Instant;
use truco_engine::game::{actions_of, Game, Node};
use truco_engine::mlp::Mlp;
use truco_engine::truco::{feature_scale, TrucoGame, ENCODING_SIZE, NUM_ACTIONS};

fn main() {
    let mut rng = SmallRng::seed_from_u64(1);

    let hands = 500_000;
    let mut nodes = 0u64;
    let t = Instant::now();
    for _ in 0..hands {
        let mut g = TrucoGame::root().sample_chance(&mut rng);
        while let Node::Decision(_) = g.node() {
            let acts: Vec<_> = actions_of(g.legal_actions()).collect();
            g.apply(acts[rng.gen_range(0..acts.len())]);
            nodes += 1;
        }
    }
    let secs = t.elapsed().as_secs_f64();
    println!(
        "motor (1 hilo): {:.0} manos/s, {:.0} decisiones/s, {:.1} decisiones por mano",
        hands as f64 / secs,
        nodes as f64 / secs,
        nodes as f64 / hands as f64
    );

    let mut x = [0u8; ENCODING_SIZE];
    TrucoGame::root().sample_chance(&mut rng).encode(0, &mut x);
    for width in [128usize, 256] {
        let mlp = Mlp::random(
            &[ENCODING_SIZE, width, width, width, NUM_ACTIONS],
            feature_scale(),
            &mut rng,
        );
        let mut out = [0f32; NUM_ACTIONS];
        let n = 50_000;
        let t = Instant::now();
        for _ in 0..n {
            mlp.forward(&x, &mut out);
        }
        let us = t.elapsed().as_secs_f64() * 1e6 / n as f64;
        println!(
            "MLP 3×{width}: {us:.1} µs por forward (1 hilo), checksum {:.3}",
            out[0]
        );
    }
}
