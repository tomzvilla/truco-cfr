//! El humor de Fosfo, la mascota del bot. Sale de lo que hizo el bot en la mano.
use truco_engine::agents::is_high;
use truco_engine::game::{other, Action, Player};
use truco_engine::truco::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mood {
    Neutral,
    Farol,
    Descubierto,
    Gana,
    Pierde,
}

impl Mood {
    /// El nombre que usa la web (`MOODS` en web/src/table/types.ts).
    pub fn name(self) -> &'static str {
        match self {
            Mood::Neutral => "neutral",
            Mood::Farol => "farol",
            Mood::Descubierto => "descubierto",
            Mood::Gana => "gana",
            Mood::Pierde => "pierde",
        }
    }
}

/// ¿El canto `a` del `bot` es un farol? Se mira ANTES de aplicarlo: envido con 7 tantos o menos,
/// o truco, retruco o vale cuatro sin ninguna carta alta (un 3 o mejor) entre las que le quedan.
pub fn is_bluff(s: &TrucoState, bot: Player, a: Action) -> bool {
    match a {
        ENVIDO | REAL_ENVIDO | FALTA_ENVIDO => s.tantos(bot) <= 7,
        TRUCO | RETRUCO | VALE_CUATRO => {
            let played = s.played(bot);
            let hand = s.hand(bot);
            !(0..3).any(|slot| !played.contains(&Some(slot)) && is_high(hand[slot]))
        }
        _ => false,
    }
}

/// Humor al terminar la mano según los puntos que sumó cada uno en ella.
pub fn end_mood(points: [u8; 2], bot: Player, bluffed: bool) -> Mood {
    let (b, h) = (points[bot], points[other(bot)]);
    if b > h {
        Mood::Gana
    } else if h > b && bluffed {
        Mood::Descubierto
    } else if h > b {
        Mood::Pierde
    } else {
        Mood::Neutral
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use truco_engine::cards::Card;

    fn h(a: &str, b: &str, c: &str) -> [Card; 3] {
        [a, b, c].map(|s| Card::parse(s).expect("carta"))
    }

    #[test]
    fn envido_con_siete_o_menos_es_farol() {
        // el bot es el asiento 1: 4E 5B 6O = 6 tantos
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(is_bluff(&s, 1, ENVIDO));
        assert!(is_bluff(&s, 1, FALTA_ENVIDO));
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("7E", "6E", "4B")], 1, [0, 0]);
        assert!(!is_bluff(&s, 1, ENVIDO), "33 tantos no es farol");
    }

    #[test]
    fn truco_sin_cartas_altas_es_farol() {
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(is_bluff(&s, 1, TRUCO));
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("1E", "4B", "5O")], 1, [0, 0]);
        assert!(
            !is_bluff(&s, 1, TRUCO),
            "con el ancho de espada no es farol"
        );
    }

    #[test]
    fn despues_de_jugar_la_carta_alta_el_truco_es_farol() {
        let mut s = TrucoState::new_hand([h("4C", "5C", "6C"), h("1E", "4B", "5O")], 1, [0, 0]);
        s.apply(JUGAR0); // el bot (mano) juega el 1 de espada
        s.apply(JUGAR0); // el humano juega su carta más alta y pierde la baza
        assert_eq!(s.turn(), 1);
        assert!(is_bluff(&s, 1, TRUCO));
    }

    #[test]
    fn jugar_una_carta_o_responder_no_es_farol() {
        let s = TrucoState::new_hand([h("4C", "5C", "6C"), h("4E", "5B", "6O")], 1, [0, 0]);
        assert!(!is_bluff(&s, 1, JUGAR0));
        assert!(!is_bluff(&s, 1, MAZO));
    }

    #[test]
    fn humor_al_terminar_la_mano() {
        assert_eq!(end_mood([0, 3], 1, false), Mood::Gana);
        assert_eq!(end_mood([2, 0], 1, true), Mood::Descubierto);
        assert_eq!(end_mood([2, 0], 1, false), Mood::Pierde);
        assert_eq!(end_mood([2, 2], 1, true), Mood::Neutral);
        assert_eq!(Mood::Descubierto.name(), "descubierto");
    }
}
