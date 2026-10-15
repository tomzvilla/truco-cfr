//! Faroleo: curva del envido, contención y truco con manos flojas, consultando la red en las
//! situaciones de 20 000 manos del bot contra sí mismo.
use crate::stats::wilson;
use crate::strength::{StrengthTable, WEAK};
use rand::rngs::SmallRng;
use rand::SeedableRng;
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Arc;
use truco_engine::agents::{Agent, HeuristicAgent};
use truco_engine::game::bit;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::policy::{sample_action, PolicyKind, Probs};
use truco_engine::truco::*;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EnvidoPoint {
    pub role: String,
    pub tantos: u8,
    /// Primeras oportunidades de envido con estos tantos.
    pub n: u64,
    /// Veces que efectivamente cantó (envido, real o falta).
    pub called: u64,
    /// Probabilidad promedio que dio la política a cada canto.
    pub p_any: f64,
    pub p_envido: f64,
    pub p_real: f64,
    pub p_falta: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RoleRate {
    /// "mano", "pie" o "todos".
    pub role: String,
    pub n: u64,
    pub called: u64,
    /// Para `envidoLowBluff`: fracción de veces que cantó. Para `contention`: que NO cantó.
    pub rate: f64,
    /// Probabilidad promedio de cantar que dio la política.
    pub p_any: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TrucoBluff {
    /// Cantos de truco y retruco.
    pub calls: u64,
    /// De esos, con una mano en el 30 % más flojo.
    pub weak_calls: u64,
    pub weak_share: f64,
    pub weak_share_wilson95: [f64; 2],
    /// Faroles a los que el rival contestó "no quiero".
    pub weak_calls_folded: u64,
    pub fold_rate: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BluffReport {
    pub model: String,
    pub hands: u64,
    pub seed: u64,
    pub strength_samples: u32,
    pub envido_curve: Vec<EnvidoPoint>,
    /// Canta envido con 7 tantos o menos (criterio de éxito 5).
    pub envido_low_bluff: Vec<RoleRate>,
    /// Se calla con 31 o más.
    pub contention: Vec<RoleRate>,
    pub truco: TrucoBluff,
    /// Lo mismo para el heurístico, que no farolea: sirve de referencia.
    pub truco_heuristic: TrucoBluff,
}

#[derive(Default, Clone, Copy)]
struct Acc {
    n: u64,
    called: u64,
    p: [f64; 3],
}

const ROLES: [&str; 2] = ["pie", "mano"];

fn role_rate(role: &str, accs: &[Acc], invert: bool) -> RoleRate {
    let n: u64 = accs.iter().map(|a| a.n).sum();
    let called: u64 = accs.iter().map(|a| a.called).sum();
    let p: f64 = accs.iter().map(|a| a.p.iter().sum::<f64>()).sum();
    let div = |x: f64| if n == 0 { 0.0 } else { x / n as f64 };
    let rate = div(called as f64);
    RoleRate {
        role: role.to_string(),
        n,
        called,
        rate: if invert && n > 0 { 1.0 - rate } else { rate },
        p_any: div(p),
    }
}

/// Juega `hands` manos de `net` contra sí mismo (o del heurístico, con `None`) y mide el faroleo.
pub fn analyze(
    net: Option<Arc<Mlp>>,
    table: &StrengthTable,
    hands: u64,
    seed: u64,
) -> (Vec<EnvidoPoint>, Vec<RoleRate>, Vec<RoleRate>, TrucoBluff) {
    let mut rng = SmallRng::seed_from_u64(seed);
    let bot = net.map(|n| MlpAgent::shared(n, PolicyKind::Strategy, "bot"));
    let mut heuristic = HeuristicAgent;
    // (rol, tantos) → acumulado
    let mut env: BTreeMap<(usize, u8), Acc> = BTreeMap::new();
    let (mut calls, mut weak_calls, mut folded) = (0u64, 0u64, 0u64);
    for k in 0..hands {
        let scores = sample_scores(&mut rng);
        let mut s = TrucoState::new_hand(deal(&mut rng), (k % 2) as usize, scores);
        let mut had_envido_chance = [false; 2];
        let mut pending_weak_call = false;
        while !s.is_over() {
            let p = s.turn();
            let obs = s.observation(p);
            let probs: Probs = match &bot {
                Some(b) => b.probabilities(&obs),
                None => {
                    let mut one = [0.0; 12];
                    one[heuristic.act(&obs, &mut rng)] = 1.0;
                    one
                }
            };
            let a = sample_action(&probs, obs.legal, &mut rng);
            if pending_weak_call {
                if a == NO_QUIERO {
                    folded += 1;
                }
                pending_weak_call = false;
            }
            let first_envido = obs.legal & bit(ENVIDO) != 0
                && obs.envido_calls.iter().all(|c| c.is_none())
                && !had_envido_chance[p];
            if first_envido {
                had_envido_chance[p] = true;
                let e = env
                    .entry((obs.is_mano as usize, obs.my_tantos))
                    .or_default();
                e.n += 1;
                e.called += matches!(a, ENVIDO | REAL_ENVIDO | FALTA_ENVIDO) as u64;
                e.p[0] += probs[ENVIDO] as f64;
                e.p[1] += probs[REAL_ENVIDO] as f64;
                e.p[2] += probs[FALTA_ENVIDO] as f64;
            }
            if a == TRUCO || a == RETRUCO {
                calls += 1;
                if table.percentile(obs.hand, obs.is_mano) < WEAK {
                    weak_calls += 1;
                    pending_weak_call = true;
                }
            }
            s.apply(a);
        }
    }
    let curve: Vec<EnvidoPoint> = env
        .iter()
        .map(|(&(role, tantos), a)| EnvidoPoint {
            role: ROLES[role].to_string(),
            tantos,
            n: a.n,
            called: a.called,
            p_any: (a.p[0] + a.p[1] + a.p[2]) / a.n as f64,
            p_envido: a.p[0] / a.n as f64,
            p_real: a.p[1] / a.n as f64,
            p_falta: a.p[2] / a.n as f64,
        })
        .collect();
    let rates = |pred: &dyn Fn(u8) -> bool, invert: bool| -> Vec<RoleRate> {
        let pick = |role: Option<usize>| -> Vec<Acc> {
            env.iter()
                .filter(|(&(r, t), _)| pred(t) && role.is_none_or(|x| x == r))
                .map(|(_, a)| *a)
                .collect()
        };
        vec![
            role_rate("mano", &pick(Some(1)), invert),
            role_rate("pie", &pick(Some(0)), invert),
            role_rate("todos", &pick(None), invert),
        ]
    };
    let low = rates(&|t| t <= 7, false);
    let contention = rates(&|t| t >= 31, true);
    let (lo, hi) = wilson(weak_calls, calls);
    let share = |x: u64, n: u64| if n == 0 { 0.0 } else { x as f64 / n as f64 };
    let truco = TrucoBluff {
        calls,
        weak_calls,
        weak_share: share(weak_calls, calls),
        weak_share_wilson95: [lo, hi],
        weak_calls_folded: folded,
        fold_rate: share(folded, weak_calls),
    };
    (curve, low, contention, truco)
}
