//! Repeticiones de las manos destacadas: se re-juega cada mano con el motor y se arma un
//! `TableView` por paso, visto desde el asiento del rival, con las cartas del bot a la vista y
//! las probabilidades del bot en cada decisión suya.
use crate::mood::{end_mood, is_bluff, Mood};
use crate::view::{card_label, table_view, TableView, ViewExtra};
use serde::{Deserialize, Serialize};
use truco_engine::cards::Card;
use truco_engine::game::{bit, other, Action, Player};
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::truco::*;

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HandIn {
    pub mano: Player,
    pub start_scores: [u8; 2],
    pub hands: [[String; 3]; 2],
    pub actions: Vec<(Player, String)>,
    pub points: [u8; 2],
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HighlightIn {
    pub rival: String,
    pub kind: String,
    pub call: String,
    pub call_index: usize,
    pub bot_seat: Player,
    pub strength: f64,
    pub response: String,
    pub points_won: u8,
    pub hand: HandIn,
}

#[derive(Serialize, Clone, Debug)]
pub struct ReplayStep {
    pub caption: String,
    pub view: TableView,
}

#[derive(Serialize, Clone, Debug)]
pub struct HighlightOut {
    pub id: String,
    pub title: String,
    pub why: String,
    pub steps: Vec<ReplayStep>,
}

/// Nombre del rival como sujeto de una oración ("Claude Haiku no quiso").
pub fn rival_name(rival: &str) -> &'static str {
    match rival {
        "haiku" => "Claude Haiku",
        "heuristic" => "El heurístico",
        "random" => "El bot al azar",
        _ => "El rival",
    }
}

fn verb(a: Action, card: Option<Card>) -> String {
    match a {
        JUGAR0 | JUGAR1 | JUGAR2 => format!("juega el {}", card_label(card.expect("carta jugada"))),
        ENVIDO => "canta envido".into(),
        REAL_ENVIDO => "canta real envido".into(),
        FALTA_ENVIDO => "canta falta envido".into(),
        TRUCO => "canta truco".into(),
        RETRUCO => "canta retruco".into(),
        VALE_CUATRO => "canta vale cuatro".into(),
        QUIERO => "quiere".into(),
        NO_QUIERO => "no quiere".into(),
        MAZO => "se va al mazo".into(),
        _ => unreachable!("acción inválida {a}"),
    }
}

fn pct(x: f64) -> String {
    format!("{:.1}", x * 100.0).replace('.', ",")
}

fn cards_text(cards: &[Card; 3]) -> String {
    format!(
        "{}, {} y {}",
        card_label(cards[0]),
        card_label(cards[1]),
        card_label(cards[2])
    )
}

pub fn replay(h: &HighlightIn, agent: &MlpAgent, id: String) -> Result<HighlightOut, String> {
    let bot = h.bot_seat;
    let viewer = other(bot);
    let parse = |s: &String| Card::parse(s).ok_or(format!("carta inválida: {s}"));
    let mut hands = [[Card::from_id(0); 3]; 2];
    for (seat, cards) in hands.iter_mut().enumerate() {
        for (slot, card) in cards.iter_mut().enumerate() {
            *card = parse(&h.hand.hands[seat][slot])?;
        }
    }
    let mut s = TrucoState::new_hand(hands, h.hand.mano, h.hand.start_scores);
    let bot_cards = s.hand(bot);
    let rival = rival_name(&h.rival);
    let detail = if h.kind == "truco" {
        format!("una mano del {} % más flojo", pct(h.strength))
    } else {
        {
            let n = h.strength as u8;
            format!("{n} {}", if n == 1 { "tanto" } else { "tantos" })
        }
    };

    let mut steps = vec![ReplayStep {
        caption: format!(
            "Reparto. El bot tiene {}: {}.",
            cards_text(&bot_cards),
            detail
        ),
        view: table_view(
            &s,
            viewer,
            &ViewExtra {
                xray: None,
                mood: Mood::Neutral,
                reveal_bot_hand: true,
            },
        ),
    }];
    let (mut mood, mut bluffed) = (Mood::Neutral, false);
    for (i, (p, name)) in h.hand.actions.iter().enumerate() {
        let a = ACTION_NAMES
            .iter()
            .position(|n| *n == name.as_str())
            .ok_or(format!("acción desconocida: {name}"))?;
        if s.turn() != *p || s.legal_actions() & bit(a) == 0 {
            return Err(format!(
                "{id}: la jugada {i} ({name}) no es legal al re-simular"
            ));
        }
        let xray = (*p == bot).then(|| agent.probabilities(&s.observation(bot)));
        if *p == bot && is_bluff(&s, bot, a) {
            bluffed = true;
            mood = Mood::Farol;
        }
        let card = match a {
            JUGAR0 | JUGAR1 | JUGAR2 => Some(s.hand(*p)[a - JUGAR0]),
            _ => None,
        };
        s.apply(a);
        if s.is_over() {
            mood = end_mood(s.points(), bot, bluffed);
        }
        let actor = if *p == bot { "El bot" } else { rival };
        let mut caption = format!("{actor} {}.", verb(a, card));
        if i == h.call_index {
            caption = format!("{actor} {} con {detail}: farol.", verb(a, card));
        }
        if s.is_over() {
            caption.push_str(&format!(
                " Fin de la mano: el bot suma {}.",
                s.points()[bot]
            ));
        }
        steps.push(ReplayStep {
            caption,
            view: table_view(
                &s,
                viewer,
                &ViewExtra {
                    xray,
                    mood,
                    reveal_bot_hand: true,
                },
            ),
        });
    }
    if s.points() != h.hand.points {
        return Err(format!(
            "{id}: los puntos re-simulados {:?} no coinciden con el registro {:?}",
            s.points(),
            h.hand.points
        ));
    }

    let call_text = verb(
        ACTION_NAMES
            .iter()
            .position(|n| *n == h.call)
            .ok_or("canto desconocido")?,
        None,
    )
    .replace("canta ", "");
    let answer = if h.response == "mazo" {
        "se fue al mazo"
    } else {
        "no quiso"
    };
    let title = if h.kind == "truco" {
        format!(
            "{} con {} · {}",
            capitalize(&call_text),
            numbers_text(&bot_cards),
            rival
        )
    } else {
        format!("{} con {} · {}", capitalize(&call_text), detail, rival)
    };
    let why = format!(
        "El bot cantó {call_text} con {} ({detail}). {rival} {answer} y el bot sumó {} {} en la mano.",
        cards_text(&bot_cards),
        h.points_won,
        if h.points_won == 1 { "punto" } else { "puntos" }
    );
    Ok(HighlightOut {
        id,
        title,
        why,
        steps,
    })
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next()
        .map(|f| f.to_uppercase().collect::<String>() + c.as_str())
        .unwrap_or_default()
}

