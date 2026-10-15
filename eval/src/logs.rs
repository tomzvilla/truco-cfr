//! Registros de partidos en JSON (una línea por partido): los usan las manos destacadas y la web.
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::Path;
use truco_engine::cards::Card;
use truco_engine::game::Action;
use truco_engine::match_runner::{HandRecord, MatchResult};
use truco_engine::truco::ACTION_NAMES;

/// Una mano: cartas como "1E", acciones como (asiento, nombre de ACTION_NAMES).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HandLog {
    pub mano: usize,
    pub start_scores: [u8; 2],
    pub hands: [[String; 3]; 2],
    pub actions: Vec<(usize, String)>,
    pub points: [u8; 2],
}

impl HandLog {
    pub fn from_record(r: &HandRecord) -> HandLog {
        HandLog {
            mano: r.mano,
            start_scores: r.start_scores,
            hands: r.hands.map(|h| h.map(|c| c.to_string())),
            actions: r
                .actions
                .iter()
                .map(|&(p, a)| (p, ACTION_NAMES[a].to_string()))
                .collect(),
            points: r.points,
        }
    }

    pub fn cards(&self, seat: usize) -> [Card; 3] {
        self.hands[seat].clone().map(|s| {
            Card::parse(&s).unwrap_or_else(|| panic!("carta inválida en el registro: {s}"))
        })
    }

    pub fn action_ids(&self) -> Vec<(usize, Action)> {
        self.actions
            .iter()
            .map(|(p, name)| {
                let a = ACTION_NAMES
                    .iter()
                    .position(|n| n == name)
                    .unwrap_or_else(|| panic!("acción desconocida en el registro: {name}"));
                (*p, a)
            })
            .collect()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchLog {
    /// Índice del par duplicado (los dos partidos del par lo comparten).
    pub pair: u64,
    pub bot_seat: usize,
    pub winner: usize,
    pub final_scores: [u8; 2],
    pub hands: Vec<HandLog>,
}

impl MatchLog {
    pub fn from_result(pair: u64, bot_seat: usize, m: &MatchResult) -> MatchLog {
        MatchLog {
            pair,
            bot_seat,
            winner: m.winner,
            final_scores: m.final_scores,
            hands: m.hands.iter().map(HandLog::from_record).collect(),
        }
    }
}

pub fn write_logs(path: &Path, logs: &[MatchLog]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("no pude crear {}: {e}", dir.display()))?;
    }
    let f = std::fs::File::create(path)
        .map_err(|e| format!("no pude escribir {}: {e}", path.display()))?;
    let mut w = BufWriter::new(f);
    for m in logs {
        serde_json::to_writer(&mut w, m).map_err(|e| e.to_string())?;
        w.write_all(b"\n").map_err(|e| e.to_string())?;
    }
    w.flush().map_err(|e| e.to_string())
}

pub fn read_logs(path: &Path) -> Result<Vec<MatchLog>, String> {
    let f =
        std::fs::File::open(path).map_err(|e| format!("no pude leer {}: {e}", path.display()))?;
    BufReader::new(f)
        .lines()
        .enumerate()
        .map(|(i, line)| {
            let line = line.map_err(|e| e.to_string())?;
            serde_json::from_str(&line)
                .map_err(|e| format!("{} línea {}: {e}", path.display(), i + 1))
        })
        .collect()
}
