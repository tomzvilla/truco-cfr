//! La mesa vista por un jugador, con la misma forma que `TableView` de la web
//! (web/src/table/types.ts). El que mira es "yo"; el otro asiento es "bot".
use crate::mood::Mood;
use serde::Serialize;
use truco_engine::cards::{Card, Suit};
use truco_engine::game::{actions_of, other, Action, Player};
use truco_engine::policy::Probs;
use truco_engine::truco::{BazaResult, EnvidoKind, EnvidoStatus, TrucoState, ACTION_NAMES, TARGET};

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct CardView {
    pub suit: &'static str,
    pub number: u8,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HandCard {
    pub card: CardView,
    pub played: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct TrickView {
    pub mine: Option<CardView>,
    pub bot: Option<CardView>,
    /// "yo", "bot", "parda" o null si la baza no se definió.
    pub winner: Option<&'static str>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Call {
    pub call: &'static str,
    pub by: &'static str,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrucoView {
    pub accepted_level: u8,
    pub pending: Option<Call>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Pending {
    pub by: &'static str,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Reveal {
    pub yo: Option<u8>,
    pub bot: Option<u8>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct EnvidoView {
    pub calls: Vec<Call>,
    pub pending: Option<Pending>,
    pub reveal: Option<Reveal>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct XRayEntry {
    pub action: &'static str,
    pub prob: f32,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct HandResult {
    pub yo: u8,
    pub bot: u8,
    /// Quien sumó más puntos en la mano; null si sumaron lo mismo.
    pub winner: Option<&'static str>,
}

/// La última jugada de la mano y quién la hizo (para anunciar cantos y respuestas).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct LastAction {
    pub by: &'static str,
    pub action: &'static str,
}

/// Lo que dio el envido a cada uno, una vez resuelto (querido o no).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct EnvidoPoints {
    pub yo: u8,
    pub bot: u8,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableView {
    pub hand: Vec<HandCard>,
    pub tricks: Vec<TrickView>,
    pub score: [u8; 2],
    pub mano: &'static str,
    pub truco: TrucoView,
    pub envido: EnvidoView,
    pub actions: Vec<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xray: Option<Vec<XRayEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_hand: Option<Vec<CardView>>,
    pub mood: &'static str,
    pub phase: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<HandResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_winner: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<LastAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub envido_points: Option<EnvidoPoints>,
}

/// Lo que la vista no puede sacar del estado: la última decisión del bot, su humor, si se
/// muestran sus cartas (al terminar la mano siempre se muestran), la última jugada de la mano
/// y lo que dio el envido.
pub struct ViewExtra {
    pub xray: Option<Probs>,
    pub mood: Mood,
    pub reveal_bot_hand: bool,
    pub last: Option<(Player, Action)>,
    /// Puntos del envido por asiento, una vez resuelto.
    pub envido_points: Option<[u8; 2]>,
}

/// Si la jugada que llevó de `before` a `after` resolvió el envido: lo que sumó cada asiento.
pub fn envido_resolved(before: &TrucoState, after: &TrucoState) -> Option<[u8; 2]> {
    let resolved = before.envido_status() == EnvidoStatus::Pending
        && after.envido_status() != EnvidoStatus::Pending;
    resolved.then(|| {
        let (b, a) = (before.points(), after.points());
        [a[0] - b[0], a[1] - b[1]]
    })
}

fn suit_name(s: Suit) -> &'static str {
    match s {
        Suit::Espada => "espada",
        Suit::Basto => "basto",
        Suit::Oro => "oro",
        Suit::Copa => "copa",
    }
}

pub fn card_view(c: Card) -> CardView {
    CardView {
        suit: suit_name(c.suit()),
        number: c.number(),
    }
}

/// "4 de espada": para los textos de las repeticiones.
pub fn card_label(c: Card) -> String {
    format!("{} de {}", c.number(), suit_name(c.suit()))
}

fn envido_name(k: EnvidoKind) -> &'static str {
    match k {
        EnvidoKind::Envido => "envido",
        EnvidoKind::Real => "realEnvido",
        EnvidoKind::Falta => "faltaEnvido",
    }
}

fn truco_name(level: u8) -> &'static str {
    match level {
        2 => "truco",
        3 => "retruco",
        4 => "valeCuatro",
        _ => unreachable!("nivel de truco inválido: {level}"),
    }
}

pub fn table_view(s: &TrucoState, viewer: Player, extra: &ViewExtra) -> TableView {
    let rival = other(viewer);
    let seat = |p: Player| if p == viewer { "yo" } else { "bot" };
    let by = |mine: bool| if mine { "yo" } else { "bot" };
    let obs = s.observation(viewer);
    let over = s.is_over();

    let hand = s.hand(viewer);
    let played = s.played(viewer);
    let hand_view = (0..3)
        .map(|i| HandCard {
            card: card_view(hand[i]),
            played: played.contains(&Some(i)),
        })
        .collect();

    let rival_hand = s.hand(rival);
    let rival_played = s.played(rival);
    let mut tricks = Vec::new();
    for b in 0..3 {
        let mine = played[b].map(|slot| card_view(hand[slot]));
        let theirs = rival_played[b].map(|slot| card_view(rival_hand[slot]));
        if mine.is_none() && theirs.is_none() {
            break;
        }
        let winner = s.baza_results()[b].map(|r| match r {
            BazaResult::Won(p) => seat(p),
            BazaResult::Parda => "parda",
        });
        tricks.push(TrickView {
            mine,
            bot: theirs,
            winner,
        });
    }

    let calls: Vec<Call> = obs
        .envido_calls
        .iter()
        .flatten()
        .map(|&(k, mine)| Call {
            call: envido_name(k),
            by: by(mine),
        })
        .collect();
    let envido_pending = if s.envido_status() == EnvidoStatus::Pending {
        calls.last().map(|c| Pending { by: c.by })
    } else {
        None
    };
    let revealed = s.revealed_tantos();
    let reveal = if revealed.iter().any(Option::is_some) {
        Some(Reveal {
            yo: revealed[viewer],
            bot: revealed[rival],
        })
    } else {
        None
    };

    let actions = if !over && s.turn() == viewer {
        actions_of(s.legal_actions())
            .map(|a| ACTION_NAMES[a])
            .collect()
    } else {
        Vec::new()
    };

    let xray = extra.xray.map(|p| {
        (0..ACTION_NAMES.len())
            .filter(|&a| p[a] > 0.0)
            .map(|a| XRayEntry {
                action: ACTION_NAMES[a],
                prob: p[a],
            })
            .collect()
    });

    let points = s.points();
    let result = over.then(|| HandResult {
        yo: points[viewer],
        bot: points[rival],
        winner: match points[viewer].cmp(&points[rival]) {
            std::cmp::Ordering::Greater => Some("yo"),
            std::cmp::Ordering::Less => Some("bot"),
            std::cmp::Ordering::Equal => None,
        },
    });
    let match_winner = [viewer, rival]
        .into_iter()
        .find(|&p| s.score(p) >= TARGET)
        .map(seat);

    TableView {
        hand: hand_view,
        tricks,
        score: [s.score(viewer), s.score(rival)],
        mano: seat(s.mano()),
        truco: TrucoView {
            accepted_level: s.truco_level(),
            pending: obs.truco_pending.map(|(level, mine)| Call {
                call: truco_name(level),
                by: by(mine),
            }),
        },
        envido: EnvidoView {
            calls,
            pending: envido_pending,
            reveal,
        },
        actions,
        xray,
        bot_hand: (over || extra.reveal_bot_hand)
            .then(|| rival_hand.iter().map(|&c| card_view(c)).collect()),
        mood: extra.mood.name(),
        phase: if over { "finDeMano" } else { "jugando" },
        result,
        match_winner,
        last: extra.last.map(|(p, a)| LastAction {
            by: seat(p),
            action: ACTION_NAMES[a],
        }),
        envido_points: extra.envido_points.map(|pts| EnvidoPoints {
            yo: pts[viewer],
            bot: pts[rival],
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use truco_engine::truco::*;

    fn h(a: &str, b: &str, c: &str) -> [Card; 3] {
        [a, b, c].map(|s| Card::parse(s).expect("carta"))
    }

    fn plain() -> ViewExtra {
        ViewExtra {
            xray: None,
            mood: Mood::Neutral,
            reveal_bot_hand: false,
            last: None,
            envido_points: None,
        }
    }

    fn start() -> TrucoState {
        TrucoState::new_hand([h("4B", "1E", "7O"), h("5O", "3C", "6B")], 0, [3, 5])
    }

    fn js(s: &TrucoState, viewer: Player) -> Value {
        serde_json::to_value(table_view(s, viewer, &plain())).unwrap()
    }

    #[test]
    fn inicio_de_mano_visto_por_el_mano() {
        let v = js(&start(), 0);
        assert_eq!(
            v,
            json!({
                "hand": [
                    { "card": { "suit": "espada", "number": 1 }, "played": false },
                    { "card": { "suit": "oro", "number": 7 }, "played": false },
                    { "card": { "suit": "basto", "number": 4 }, "played": false }
                ],
                "tricks": [],
                "score": [3, 5],
                "mano": "yo",
                "truco": { "acceptedLevel": 1, "pending": null },
                "envido": { "calls": [], "pending": null, "reveal": null },
                "actions": ["jugar0", "jugar1", "jugar2", "envido", "realEnvido", "faltaEnvido", "truco", "mazo"],
                "mood": "neutral",
                "phase": "jugando"
            })
        );
    }

    #[test]
    fn el_que_no_juega_no_tiene_acciones() {
        let v = js(&start(), 1);
        assert_eq!(v["actions"], json!([]));
        assert_eq!(v["mano"], json!("bot"));
        assert_eq!(v["score"], json!([5, 3]));
    }

    #[test]
    fn una_baza_jugada() {
        let mut s = start();
        s.apply(JUGAR0); // 1 de espada
        s.apply(JUGAR0); // 3 de copa
        let v = js(&s, 0);
        assert_eq!(
            v["tricks"],
            json!([{ "mine": { "suit": "espada", "number": 1 }, "bot": { "suit": "copa", "number": 3 }, "winner": "yo" }])
        );
        assert_eq!(v["hand"][0]["played"], json!(true));
        let v1 = js(&s, 1);
        assert_eq!(
            v1["tricks"][0]["winner"],
            json!("bot"),
            "visto del otro lado"
        );
    }

    #[test]
    fn baza_a_medio_jugar() {
        let mut s = start();
        s.apply(JUGAR1); // 7 de oro
        let v = js(&s, 1);
        assert_eq!(
            v["tricks"],
            json!([{ "mine": null, "bot": { "suit": "oro", "number": 7 }, "winner": null }])
        );
    }

    #[test]
    fn truco_pendiente() {
        let mut s = start();
        s.apply(TRUCO);
        let v = js(&s, 1);
        assert_eq!(
            v["truco"],
            json!({ "acceptedLevel": 1, "pending": { "call": "truco", "by": "bot" } })
        );
        let actions: Vec<String> = serde_json::from_value(v["actions"].clone()).unwrap();
        for a in ["quiero", "noQuiero", "retruco"] {
            assert!(actions.contains(&a.to_string()), "falta {a} en {actions:?}");
        }
        assert_eq!(js(&s, 0)["truco"]["pending"]["by"], json!("yo"));
    }

    #[test]
    fn envido_querido_son_buenas() {
        let mut s = start();
        s.apply(ENVIDO); // el mano (7 tantos) canta
        let v = js(&s, 1);
        assert_eq!(v["envido"]["pending"], json!({ "by": "bot" }));
        s.apply(QUIERO); // el pie (6 tantos) quiere y pierde: "son buenas"
        let v = js(&s, 0);
        assert_eq!(
            v["envido"],
            json!({ "calls": [{ "call": "envido", "by": "yo" }], "pending": null, "reveal": { "yo": 7, "bot": null } })
        );
        assert_eq!(v["score"], json!([5, 5]));
    }

    #[test]
    fn ultima_jugada_y_puntos_del_envido_vistos_por_cada_uno() {
        let before = start();
        let mut s = before;
        s.apply(REAL_ENVIDO); // el mano (asiento 0, 7 tantos) canta real envido
        assert_eq!(envido_resolved(&before, &s), None, "cantar no resuelve");
        let before = s;
        s.apply(QUIERO); // el pie quiere y pierde: 3 para el asiento 0
        let pts = envido_resolved(&before, &s);
        assert_eq!(pts, Some([3, 0]));
        let extra = ViewExtra {
            last: Some((1, QUIERO)),
            envido_points: pts,
            ..plain()
        };
        let mine = serde_json::to_value(table_view(&s, 0, &extra)).unwrap();
        assert_eq!(mine["last"], json!({ "by": "bot", "action": "quiero" }));
        assert_eq!(mine["envidoPoints"], json!({ "yo": 3, "bot": 0 }));
        let theirs = serde_json::to_value(table_view(&s, 1, &extra)).unwrap();
        assert_eq!(theirs["last"], json!({ "by": "yo", "action": "quiero" }));
        assert_eq!(theirs["envidoPoints"], json!({ "yo": 0, "bot": 3 }));
        assert!(js(&s, 0).get("last").is_none(), "sin jugada no se manda");
    }

    #[test]
    fn envido_no_querido_da_puntos_al_que_canto() {
        let before = start();
        let mut s = before;
        s.apply(ENVIDO);
        let before = s;
        s.apply(NO_QUIERO);
        assert_eq!(envido_resolved(&before, &s), Some([1, 0]));
    }

    #[test]
    fn fin_de_mano_y_de_partido() {
        // el bot tiene 28: el humano se va al mazo antes del envido y le da 2
        let mut s = TrucoState::new_hand([h("4B", "1E", "7O"), h("5O", "3C", "6B")], 0, [3, 28]);
        s.apply(MAZO);
        let v = js(&s, 0);
        assert_eq!(v["phase"], json!("finDeMano"));
        assert_eq!(v["actions"], json!([]));
        assert_eq!(v["score"], json!([3, 30]));
        assert_eq!(v["result"], json!({ "yo": 0, "bot": 2, "winner": "bot" }));
        assert_eq!(v["matchWinner"], json!("bot"));
        assert_eq!(v["botHand"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn fin_de_mano_sin_fin_de_partido() {
        let mut s = start();
        s.apply(MAZO);
        let v = js(&s, 0);
        assert_eq!(v["result"], json!({ "yo": 0, "bot": 2, "winner": "bot" }));
        assert!(v.get("matchWinner").is_none());
    }

    #[test]
    fn rayos_x_solo_con_probabilidad() {
        let mut probs = [0.0f32; 12];
        probs[JUGAR0] = 0.75;
        probs[TRUCO] = 0.25;
        let extra = ViewExtra {
            xray: Some(probs),
            mood: Mood::Farol,
            reveal_bot_hand: true,
            last: None,
            envido_points: None,
        };
        let v = serde_json::to_value(table_view(&start(), 0, &extra)).unwrap();
        assert_eq!(
            v["xray"],
            json!([{ "action": "jugar0", "prob": 0.75 }, { "action": "truco", "prob": 0.25 }])
        );
        assert_eq!(v["mood"], json!("farol"));
        assert_eq!(v["botHand"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn etiqueta_de_carta() {
        assert_eq!(card_label(Card::parse("12C").unwrap()), "12 de copa");
    }
}
