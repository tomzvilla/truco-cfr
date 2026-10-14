//! Claude Haiku como rival. Cada decisión es una llamada a Claude Code en modo no interactivo
//! (`claude -p`) con la suscripción del usuario: sin API key, sin herramientas, sin MCP y sin la
//! configuración del usuario, con un prompt de sistema propio. No guarda memoria entre llamadas:
//! cada pedido describe todo lo que ve el jugador.
use crate::tournament::Counters;
use rand::RngCore;
use serde_json::Value;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};
use truco_engine::agents::Agent;
use truco_engine::cards::{Card, Suit};
use truco_engine::game::{actions_of, bit, Action, ActionMask};
use truco_engine::truco::*;

pub const RULES: &str = include_str!("haiku_rules.txt");
const SYSTEM: &str = "Sos un jugador experto de truco argentino 1 contra 1 y querés ganar el partido. Respondé solo con el número de la jugada que elegís.";

pub fn card_name(c: Card) -> String {
    let suit = match c.suit() {
        Suit::Espada => "espada",
        Suit::Basto => "basto",
        Suit::Oro => "oro",
        Suit::Copa => "copa",
    };
    format!("{} de {suit}", c.number())
}

fn level_name(level: u8) -> &'static str {
    match level {
        2 => "truco",
        3 => "retruco",
        _ => "vale cuatro",
    }
}

pub fn action_label(a: Action, obs: &Observation) -> String {
    let envido = obs.envido_status == EnvidoStatus::Pending;
    let pending = obs.truco_pending.is_some();
    match a {
        JUGAR0 | JUGAR1 | JUGAR2 => format!("jugar el {}", card_name(obs.hand[a - JUGAR0])),
        ENVIDO => "cantar envido".into(),
        REAL_ENVIDO => "cantar real envido".into(),
        FALTA_ENVIDO => "cantar falta envido".into(),
        TRUCO => "cantar truco".into(),
        RETRUCO if pending => "quiero retruco (aceptar el truco y subir)".into(),
        RETRUCO => "cantar retruco".into(),
        VALE_CUATRO if pending => "quiero vale cuatro (aceptar el retruco y subir)".into(),
        VALE_CUATRO => "cantar vale cuatro".into(),
        QUIERO if envido => "quiero (el envido)".into(),
        QUIERO => "quiero (el truco)".into(),
        NO_QUIERO if envido => "no quiero (el envido)".into(),
        NO_QUIERO => "no quiero (el truco)".into(),
        MAZO => "irse al mazo".into(),
        _ => unreachable!("acción fuera de rango: {a}"),
    }
}

fn who(mine: bool) -> &'static str {
    if mine {
        "vos"
    } else {
        "el rival"
    }
}

/// La situación tal como la ve el jugador, en castellano.
pub fn describe(obs: &Observation) -> String {
    let mut s = String::new();
    s += &format!(
        "Puntaje: vos {}, el rival {} (se juega a 30).\n",
        obs.my_score, obs.opp_score
    );
    s += if obs.is_mano {
        "En esta mano sos mano (jugás primero).\n"
    } else {
        "En esta mano sos pie (el rival es mano).\n"
    };
    let cards: Vec<String> = (0..3)
        .map(|i| {
            let played = obs.my_played.contains(&Some(i));
            format!(
                "{}{}",
                card_name(obs.hand[i]),
                if played { " (ya la jugaste)" } else { "" }
            )
        })
        .collect();
    s += &format!("Tus cartas: {}.\n", cards.join(", "));
    s += &format!("Tus tantos de envido: {}.\n", obs.my_tantos);
    for b in 0..=obs.baza.min(2) {
        let mine = obs.my_played[b].map(|i| card_name(obs.hand[i]));
        let theirs = obs.opp_played[b].map(card_name);
        if mine.is_none() && theirs.is_none() {
            continue;
        }
        let result = match obs.baza_results[b] {
            Some(RelResult::Mine) => " → la ganaste vos",
            Some(RelResult::Theirs) => " → la ganó el rival",
            Some(RelResult::Parda) => " → parda",
            None => "",
        };
        s += &format!(
            "Baza {}: vos {}, el rival {}{result}.\n",
            b + 1,
            mine.unwrap_or_else(|| "todavía no jugaste".into()),
            theirs.unwrap_or_else(|| "todavía no jugó".into())
        );
    }
    let calls: Vec<String> = obs
        .envido_calls
        .iter()
        .flatten()
        .map(|&(k, mine)| {
            let name = match k {
                EnvidoKind::Envido => "envido",
                EnvidoKind::Real => "real envido",
                EnvidoKind::Falta => "falta envido",
            };
            format!("{name} ({})", who(mine))
        })
        .collect();
    s += &match obs.envido_status {
        EnvidoStatus::NotPlayed => "Envido: no se cantó.\n".to_string(),
        EnvidoStatus::Pending => format!(
            "Envido: se cantó {}; falta la respuesta.\n",
            calls.join(", ")
        ),
        EnvidoStatus::Accepted => format!("Envido: se cantó {} y se quiso.\n", calls.join(", ")),
        EnvidoStatus::Declined => format!("Envido: se cantó {} y no se quiso.\n", calls.join(", ")),
    };
    if let Some(t) = obs.opp_revealed_tantos {
        s += &format!("El rival mostró {t} de tantos.\n");
    }
    s += &match obs.truco_pending {
        Some((level, mine)) => format!(
            "Truco: {} cantó {}; falta la respuesta.\n",
            who(mine),
            level_name(level)
        ),
        None if obs.truco_level == 1 => "Truco: no se cantó (la mano vale 1).\n".to_string(),
        None => format!(
            "Truco: se quiso el {} (la mano vale {}).\n",
            level_name(obs.truco_level),
            obs.truco_level
        ),
    };
    s
}

