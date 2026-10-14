use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};
use truco_engine::agents::Agent;
use truco_engine::game::actions_of;
use truco_engine::truco::{deal, Observation, TrucoState};
use truco_eval::haiku::{
    ask_claude, fallback, should_abort, HaikuAgent, HaikuOptions, MAX_CONSECUTIVE_FALLBACKS,
};
use truco_eval::tournament::Counters;

/// Un `claude` falso: un script de sh que ignora sus argumentos.
fn fake(name: &str, body: &str) -> HaikuOptions {
    let p = std::env::temp_dir().join(format!("truco-eval-{}-{name}.sh", std::process::id()));
    std::fs::write(&p, format!("#!/bin/sh\ncat > /dev/null\n{body}\n")).unwrap();
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
    HaikuOptions {
        claude: p,
        model: "haiku".into(),
        timeout: Duration::from_secs(2),
    }
}

fn root_obs() -> Observation {
    let mut rng = SmallRng::seed_from_u64(1);
    TrucoState::new_hand(deal(&mut rng), 0, [0, 0]).observation(0)
}

const OK_1: &str = r#"echo '{"type":"result","is_error":false,"result":"1","total_cost_usd":0.0004,"modelUsage":{"claude-haiku-test":{}}}'"#;

#[test]
fn a_valid_answer_is_played_and_costed() {
    let counters = Arc::new(Counters::default());
    let mut agent = HaikuAgent::new(fake("ok", OK_1), counters.clone());
    let obs = root_obs();
    let a = agent.act(&obs, &mut SmallRng::seed_from_u64(2));
    assert_eq!(a, actions_of(obs.legal).nth(1).unwrap());
    assert_eq!(counters.decisions.load(Ordering::Relaxed), 1);
    assert_eq!(counters.fallbacks.load(Ordering::Relaxed), 0);
    assert_eq!(counters.cost_micro_usd.load(Ordering::Relaxed), 400);
    assert_eq!(*counters.model.lock().unwrap(), "claude-haiku-test");
}

#[test]
fn nonsense_errors_and_crashes_fall_back_after_two_tries() {
    let bodies = [
        (
            "nonsense",
            r#"echo '{"is_error":false,"result":"me voy a mazo","total_cost_usd":0.001}'"#,
        ),
        (
            "error",
            r#"echo '{"is_error":true,"result":"Usage limit reached"}'"#,
        ),
        ("crash", "exit 3"),
        ("garbage", "echo hola"),
    ];
    for (name, body) in bodies {
        let counters = Arc::new(Counters::default());
        let mut agent = HaikuAgent::new(fake(name, body), counters.clone());
        let obs = root_obs();
        let a = agent.act(&obs, &mut SmallRng::seed_from_u64(2));
        assert_eq!(a, fallback(obs.legal), "{name}");
        assert_eq!(counters.fallbacks.load(Ordering::Relaxed), 1, "{name}");
    }
}

#[test]
fn a_hung_claude_is_killed_at_the_timeout() {
    let opts = fake("hang", "sleep 30");
    let t0 = Instant::now();
    let err = ask_claude(&opts, "hola").err().unwrap();
    assert!(err.contains("no contestó"), "{err}");
    assert!(t0.elapsed() < Duration::from_secs(10));
}

#[test]
fn a_missing_claude_is_a_clear_error() {
    let opts = HaikuOptions {
        claude: PathBuf::from("/no/existe/claude"),
        model: "haiku".into(),
        timeout: Duration::from_secs(1),
    };
    let err = ask_claude(&opts, "hola").err().unwrap();
    assert!(err.contains("no pude lanzar"), "{err}");
}

#[test]
fn a_claude_that_exits_without_reading_is_an_error_not_a_hang() {
    let p = std::env::temp_dir().join(format!("truco-eval-{}-epipe.sh", std::process::id()));
    std::fs::write(&p, "#!/bin/sh\nexit 0\n").unwrap();
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
    let opts = HaikuOptions {
        claude: p,
        model: "haiku".into(),
        timeout: Duration::from_secs(2),
    };
    // Más grande que el buffer del pipe: la escritura choca con el cierre (EPIPE).
    let big = "x".repeat(4 << 20);
    let t0 = Instant::now();
    let err = ask_claude(&opts, &big).err().unwrap();
    assert!(err.contains("claude no recibe"), "{err}");
    assert!(t0.elapsed() < Duration::from_secs(5));
}

#[test]
fn the_abort_rule_triggers_at_the_limit() {
    assert!(!should_abort(MAX_CONSECUTIVE_FALLBACKS - 1));
    assert!(should_abort(MAX_CONSECUTIVE_FALLBACKS));
    assert_eq!(MAX_CONSECUTIVE_FALLBACKS, 5);
}

#[test]
fn a_valid_answer_resets_the_fallback_streak() {
    let counters = Arc::new(Counters::default());
    let obs = root_obs();
    let mut bad = HaikuAgent::new(fake("streak-bad", "exit 3"), counters.clone());
    for _ in 0..MAX_CONSECUTIVE_FALLBACKS - 1 {
        bad.act(&obs, &mut SmallRng::seed_from_u64(2));
    }
    assert_eq!(
        counters.consecutive_fallbacks.load(Ordering::Relaxed),
        MAX_CONSECUTIVE_FALLBACKS - 1
    );
    let mut good = HaikuAgent::new(fake("streak-ok", OK_1), counters.clone());
    good.act(&obs, &mut SmallRng::seed_from_u64(2));
    assert_eq!(counters.consecutive_fallbacks.load(Ordering::Relaxed), 0);
    assert_eq!(
        counters.fallbacks.load(Ordering::Relaxed),
        MAX_CONSECUTIVE_FALLBACKS - 1
    );
}
