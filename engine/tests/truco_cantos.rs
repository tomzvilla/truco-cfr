mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

#[test]
fn truco_quiero_returns_turn_to_caller() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO]);
    assert_eq!(s.turn(), 1);
    assert_eq!(
        s.legal_actions() & mask(&[QUIERO, NO_QUIERO, RETRUCO]),
        mask(&[QUIERO, NO_QUIERO, RETRUCO])
    );
    let s = play(s, &[QUIERO]);
    assert_eq!(s.truco_level(), 2);
    assert_eq!(s.turn(), 0, "vuelve a jugar el que cantó");
    assert_eq!(
        s.legal_actions() & mask(&[TRUCO, RETRUCO]),
        0,
        "el que cantó no puede subir"
    );
}

#[test]
fn holder_can_raise_on_own_turn() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, QUIERO, JUGAR0]);
    assert_eq!(s.turn(), 1);
    assert_ne!(s.legal_actions() & mask(&[RETRUCO]), 0);
}

#[test]
fn truco_no_quiero_gives_one() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, NO_QUIERO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn quiero_retruco_then_quiero_plays_for_three() {
    let s = play(new("4C 5C 6C", "1E 7E 3O"), &[TRUCO, RETRUCO, QUIERO]);
    assert_eq!(s.truco_level(), 3);
    assert_eq!(s.turn(), 0, "el turno vuelve al que empezó la cadena");
    assert_ne!(
        s.legal_actions() & mask(&[VALE_CUATRO]),
        0,
        "el último quiero lo dijo el jugador 0"
    );
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 6C<1E, 5C<7E
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 3]);
}

#[test]
fn retruco_no_quiero_gives_two_to_raiser() {
    let s = play(new("4C 5C 6C", "1E 7E 3O"), &[TRUCO, RETRUCO, NO_QUIERO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn vale_cuatro_chain() {
    let s = play(
        new("1E 7E 4C", "3C 2C 5O"),
        &[TRUCO, RETRUCO, VALE_CUATRO, QUIERO],
    );
    assert_eq!(s.truco_level(), 4);
    assert_eq!(s.legal_actions() & mask(&[TRUCO, RETRUCO, VALE_CUATRO]), 0);
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 1E>3C, 7E>2C
    assert_eq!(s.points(), [4, 0]);
}

#[test]
fn mazo_after_accepted_truco_pays_level() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[TRUCO, QUIERO, JUGAR0, MAZO]);
    assert_eq!(
        s.points(),
        [3, 0],
        "truco aceptado (2) + 1 porque el envido no se jugó en primera"
    );
}

#[test]
fn truco_can_be_called_mid_hand() {
    let s = play(
        new("1E 7E 4C", "3C 2C 5O"),
        &[JUGAR0, JUGAR0, TRUCO, QUIERO],
    );
    assert_eq!(s.truco_level(), 2);
    assert_eq!(s.turn(), 0);
    let s = play(s, &[JUGAR1, JUGAR1]); // 7E>2C
    assert_eq!(s.points(), [2, 0]);
}