/// El pedido completo y las acciones en el orden del menú.
pub fn prompt(obs: &Observation) -> (String, Vec<Action>) {
    let menu: Vec<Action> = actions_of(obs.legal).collect();
    let lines: Vec<String> = menu
        .iter()
        .enumerate()
        .map(|(i, &a)| format!("{i}) {}", action_label(a, obs)))
        .collect();
    let text = format!(
        "{RULES}\nSituación:\n{}\nJugadas posibles:\n{}\n\nRespondé solo con el número de la jugada.",
        describe(obs),
        lines.join("\n")
    );
    (text, menu)
}

/// El primer número entero de la respuesta, si es una opción del menú.
pub fn parse_choice(text: &str, n: usize) -> Option<usize> {
    let digits: String = text
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse().ok().filter(|&k| k < n)
}

/// La jugada prudente: no querer o tirar la carta más baja (los slots van de la más fuerte a la
/// más débil); si no se puede ninguna, la primera legal.
pub fn fallback(legal: ActionMask) -> Action {
    [NO_QUIERO, JUGAR2, JUGAR1, JUGAR0]
        .into_iter()
        .find(|&a| legal & bit(a) != 0)
        .unwrap_or_else(|| actions_of(legal).next().expect("sin acciones legales"))
}

#[derive(Clone)]
pub struct HaikuOptions {
    pub claude: PathBuf,
    pub model: String,
    pub timeout: Duration,
}

pub struct Answer {
    pub text: String,
    /// Costo a precio de lista que informa Claude Code (con la suscripción no se cobra).
    pub cost_usd: f64,
    /// Nombre completo del modelo que contestó.
    pub model: String,
}

/// Una llamada a `claude -p` con `user` por stdin.
pub fn ask_claude(opts: &HaikuOptions, user: &str) -> Result<Answer, String> {
    let mut child = Command::new(&opts.claude)
        .args([
            "-p",
            "--model",
            opts.model.as_str(),
            "--system-prompt",
            SYSTEM,
            "--tools",
            "",
            "--strict-mcp-config",
            "--setting-sources",
            "",
            "--no-session-persistence",
            "--output-format",
            "json",
        ])
        .current_dir(std::env::temp_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("no pude lanzar {}: {e}", opts.claude.display()))?;
    {
        // Al soltar stdin se cierra y Claude empieza a responder.
        let mut stdin = child.stdin.take().expect("stdin de claude");
        stdin
            .write_all(user.as_bytes())
            .map_err(|e| format!("claude no recibe: {e}"))?;
    }
    let mut stdout = child.stdout.take().expect("stdout de claude");
    let reader = std::thread::spawn(move || {
        let mut out = String::new();
        let _ = stdout.read_to_string(&mut out);
        out
    });
    let t0 = Instant::now();
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => break,
            None if t0.elapsed() > opts.timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "claude no contestó en {} s",
                    opts.timeout.as_secs()
                ));
            }
            None => std::thread::sleep(Duration::from_millis(50)),
        }
    }
    let out = reader.join().expect("lector de claude");
    let v: Value =
        serde_json::from_str(out.trim()).map_err(|e| format!("salida ilegible de claude: {e}"))?;
    if v["is_error"].as_bool() != Some(false) {
        return Err(format!("claude devolvió un error: {}", v["result"]));
    }
    Ok(Answer {
        text: v["result"].as_str().unwrap_or("").to_string(),
        cost_usd: v["total_cost_usd"].as_f64().unwrap_or(0.0),
        model: v["modelUsage"]
            .as_object()
            .and_then(|m| m.keys().next().cloned())
            .unwrap_or_default(),
    })
}

/// Claude jugando con nuestras reglas: dos intentos por decisión y, si no, la jugada prudente.
pub struct HaikuAgent {
    opts: HaikuOptions,
    counters: Arc<Counters>,
}

impl HaikuAgent {
    pub fn new(opts: HaikuOptions, counters: Arc<Counters>) -> HaikuAgent {
        HaikuAgent { opts, counters }
    }
}

impl Agent for HaikuAgent {
    fn name(&self) -> String {
        format!("claude-{}", self.opts.model)
    }

