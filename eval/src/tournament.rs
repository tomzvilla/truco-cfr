//! Torneo: pares de partidos duplicados contra un rival, repartidos entre hilos. El registro se
//! escribe par por par, así una corrida cortada se retoma sin rejugar nada.
use crate::logs::{write_logs, MatchLog};
use crate::stats::{bootstrap_mean, wilson};
use rand::rngs::SmallRng;
use rand::SeedableRng;
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs::OpenOptions;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use truco_engine::agents::{Agent, HeuristicAgent, RandomAgent};
use truco_engine::match_runner::play_duplicate;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::PolicyKind;

/// Lo que devuelve cada hilo: sus pares jugados (índice y los dos partidos).
type WorkerOut = Result<Vec<(u64, Vec<MatchLog>)>, String>;

/// Lo que cuenta un rival externo: decisiones, fallbacks, costo de lista y modelo usado.
#[derive(Default)]
pub struct Counters {
    pub decisions: AtomicU64,
    pub fallbacks: AtomicU64,
    /// Fallbacks seguidos sin una respuesta válida en el medio (compartido entre hilos).
    pub consecutive_fallbacks: AtomicU64,
    pub cost_micro_usd: AtomicU64,
    pub model: Mutex<String>,
}

pub struct RivalOptions {
    /// Ejecutable de Claude Code.
    pub claude: PathBuf,
    /// Modelo de Claude para el rival `haiku`.
    pub rival_model: String,
    /// Tiempo máximo por llamada, en segundos.
    pub timeout_s: u64,
}

impl Default for RivalOptions {
    fn default() -> RivalOptions {
        RivalOptions {
            claude: PathBuf::from("claude"),
            rival_model: "haiku".into(),
            timeout_s: 120,
        }
    }
}

/// Un rival por hilo; los externos comparten `counters`.
pub fn make_rival(
    id: &str,
    opts: &RivalOptions,
    counters: Arc<Counters>,
) -> Result<Box<dyn Agent>, String> {
    match id {
        "random" => Ok(Box::new(RandomAgent)),
        "heuristic" => Ok(Box::new(HeuristicAgent)),
        "haiku" => Ok(Box::new(crate::haiku::HaikuAgent::new(
            crate::haiku::HaikuOptions {
                claude: opts.claude.clone(),
                model: opts.rival_model.clone(),
                timeout: std::time::Duration::from_secs(opts.timeout_s),
            },
            counters,
        ))),
        other => Err(format!(
            "rival desconocido: {other} (random, heuristic o haiku)"
        )),
    }
}

