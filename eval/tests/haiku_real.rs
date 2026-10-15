//! Llama de verdad a Claude Code: `CLAUDE_BIN=/mnt/c/Users/tomzv/.local/bin/claude.exe
//! cargo test -p truco-eval --test haiku_real -- --ignored --nocapture`.
use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use truco_engine::agents::Agent;
use truco_engine::truco::{deal, TrucoState};
use truco_eval::haiku::{prompt, HaikuAgent, HaikuOptions};
use truco_eval::tournament::Counters;

#[test]
#[ignore]
fn haiku_answers_one_real_decision() {
    let claude = PathBuf::from(std::env::var("CLAUDE_BIN").expect("definir CLAUDE_BIN"));
    let counters = Arc::new(Counters::default());
    let opts = HaikuOptions {
        claude,
        model: "haiku".into(),
        timeout: Duration::from_secs(120),
    };
    let mut agent = HaikuAgent::new(opts, counters.clone());
    let mut rng = SmallRng::seed_from_u64(5);
    let obs = TrucoState::new_hand(deal(&mut rng), 0, [0, 0]).observation(0);
    println!("{}", prompt(&obs).0);
    let a = agent.act(&obs, &mut rng);
    assert!(obs.legal & (1 << a) != 0);
    assert_eq!(counters.fallbacks.load(Ordering::Relaxed), 0);
    println!(
        "eligió {a} · modelo {} · US$ {}",
        counters.model.lock().unwrap(),
        counters.cost_micro_usd.load(Ordering::Relaxed) as f64 / 1e6
    );
}