    fn act(&mut self, obs: &Observation, _rng: &mut dyn RngCore) -> Action {
        let (text, menu) = prompt(obs);
        if menu.len() == 1 {
            return menu[0];
        }
        self.counters.decisions.fetch_add(1, Ordering::Relaxed);
        for _ in 0..2 {
            match ask_claude(&self.opts, &text) {
                Ok(answer) => {
                    let micro = (answer.cost_usd * 1e6).round() as u64;
                    self.counters
                        .cost_micro_usd
                        .fetch_add(micro, Ordering::Relaxed);
                    if !answer.model.is_empty() {
                        *self.counters.model.lock().expect("modelo") = answer.model;
                    }
                    if let Some(k) = parse_choice(&answer.text, menu.len()) {
                        return menu[k];
                    }
                    eprintln!("haiku: respuesta sin una opción válida: {:?}", answer.text);
                }
                Err(e) => eprintln!("haiku: {e}"),
            }
        }
        self.counters.fallbacks.fetch_add(1, Ordering::Relaxed);
        fallback(obs.legal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::SmallRng;
    use rand::{Rng, SeedableRng};
    use truco_engine::truco::{deal, TrucoState};

    /// Estados de manos al azar en cada punto de decisión, con las cartas de los dos jugadores.
    fn random_states(n_hands: u64) -> Vec<(Observation, [Card; 3])> {
        let mut rng = SmallRng::seed_from_u64(8);
        let mut out = Vec::new();
        for k in 0..n_hands {
            let scores = [rng.gen_range(0..30), rng.gen_range(0..30)];
            let mut s = TrucoState::new_hand(deal(&mut rng), (k % 2) as usize, scores);
            while !s.is_over() {
                let p = s.turn();
                let obs = s.observation(p);
                out.push((obs, s.hand(1 - p)));
                let acts: Vec<_> = actions_of(obs.legal).collect();
                s.apply(acts[rng.gen_range(0..acts.len())]);
            }
        }
        out
    }

    /// `name` aparece como carta entera (que "1 de espada" no cuente dentro de "11 de espada").
    fn mentions(text: &str, name: &str) -> bool {
        text.match_indices(name)
            .any(|(i, _)| i == 0 || !text.as_bytes()[i - 1].is_ascii_digit())
    }

    #[test]
    fn the_description_never_names_the_rivals_hidden_cards() {
        for (obs, opp_hand) in random_states(500) {
            let (full, _) = prompt(&obs);
            // El resumen de reglas nombra cartas ("1 de espada"...): se mira solo la situación y el menú.
            let text = &full[RULES.len()..];
            for c in opp_hand {
                let shown = obs.opp_played.contains(&Some(c));
                if !shown {
                    assert!(
                        !mentions(text, &card_name(c)),
                        "filtra {}:\n{text}",
                        card_name(c)
                    );
                }
            }
        }
    }

    #[test]
    fn the_menu_lists_every_legal_action_once() {
        for (obs, _) in random_states(300) {
            let (text, menu) = prompt(&obs);
            assert_eq!(menu, actions_of(obs.legal).collect::<Vec<_>>());
            for (i, &a) in menu.iter().enumerate() {
                let line = format!("{i}) {}", action_label(a, &obs));
                assert!(text.contains(&line), "falta «{line}» en:\n{text}");
            }
            let labels: std::collections::HashSet<String> =
                menu.iter().map(|&a| action_label(a, &obs)).collect();
            assert_eq!(labels.len(), menu.len(), "dos jugadas con el mismo texto");
        }
    }

    #[test]
    fn the_root_situation_reads_well() {
        let mut rng = SmallRng::seed_from_u64(1);
        let s = TrucoState::new_hand(deal(&mut rng), 0, [12, 7]);
        let text = describe(&s.observation(0));
        for part in [
            "Puntaje: vos 12, el rival 7",
            "sos mano",
            "Tus cartas:",
            "Tus tantos de envido:",
            "Envido: no se cantó",
            "Truco: no se cantó",
        ] {
            assert!(text.contains(part), "falta «{part}» en:\n{text}");
        }
        assert!(prompt(&s.observation(0)).0.starts_with(RULES));
    }

    #[test]
    fn parse_choice_takes_the_first_number_in_range() {
        assert_eq!(parse_choice("3", 5), Some(3));
        assert_eq!(parse_choice(" 2\n", 5), Some(2));
        assert_eq!(parse_choice("Elijo la 1 porque...", 5), Some(1));
        assert_eq!(parse_choice("7", 5), None);
        assert_eq!(parse_choice("", 5), None);
        assert_eq!(parse_choice("dos", 5), None);
    }

    #[test]
    fn fallback_is_prudent() {
        let m = |acts: &[Action]| acts.iter().fold(0u16, |m, &a| m | bit(a));
        assert_eq!(fallback(m(&[QUIERO, NO_QUIERO, RETRUCO])), NO_QUIERO);
        assert_eq!(fallback(m(&[JUGAR0, JUGAR1, TRUCO, MAZO])), JUGAR1);
        assert_eq!(fallback(m(&[TRUCO, MAZO])), TRUCO);
    }
}
