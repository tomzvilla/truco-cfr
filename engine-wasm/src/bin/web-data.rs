//! Convierte los resultados de la evaluación y del entrenamiento al formato de la web.
//!
//!   cargo run --release -p truco-engine-wasm --bin web-data -- [--results eval/results]
//!       [--model models/strategy.tcfrw] [--out web/src/data/real] [--generated-at 2026-10-15]
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::PolicyKind;
use truco_engine_wasm::replay::{replay, HighlightIn};

const TANTOS: [u32; 22] = [
    0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
];

fn read(path: &Path) -> Result<Value, String> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| format!("no pude leer {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

fn write(dir: &Path, name: &str, v: &Value) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, serde_json::to_string_pretty(v).unwrap() + "\n")
        .map_err(|e| e.to_string())?;
    println!("escrito {}", path.display());
    Ok(())
}

fn f(v: &Value, key: &str) -> Result<f64, String> {
    v[key].as_f64().ok_or(format!("falta el número {key}"))
}

fn tournament_row(
    results: &Path,
    rival: &str,
    name: &str,
    description: &str,
) -> Result<Value, String> {
    let t = read(&results.join(format!("tournament-{rival}.json")))?;
    let decisions = f(&t, "rivalDecisions")?;
    let fallback_pct = if rival == "haiku" {
        json!(100.0 * f(&t, "fallbacks")? / decisions)
    } else {
        Value::Null
    };
    Ok(json!({
        "rival": name,
        "description": description,
        "partidos": t["games"],
        "ganados": t["wins"],
        "winRate": t["winRate"],
        "ciLow": t["wilson95"][0],
        "ciHigh": t["wilson95"][1],
        "netPerHand": t["pointsPerHand"],
        "netCiLow": t["pointsPerHandCi95"][0],
        "netCiHigh": t["pointsPerHandCi95"][1],
        "fallbackPct": fallback_pct,
    }))
}

fn results_json(results: &Path, generated_at: &str) -> Result<Value, String> {
    let tournament = vec![
        tournament_row(
            results,
            "random",
            "Bot al azar",
            "Juega cualquier acción legal",
        )?,
        tournament_row(
            results,
            "heuristic",
            "Heurístico propio",
            "Reglas fijas: canta envido con 27 o más, truco con dos cartas altas",
        )?,
        tournament_row(
            results,
            "haiku",
            "Claude Haiku",
            "IA de lenguaje de Anthropic que juega leyendo la mesa en texto (100 partidos)",
        )?,
    ];
    let learning = read(&results.join("learning.json"))?;
    let learning: Vec<Value> = learning["points"].as_array().ok_or("learning.json sin points")?
        .iter()
        .map(|p| json!({ "iteration": p["iteration"], "vsRandom": p["vsRandom"], "vsHeuristic": p["vsHeuristic"] }))
        .collect();
    let mini = read(&results.join("minitruco.json"))?;
    let exploitability: Vec<Value> = mini["points"]
        .as_array()
        .ok_or("minitruco.json sin points")?
        .iter()
        .map(|p| json!({ "iteration": p["iteration"], "exploitability": p["exploitability"] }))
        .collect();
    Ok(json!({
        "isMock": false,
        "generatedAt": generated_at,
        "tournament": tournament,
        "learning": learning,
        "exploitability": exploitability,
        "exploitabilityFinal": mini["finalStrategyExploitability"],
    }))
}

fn envido_curve(results: &Path) -> Result<Value, String> {
    let bluff = read(&results.join("bluff.json"))?;
    let curve = bluff["envidoCurve"]
        .as_array()
        .ok_or("bluff.json sin envidoCurve")?;
    let p_any = |role: &str, tantos: u32| -> Result<f64, String> {
        curve
            .iter()
            .find(|c| c["role"] == role && c["tantos"].as_u64() == Some(tantos as u64))
            .and_then(|c| c["pAny"].as_f64())
            .ok_or(format!("bluff.json no tiene {role} con {tantos} tantos"))
    };
    let points: Result<Vec<Value>, String> = TANTOS
        .iter()
        .map(|&t| Ok(json!({ "tantos": t, "mano": p_any("mano", t)?, "pie": p_any("pie", t)? })))
        .collect();
    Ok(Value::Array(points?))
}

fn highlights(results: &Path, model: &Path) -> Result<Value, String> {
    let bytes =
        std::fs::read(model).map_err(|e| format!("no pude leer {}: {e}", model.display()))?;
    let agent = MlpAgent::shared(
        Arc::new(Mlp::from_bytes(&bytes)?),
        PolicyKind::Strategy,
        "bot",
    );
    let report = read(&results.join("highlights.json"))?;
    let mut out = Vec::new();
    for kind in ["truco", "envido"] {
        let list: Vec<HighlightIn> =
            serde_json::from_value(report[kind].clone()).map_err(|e| e.to_string())?;
        let mut counts = std::collections::HashMap::new();
        for h in &list {
            let n = counts.entry(h.rival.clone()).or_insert(0);
            *n += 1;
            let id = format!("{}-{kind}-{n}", h.rival);
            out.push(serde_json::to_value(replay(h, &agent, id)?).unwrap());
        }
    }
    // los títulos son los nombres de los botones de la página: no pueden repetirse
    let mut seen: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for h in out.iter_mut() {
        let title = h["title"].as_str().unwrap_or("").to_string();
        let n = seen.entry(title.clone()).or_insert(0);
        *n += 1;
        if *n > 1 {
            h["title"] = Value::String(format!("{title} ({n})"));
        }
    }
    // primero Haiku, que es lo más llamativo; después el heurístico
    out.sort_by_key(|h| !h["id"].as_str().unwrap_or("").starts_with("haiku"));
    Ok(Value::Array(out))
}

fn arg(args: &[String], key: &str, default: &str) -> String {
    args.windows(2)
        .find(|w| w[0] == format!("--{key}"))
        .map(|w| w[1].clone())
        .unwrap_or_else(|| default.to_string())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let results = PathBuf::from(arg(&args, "results", "eval/results"));
    let model = PathBuf::from(arg(&args, "model", "models/strategy.tcfrw"));
    let out = PathBuf::from(arg(&args, "out", "web/src/data/real"));
    let generated_at = arg(&args, "generated-at", "2026-10-15");
    write(
        &out,
        "results.json",
        &results_json(&results, &generated_at)?,
    )?;
    write(&out, "envidoCurve.json", &envido_curve(&results)?)?;
    write(&out, "highlights.json", &highlights(&results, &model)?)?;
    Ok(())
}

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::ExitCode::FAILURE
        }
    }
}