/// "10, 4 y 4": los números de las tres cartas, para el título.
fn numbers_text(cards: &[Card; 3]) -> String {
    format!(
        "{}, {} y {}",
        cards[0].number(),
        cards[1].number(),
        cards[2].number()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use truco_engine::mlp::Mlp;
    use truco_engine::policy::PolicyKind;

    fn agent() -> MlpAgent {
        let bytes = std::fs::read(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../models/strategy.tcfrw"
        ))
        .unwrap();
        MlpAgent::shared(
            Arc::new(Mlp::from_bytes(&bytes).unwrap()),
            PolicyKind::Strategy,
            "bot",
        )
    }

    fn haiku() -> HighlightIn {
        serde_json::from_str(r#"{"rival":"haiku","kind":"truco","call":"truco","callIndex":4,"botSeat":1,
            "strength":0.00298582995951417,"response":"noQuiero","pointsWon":3,
            "hand":{"mano":0,"startScores":[10,20],"hands":[["11C","6E","4O"],["10C","4E","4C"]],
            "actions":[[0,"jugar2"],[1,"envido"],[0,"quiero"],[1,"jugar0"],[1,"truco"],[0,"noQuiero"]],
            "points":[0,3]}}"#).unwrap()
    }

    #[test]
    fn repeticion_de_la_mano_de_haiku() {
        let out = replay(&haiku(), &agent(), "haiku-truco-1".into()).unwrap();
        assert_eq!(out.steps.len(), 7);
        assert_eq!(out.title, "Truco con 10, 4 y 4 · Claude Haiku");
        assert!(out.why.contains("Claude Haiku no quiso"), "{}", out.why);
        assert!(
            out.steps[0]
                .caption
                .starts_with("Reparto. El bot tiene 10 de copa"),
            "{}",
            out.steps[0].caption
        );
        assert!(
            out.steps[5].caption.contains("farol"),
            "{}",
            out.steps[5].caption
        );
        assert!(
            out.steps[6].caption.ends_with("el bot suma 3."),
            "{}",
            out.steps[6].caption
        );
        assert!(
            out.steps[2].view.xray.is_some(),
            "el paso del envido del bot trae rayos X"
        );
        assert!(out.steps[1].view.xray.is_none(), "la jugada de Haiku no");
        assert_eq!(out.steps[6].view.phase, "finDeMano");
        assert_eq!(out.steps[6].view.mood, "gana");
        assert!(out.steps.iter().all(|s| s.view.bot_hand.is_some()));
    }

    #[test]
    fn una_jugada_ilegal_es_un_error() {
        let mut h = haiku();
        h.hand.actions[0] = (1, "jugar0".into()); // no es el turno del asiento 1
        assert!(replay(&h, &agent(), "x".into()).is_err());
    }

    #[test]
    fn puntos_distintos_al_registro_es_un_error() {
        let mut h = haiku();
        h.hand.points = [0, 2];
        assert!(replay(&h, &agent(), "x".into()).is_err());
    }
}