pub struct TournamentConfig {
    pub pairs: u64,
    pub seed: u64,
    pub threads: usize,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RivalReport {
    pub rival: String,
    pub model: String,
    pub pairs: u64,
    pub games: u64,
    pub wins: u64,
    pub win_rate: f64,
    pub wilson95: [f64; 2],
    pub hands: u64,
    /// Puntos del bot menos puntos del rival, por mano.
    pub points_per_hand: f64,
    pub points_per_hand_ci95: [f64; 2],
    /// Pares que venían de una corrida anterior (los contadores de abajo no los incluyen).
    pub resumed_pairs: u64,
    pub rival_decisions: u64,
    pub fallbacks: u64,
    /// Costo a precio de lista de las llamadas a Claude (con la suscripción no se cobra).
    pub rival_cost_usd: f64,
    pub rival_model: String,
    pub seed: u64,
    pub threads: usize,
}

/// Pares completos que ya están en `path`. Una línea ilegible (cortada a la mitad) o un par al que
/// le falta uno de sus dos partidos se descartan.
fn load_done(path: &Path, pairs: u64) -> BTreeMap<u64, Vec<MatchLog>> {
    let mut done: BTreeMap<u64, Vec<MatchLog>> = BTreeMap::new();
    if let Ok(text) = std::fs::read_to_string(path) {
        for line in text.lines() {
            if let Ok(m) = serde_json::from_str::<MatchLog>(line) {
                if m.pair < pairs {
                    done.entry(m.pair).or_default().push(m);
                }
            }
        }
    }
    done.retain(|_, v| {
        v.sort_by_key(|m| m.bot_seat);
        v.len() == 2 && v[0].bot_seat == 0 && v[1].bot_seat == 1
    });
    done
}

/// Puntos netos del bot y cantidad de manos de un partido.
fn net_points(m: &MatchLog) -> (f64, u64) {
    let b = m.bot_seat;
    let net: i64 = m
        .hands
        .iter()
        .map(|h| h.points[b] as i64 - h.points[1 - b] as i64)
        .sum();
    (net as f64, m.hands.len() as u64)
}

fn append(sink: &Mutex<BufWriter<std::fs::File>>, logs: &[MatchLog]) -> Result<(), String> {
    let mut w = sink.lock().expect("registro envenenado");
    for m in logs {
        serde_json::to_writer(&mut *w, m).map_err(|e| e.to_string())?;
        w.write_all(b"\n").map_err(|e| e.to_string())?;
    }
    w.flush().map_err(|e| e.to_string())
}

pub fn run_rival(
    net: Arc<Mlp>,
    model_label: &str,
    rival: &str,
    opts: &RivalOptions,
    cfg: &TournamentConfig,
    logs_path: &Path,
) -> Result<(RivalReport, Vec<MatchLog>), String> {
    let mut all = load_done(logs_path, cfg.pairs);
    let resumed = all.len() as u64;
    // Se reescribe limpio (sin líneas cortadas ni pares incompletos) y se sigue agregando.
    // Atómico: se escribe a un archivo vecino y se renombra encima, así un corte en este punto no
    // pierde los pares ya completos (con `File::create` el registro quedaría vacío un instante).
    let mut tmp_name = logs_path.as_os_str().to_owned();
    tmp_name.push(".tmp");
    let tmp = PathBuf::from(tmp_name);
    write_logs(&tmp, &all.values().flatten().cloned().collect::<Vec<_>>())?;
    std::fs::rename(&tmp, logs_path)
        .map_err(|e| format!("no pude reemplazar {}: {e}", logs_path.display()))?;
    let file = OpenOptions::new()
        .append(true)
        .open(logs_path)
        .map_err(|e| format!("no pude abrir {}: {e}", logs_path.display()))?;
    let sink = Mutex::new(BufWriter::new(file));
    let todo: Vec<u64> = (0..cfg.pairs).filter(|i| !all.contains_key(i)).collect();
    let counters = Arc::new(Counters::default());
    let threads = cfg.threads.clamp(1, todo.len().max(1));
    let per_worker: Vec<WorkerOut> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..threads)
            .map(|w| {
                let net = net.clone();
                let counters = counters.clone();
                let (todo, sink) = (&todo, &sink);
                s.spawn(move || -> WorkerOut {
                    let mut rival_agent = make_rival(rival, opts, counters)?;
                    let mut out = Vec::new();
                    for &i in todo.iter().skip(w).step_by(threads) {
                        // Las mismas semillas que la evaluación del entrenamiento (engine-py).
                        let mut rng = SmallRng::seed_from_u64(
                            cfg.seed ^ i.wrapping_mul(0xD1B5_4A32_D192_ED03),
                        );
                        let deal_seed = cfg.seed.wrapping_mul(31).wrapping_add(i);
                        let mut bot = MlpAgent::shared(net.clone(), PolicyKind::Strategy, "bot");
                        let d = play_duplicate(&mut bot, &mut *rival_agent, deal_seed, &mut rng);
                        let logs = vec![
                            MatchLog::from_result(i, 0, &d.a_as_seat0),
                            MatchLog::from_result(i, 1, &d.a_as_seat1),
                        ];
                        append(sink, &logs)?;
                        out.push((i, logs));
                    }
                    Ok(out)
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|h| h.join().expect("un hilo del torneo entró en pánico"))
            .collect()
    });
    for r in per_worker {
        all.extend(r?);
    }

    let mut wins = 0u64;
    let mut clusters = Vec::with_capacity(all.len());
    for ms in all.values() {
        wins += ms.iter().filter(|m| m.winner == m.bot_seat).count() as u64;
        let (net, hands) = ms
            .iter()
            .map(net_points)
            .fold((0.0, 0), |a, b| (a.0 + b.0, a.1 + b.1));
        clusters.push((net, hands));
    }
    let logs: Vec<MatchLog> = all.into_values().flatten().collect();
    let games = logs.len() as u64;
    let (lo, hi) = wilson(wins, games);
    let (pph, plo, phi) = bootstrap_mean(&clusters, 2000, cfg.seed);
    let report = RivalReport {
        rival: rival.to_string(),
        model: model_label.to_string(),
        pairs: cfg.pairs,
        games,
        wins,
        win_rate: if games == 0 {
            0.0
        } else {
            wins as f64 / games as f64
        },
        wilson95: [lo, hi],
        hands: clusters.iter().map(|c| c.1).sum(),
        points_per_hand: pph,
        points_per_hand_ci95: [plo, phi],
        resumed_pairs: resumed,
        rival_decisions: counters.decisions.load(Ordering::Relaxed),
        fallbacks: counters.fallbacks.load(Ordering::Relaxed),
        rival_cost_usd: counters.cost_micro_usd.load(Ordering::Relaxed) as f64 / 1e6,
        rival_model: counters.model.lock().expect("modelo").clone(),
        seed: cfg.seed,
        threads,
    };
    Ok((report, logs))
}
