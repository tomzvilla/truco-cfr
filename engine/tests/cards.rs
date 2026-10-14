use truco_engine::cards::{full_deck, Card, Suit};

fn c(s: &str) -> Card {
    Card::parse(s).unwrap()
}

#[test]
fn deck_has_40_distinct_cards_and_roundtrips() {
    let deck = full_deck();
    let mut ids: Vec<u8> = deck.iter().map(|c| c.id()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), 40);
    for card in deck {
        assert_eq!(Card::parse(&card.to_string()), Some(card));
    }
}

#[test]
fn truco_hierarchy() {
    let order = ["1E", "1B", "7E", "7O", "3C", "2O", "1C", "12E", "11B", "10O", "7C", "6E", "5E", "4E"];
    for w in order.windows(2) {
        assert!(c(w[0]).rank() > c(w[1]).rank(), "{} debería ganarle a {}", w[0], w[1]);
    }
    assert_eq!(c("1C").rank(), c("1O").rank());
    assert_eq!(c("7C").rank(), c("7B").rank());
    assert_eq!(c("3E").rank(), c("3O").rank());
    assert_eq!(c("1E").rank(), 14);
    assert_eq!(c("4C").rank(), 1);
}

#[test]
fn envido_values() {
    assert_eq!(c("7O").envido_value(), 7);
    assert_eq!(c("1E").envido_value(), 1);
    assert_eq!(c("10C").envido_value(), 0);
    assert_eq!(c("12B").envido_value(), 0);
}

#[test]
fn parse_rejects_invalid() {
    for s in ["8E", "9O", "1X", "", "E", "13C", "1é"] {
        assert_eq!(Card::parse(s), None, "{s:?} no debería parsear");
    }
}

#[test]
fn accessors() {
    let card = Card::new(Suit::Copa, 12);
    assert_eq!(card.suit(), Suit::Copa);
    assert_eq!(card.number(), 12);
    assert_eq!(card.to_string(), "12C");
    assert_eq!(Card::from_id(card.id()), card);
}
