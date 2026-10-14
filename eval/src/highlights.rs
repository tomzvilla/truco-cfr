//! Manos destacadas: faroles exitosos del bot en los registros del torneo.
use crate::logs::{HandLog, MatchLog};
use crate::strength::{StrengthTable, WEAK};
use serde::Serialize;
use truco_engine::envido::envido_points;
use truco_engine::truco::*;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub rival: String,
    /// "truco" o "envido".
    pub kind: String,
    /// El canto del bot (nombre de ACTION_NAMES).
    pub call: String,
    /// Posición del canto en `hand.actions`.
    pub call_index: usize,
    pub bot_seat: usize,
    /// Truco: percentil de fuerza de la mano (0 = la peor). Envido: los tantos.
    pub strength: f64,
    /// La respuesta del rival: "noQuiero" o "mazo".
    pub response: String,
    /// Puntos que sumó el bot en toda la mano (envido, truco y lo que vino después), no solo
    /// los del farol: una mano con un farol de envido exitoso puede terminar perdida.
    pub points_won: u8,
    pub hand: HandLog,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HighlightsReport {
    pub sources: Vec<String>,
    pub truco_found: u64,
    pub envido_found: u64,
    pub truco: Vec<Highlight>,
    pub envido: Vec<Highlight>,
}

/// Faroles del bot a los que el rival contestó "no quiero" o "me voy al mazo" (como próxima jugada).
pub fn find(rival: &str, logs: &[MatchLog], table: &StrengthTable) -> Vec<Highlight> {
    let mut out = Vec::new();
    for m in logs {
        let bot = m.bot_seat;
        for h in &m.hands {
            let acts = h.action_ids();
            let cards = h.cards(bot);
            let is_mano = h.mano == bot;
            for (i, &(p, a)) in acts.iter().enumerate() {
                if p != bot {
                    continue;
                }
                let Some(&(q, resp)) = acts.get(i + 1) else {
                    continue;
                };
                if q == bot || !(resp == NO_QUIERO || resp == MAZO) {
                    continue;
                }
                let (kind, strength) = match a {
                    TRUCO | RETRUCO | VALE_CUATRO => ("truco", table.percentile(cards, is_mano)),
                    ENVIDO | REAL_ENVIDO | FALTA_ENVIDO => ("envido", envido_points(&cards) as f64),
                    _ => continue,
                };
                let weak = if kind == "truco" {
                    strength < WEAK
                } else {
                    strength <= 7.0
                };
                if !weak {
                    continue;
                }
                out.push(Highlight {
                    rival: rival.to_string(),
                    kind: kind.to_string(),
                    call: ACTION_NAMES[a].to_string(),
                    call_index: i,
                    bot_seat: bot,
                    strength,
                    response: ACTION_NAMES[resp].to_string(),
                    points_won: h.points[bot],
                    hand: h.clone(),
                });
            }
        }
    }
    out
}

/// Las más flojas primero (y, a igual fuerza, las que dieron más puntos).
pub fn select(
    found: Vec<Highlight>,
    top_truco: usize,
    top_envido: usize,
) -> (Vec<Highlight>, Vec<Highlight>) {
    let pick = |kind: &str, top: usize| {
        let mut v: Vec<Highlight> = found.iter().filter(|h| h.kind == kind).cloned().collect();
        v.sort_by(|a, b| {
            a.strength
                .partial_cmp(&b.strength)
                .expect("fuerza no numérica")
                .then(b.points_won.cmp(&a.points_won))
        });
        v.truncate(top);
        v
    };
    (pick("truco", top_truco), pick("envido", top_envido))
}
