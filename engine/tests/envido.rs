use truco_engine::cards::Card;
use truco_engine::envido::envido_points;

fn pts(s: &str) -> u8 {
    let hand: Vec<Card> = s
        .split_whitespace()
        .map(|t| Card::parse(t).unwrap())
        .collect();
    envido_points(&hand)
}

#[test]
fn envido_cases() {
    assert_eq!(pts("7E 6E 1C"), 33);
    assert_eq!(pts("12E 11E 4C"), 20);
    assert_eq!(pts("1O 12C 4B"), 4);
    assert_eq!(
        pts("7O 5O 6O"),
        33,
        "con tres del mismo palo cuentan las dos mejores"
    );
    assert_eq!(pts("10C 11B 12O"), 0);
    assert_eq!(pts("7C 10C 6B"), 27);
    assert_eq!(pts("3E 2B 1O"), 3);
}
