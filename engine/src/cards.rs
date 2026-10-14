//! Cartas del mazo español de 40 y su jerarquía en el truco.
use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Suit {
    Espada,
    Basto,
    Oro,
    Copa,
}

impl Suit {
    pub const ALL: [Suit; 4] = [Suit::Espada, Suit::Basto, Suit::Oro, Suit::Copa];

    pub fn letter(self) -> char {
        match self {
            Suit::Espada => 'E',
            Suit::Basto => 'B',
            Suit::Oro => 'O',
            Suit::Copa => 'C',
        }
    }

    pub fn from_letter(c: char) -> Option<Suit> {
        match c {
            'E' => Some(Suit::Espada),
            'B' => Some(Suit::Basto),
            'O' => Some(Suit::Oro),
            'C' => Some(Suit::Copa),
            _ => None,
        }
    }
}

/// Números del mazo de 40 (sin 8 ni 9).
pub const NUMBERS: [u8; 10] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

/// Una carta, identificada por un id de 0 a 39: `palo * 10 + posición del número en NUMBERS`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Card(u8);

impl Card {
    pub fn new(suit: Suit, number: u8) -> Card {
        let idx = NUMBERS
            .iter()
            .position(|&n| n == number)
            .unwrap_or_else(|| panic!("número de carta inválido: {number}"));
        Card(suit as u8 * 10 + idx as u8)
    }

    pub fn from_id(id: u8) -> Card {
        assert!(id < 40, "id de carta fuera de rango: {id}");
        Card(id)
    }

    pub fn id(self) -> u8 {
        self.0
    }

    pub fn suit(self) -> Suit {
        Suit::ALL[(self.0 / 10) as usize]
    }

    pub fn number(self) -> u8 {
        NUMBERS[(self.0 % 10) as usize]
    }

    /// Jerarquía del truco: 14 = ancho de espada, ..., 1 = cuatros. A mayor número, más fuerte.
    pub fn rank(self) -> u8 {
        match (self.number(), self.suit()) {
            (1, Suit::Espada) => 14,
            (1, Suit::Basto) => 13,
            (7, Suit::Espada) => 12,
            (7, Suit::Oro) => 11,
            (3, _) => 10,
            (2, _) => 9,
            (1, _) => 8,
            (12, _) => 7,
            (11, _) => 6,
            (10, _) => 5,
            (7, _) => 4,
            (6, _) => 3,
            (5, _) => 2,
            (4, _) => 1,
            (n, _) => unreachable!("número imposible: {n}"),
        }
    }

    /// Valor para el envido: las figuras (10, 11, 12) valen 0.
    pub fn envido_value(self) -> u8 {
        let n = self.number();
        if n >= 10 {
            0
        } else {
            n
        }
    }

    /// Notación corta: número + letra del palo (E, B, O, C). Ejemplos: "1E", "7O", "12C".
    pub fn parse(s: &str) -> Option<Card> {
        let suit_char = s.chars().last()?;
        let suit = Suit::from_letter(suit_char)?;
        let number: u8 = s[..s.len() - suit_char.len_utf8()].parse().ok()?;
        if !NUMBERS.contains(&number) {
            return None;
        }
        Some(Card::new(suit, number))
    }
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.number(), self.suit().letter())
    }
}

pub fn full_deck() -> [Card; 40] {
    std::array::from_fn(|i| Card(i as u8))
}
