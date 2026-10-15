use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use truco_engine::mlp::Mlp;
use truco_engine::truco::{feature_scale, ENCODING_SIZE};
use truco_eval::logs::{read_logs, write_logs, HandLog};
use truco_eval::tournament::{run_rival, RivalOptions, TournamentConfig};

fn tiny_net() -> Arc<Mlp> {
    let mut rng = SmallRng::seed_from_u64(3);
    Arc::new(Mlp::random(
        &[ENCODING_SIZE, 16, 12],
        feature_scale(),
        &mut rng,
    ))
}

/// Un archivo de registro nuevo (borra uno anterior con el mismo nombre).
fn fresh(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("truco-eval-{}-{name}.jsonl", std::process::id()));
    let _ = std::fs::remove_file(&p);
    p
}

fn cfg(pairs: u64, seed: u64, threads: usize) -> TournamentConfig {
    TournamentConfig {
        pairs,
        seed,
        threads,
    }
}

#[test]
fn every_pair_is_played_once_whatever_the_threads() {
    let net = tiny_net();
    for (pairs, threads) in [(5, 8), (7, 3), (1, 1), (6, 2)] {
        let p = fresh(&format!("once-{pairs}-{threads}"));
        let (rep, logs) = run_rival(
            net.clone(),
            "tiny",
            "random",
            &RivalOptions::default(),
            &cfg(pairs, 11, threads),
            &p,
        )
        .unwrap();
        assert_eq!(rep.games, 2 * pairs);
        let mut seen: Vec<u64> = logs.iter().map(|m| m.pair).collect();
        seen.sort();
        let expected: Vec<u64> = (0..pairs).flat_map(|i| [i, i]).collect();
        assert_eq!(seen, expected, "pairs={pairs} threads={threads}");
        assert_eq!(read_logs(&p).unwrap().len() as u64, 2 * pairs);
    }
}

#[test]
fn results_do_not_depend_on_threads() {
    let net = tiny_net();
    let o = RivalOptions::default();
    let a = run_rival(
        net.clone(),
        "tiny",
        "heuristic",
        &o,
        &cfg(6, 5, 1),
        &fresh("t1"),
    )
    .unwrap();
    let b = run_rival(net, "tiny", "heuristic", &o, &cfg(6, 5, 4), &fresh("t4")).unwrap();
    assert_eq!(a.1, b.1);
    assert_eq!((a.0.wins, a.0.hands), (b.0.wins, b.0.hands));
    assert_eq!(a.0.points_per_hand, b.0.points_per_hand);
}

#[test]
fn report_is_consistent() {
    let (rep, logs) = run_rival(
        tiny_net(),
        "tiny",
        "random",
        &RivalOptions::default(),
        &cfg(10, 2, 3),
        &fresh("rep"),
    )
    .unwrap();
    assert_eq!(rep.rival, "random");
    assert_eq!(logs.len(), 20);
    let bot_wins = logs.iter().filter(|m| m.winner == m.bot_seat).count() as u64;
    assert_eq!(rep.wins, bot_wins);
    assert!((rep.win_rate - rep.wins as f64 / 20.0).abs() < 1e-12);
    assert!(rep.wilson95[0] <= rep.win_rate && rep.win_rate <= rep.wilson95[1]);
    let hands: u64 = logs.iter().map(|m| m.hands.len() as u64).sum();
    assert_eq!(rep.hands, hands);
    assert!(rep.points_per_hand_ci95[0] <= rep.points_per_hand);
    assert!(rep.points_per_hand <= rep.points_per_hand_ci95[1]);
    assert_eq!(
        (rep.fallbacks, rep.resumed_pairs, rep.rival_decisions),
        (0, 0, 0)
    );
    for m in &logs {
        assert_eq!(m.final_scores[m.winner], 30);
        let total: u32 = m
            .hands
            .iter()
            .map(|h| (h.points[0] + h.points[1]) as u32)
            .sum();
        assert_eq!(total, (m.final_scores[0] + m.final_scores[1]) as u32);
    }
}

#[test]
fn an_interrupted_run_resumes_without_replaying() {
    let net = tiny_net();
    let o = RivalOptions::default();
    let p = fresh("resume");
    let (_, first) = run_rival(net.clone(), "tiny", "heuristic", &o, &cfg(3, 8, 2), &p).unwrap();
    // Simula un corte en el medio de una escritura.
    OpenOptions::new()
        .append(true)
        .open(&p)
        .unwrap()
        .write_all(b"{\"pair\":7,\"botS")
        .unwrap();
    let (rep, all) = run_rival(net.clone(), "tiny", "heuristic", &o, &cfg(5, 8, 2), &p).unwrap();
    assert_eq!(rep.resumed_pairs, 3);
    assert_eq!(rep.games, 10);
    assert_eq!(&all[..6], &first[..]);
    assert_eq!(
        read_logs(&p).unwrap().len(),
        10,
        "el archivo queda limpio y completo"
    );
    // Igual que una corrida sin cortes.
    let (whole, whole_logs) =
        run_rival(net, "tiny", "heuristic", &o, &cfg(5, 8, 3), &fresh("whole")).unwrap();
    assert_eq!(all, whole_logs);
    assert_eq!(
        (rep.wins, rep.points_per_hand),
        (whole.wins, whole.points_per_hand)
    );
}

#[test]
fn unknown_rival_is_an_error() {
    let err = run_rival(
        tiny_net(),
        "tiny",
        "nadie",
        &RivalOptions::default(),
        &cfg(1, 1, 1),
        &fresh("x"),
    )
    .unwrap_err();
    assert!(err.contains("rival desconocido"), "{err}");
}

#[test]
fn logs_round_trip_through_jsonl() {
    let (_, logs) = run_rival(
        tiny_net(),
        "tiny",
        "heuristic",
        &RivalOptions::default(),
        &cfg(2, 4, 2),
        &fresh("rt"),
    )
    .unwrap();
    let p = fresh("rt-copy");
    write_logs(&p, &logs).unwrap();
    let back = read_logs(&p).unwrap();
    assert_eq!(back, logs);
    let h: &HandLog = &back[0].hands[0];
    assert_eq!(h.cards(0).map(|c| c.to_string()), h.hands[0].clone());
    assert_eq!(h.action_ids().len(), h.actions.len());
}

#[test]
fn the_clean_rewrite_leaves_no_temporary_file_and_keeps_completed_pairs() {
    let net = tiny_net();
    let o = RivalOptions::default();
    let p = fresh("atomic");
    run_rival(net.clone(), "tiny", "heuristic", &o, &cfg(3, 8, 2), &p).unwrap();
    // El orden de las líneas depende de qué hilo termina antes; se compara como conjunto.
    let sorted_lines = |p: &std::path::Path| {
        let mut v: Vec<String> = std::fs::read_to_string(p)
            .unwrap()
            .lines()
            .map(String::from)
            .collect();
        v.sort();
        v
    };
    let before = sorted_lines(&p);
    // Reanudar con los mismos pares: no hay nada para jugar y el contenido queda igual.
    let (rep, _) = run_rival(net, "tiny", "heuristic", &o, &cfg(3, 8, 2), &p).unwrap();
    assert_eq!(rep.resumed_pairs, 3);
    assert_eq!(sorted_lines(&p), before);
    let mut tmp = p.as_os_str().to_owned();
    tmp.push(".tmp");
    assert!(!PathBuf::from(tmp).exists(), "quedó el archivo temporal");
}
