//! truco-eval: evaluación del bot.
//!
//!     cargo run --release -p truco-eval -- tournament --rivals random,heuristic
//!     cargo run --release -p truco-eval -- bluff
//!     cargo run --release -p truco-eval -- highlights
use std::path::Path;
use std::process::ExitCode;
use std::sync::Arc;
use truco_eval::args::Args;
use truco_eval::bluff::{analyze, BluffReport};
use truco_eval::model::load_model;
use truco_eval::strength::StrengthTable;
use truco_eval::tournament::{run_rival, RivalOptions, TournamentConfig};

const USAGE: &str = "uso: truco-eval <tournament|bluff|highlights> [--clave valor ...]";

/// Escribe `value` como JSON con sangría en `dir/name`.
fn write_json<T: serde::Serialize>(dir: &Path, name: &str, value: &T) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("no pude crear {}: {e}", dir.display()))?;
    let path = dir.join(name);
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(&path, text + "\n")
        .map_err(|e| format!("no pude escribir {}: {e}", path.display()))?;
    println!("escrito {}", path.display());
    Ok(())
}

fn tournament(args: &Args) -> Result<(), String> {
    let model_path = args.path("model", "models/strategy.tcfrw");
    let net = load_model(&model_path)?;
    let label = model_path.display().to_string();
    let cfg = TournamentConfig {
        pairs: args.get("pairs", Some(1000))?,
        seed: args.get("seed", Some(2026))?,
        threads: args.get("threads", Some(8))?,
    };
    let opts = RivalOptions {
        claude: args.path("claude", "claude"),
        rival_model: args.get("rival-model", Some("haiku".to_string()))?,
        timeout_s: args.get("timeout", Some(120))?,
    };
    let resume: bool = args.get("resume", Some(false))?;
    let rivals: String = args.get("rivals", Some("random,heuristic".to_string()))?;
    let out = args.path("out", "eval/results");
    let logs_dir = args.path("logs", "eval/logs");
    for rival in rivals.split(',').map(str::trim).filter(|r| !r.is_empty()) {
        let logs_path = logs_dir.join(format!("{rival}.jsonl"));
        if !resume {
            let _ = std::fs::remove_file(&logs_path);
        }
        let t0 = std::time::Instant::now();
        let (rep, _) = run_rival(Arc::clone(&net), &label, rival, &opts, &cfg, &logs_path)?;
        println!(
            "{rival}: {}/{} = {:.1} % [{:.1}; {:.1}] · {:+.3} puntos por mano [{:+.3}; {:+.3}] · retomados {} · fallbacks {}/{} · US$ {:.2} de lista · {:.0} s",
            rep.wins, rep.games, 100.0 * rep.win_rate, 100.0 * rep.wilson95[0], 100.0 * rep.wilson95[1],
            rep.points_per_hand, rep.points_per_hand_ci95[0], rep.points_per_hand_ci95[1],
            rep.resumed_pairs, rep.fallbacks, rep.rival_decisions, rep.rival_cost_usd, t0.elapsed().as_secs_f64()
        );
        write_json(&out, &format!("tournament-{rival}.json"), &rep)?;
    }
    Ok(())
}

fn bluff(args: &Args) -> Result<(), String> {
    let model_path = args.path("model", "models/strategy.tcfrw");
    let net = load_model(&model_path)?;
    let hands: u64 = args.get("hands", Some(20_000))?;
    let seed: u64 = args.get("seed", Some(11))?;
    let samples: u32 = args.get("strength-samples", Some(300))?;
    let threads: usize = args.get("threads", Some(8))?;
    let t0 = std::time::Instant::now();
    let table = StrengthTable::build(samples, seed, threads);
    println!("tabla de fuerza: {:.0} s", t0.elapsed().as_secs_f64());
    let (envido_curve, envido_low_bluff, contention, truco) =
        analyze(Some(net), &table, hands, seed);
    let (_, _, _, truco_heuristic) = analyze(None, &table, hands, seed);
    for r in &envido_low_bluff {
        println!(
            "envido con ≤7 ({}): cantó {}/{} = {:.1} %",
            r.role,
            r.called,
            r.n,
            100.0 * r.rate
        );
    }
    println!(
        "truco/retruco con mano floja: {}/{} = {:.1} % (heurístico {:.1} %)",
        truco.weak_calls,
        truco.calls,
        100.0 * truco.weak_share,
        100.0 * truco_heuristic.weak_share
    );
    let report = BluffReport {
        model: model_path.display().to_string(),
        hands,
        seed,
        strength_samples: samples,
        envido_curve,
        envido_low_bluff,
        contention,
        truco,
        truco_heuristic,
    };
    write_json(&args.path("out", "eval/results"), "bluff.json", &report)
}

fn run(argv: &[String]) -> Result<(), String> {
    let (cmd, rest) = argv.split_first().ok_or(USAGE)?;
    let args = Args::parse(rest)?;
    match cmd.as_str() {
        "tournament" => tournament(&args),
        "bluff" => bluff(&args),
        other => Err(format!("subcomando desconocido: {other}\n{USAGE}")),
    }
}

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    match run(&argv) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
