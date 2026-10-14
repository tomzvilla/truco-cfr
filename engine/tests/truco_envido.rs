mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

// p0 "7E 6E 1C" = 33 tantos; p1 "12O 11O 4B" = 20 tantos.

#[test]
fn envido_quiero_mano_wins_and_reveals() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [2, 0]);
    assert_eq!(s.envido_status(), EnvidoStatus::Accepted);
    assert_eq!(
        s.revealed_tantos(),
        [Some(33), None],
        "el pie perdió: dice son buenas"
    );
    assert_eq!(s.turn(), 0, "vuelve el turno al que cantó");
    assert!(!s.is_over());
}

#[test]
fn envido_pie_wins_reveals_both() {
    let s = play(new("12O 11O 4B", "7E 6E 1C"), &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 2]);
    assert_eq!(s.revealed_tantos(), [Some(20), Some(33)]);
}

#[test]
fn envido_tie_goes_to_mano() {
    let s = new_with("7E 6E 1C", "7O 6O 1B", 1, [0, 0]);
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 2], "empate: gana el mano (jugador 1)");
}

#[test]
fn envido_no_quiero_gives_one() {
    let s = play(new("12O 11O 4B", "7E 6E 1C"), &[ENVIDO, NO_QUIERO]);
    assert_eq!(s.points(), [1, 0]);
    assert_eq!(s.envido_status(), EnvidoStatus::Declined);
    assert_eq!(s.revealed_tantos(), [None, None]);
}

#[test]
fn raise_sets() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO]);
    assert_eq!(
        s.legal_actions(),
        mask(&[QUIERO, NO_QUIERO, ENVIDO, REAL_ENVIDO, FALTA_ENVIDO])
    );
    let s2 = play(s, &[ENVIDO]);
    assert_eq!(
        s2.legal_actions(),
        mask(&[QUIERO, NO_QUIERO, REAL_ENVIDO, FALTA_ENVIDO])
    );
    let s3 = play(new("7E 6E 1C", "12O 11O 4B"), &[REAL_ENVIDO]);
    assert_eq!(s3.legal_actions(), mask(&[QUIERO, NO_QUIERO, FALTA_ENVIDO]));
    let s4 = play(new("7E 6E 1C", "12O 11O 4B"), &[FALTA_ENVIDO]);
    assert_eq!(s4.legal_actions(), mask(&[QUIERO, NO_QUIERO]));
}

#[test]
fn envido_envido_real_values() {
    let base = new("7E 6E 1C", "12O 11O 4B");
    let declined = play(base, &[ENVIDO, ENVIDO, REAL_ENVIDO, NO_QUIERO]);
    assert_eq!(declined.points(), [4, 0], "rechazado: paga envido + envido");
    let accepted = play(base, &[ENVIDO, ENVIDO, REAL_ENVIDO, QUIERO]);
    assert_eq!(accepted.points(), [7, 0]);
    let er_declined = play(base, &[ENVIDO, REAL_ENVIDO, NO_QUIERO]);
    assert_eq!(
        er_declined.points(),
        [0, 2],
        "el pie subió con real envido y el mano no quiso"
    );
}

#[test]
fn falta_envido_in_malas_wins_match() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 0, [10, 5]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.score(0), 30);
    assert!(s.is_over());
}

#[test]
fn falta_envido_in_buenas_is_what_leader_needs() {
    let s = new_with("12O 11O 4B", "7E 6E 1C", 0, [20, 10]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.points(), [0, 10], "le faltan 10 al que va ganando");
}

#[test]
fn falta_envido_at_exactly_15_is_buenas() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 0, [15, 3]);
    let s = play(s, &[FALTA_ENVIDO, QUIERO]);
    assert_eq!(s.points(), [15, 0]);
}

#[test]
fn falta_declined_after_envido_pays_envido() {
    let s = play(
        new("7E 6E 1C", "12O 11O 4B"),
        &[ENVIDO, FALTA_ENVIDO, NO_QUIERO],
    );
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn envido_va_primero() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    assert_ne!(
        s.legal_actions() & mask(&[ENVIDO]),
        0,
        "el pie puede contestar con envido"
    );
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.points(), [2, 0]);
    assert_eq!(s.turn(), 1, "vuelve al pie a responder el truco");
    assert_eq!(s.legal_actions(), mask(&[QUIERO, NO_QUIERO, RETRUCO]));
    let s = play(s, &[QUIERO]);
    assert_eq!(s.turn(), 0);
    assert_eq!(s.truco_level(), 2);
}

#[test]
fn envido_closed_after_truco_accepted() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO, QUIERO]);
    assert_eq!(
        s.legal_actions() & mask(&[ENVIDO, REAL_ENVIDO, FALTA_ENVIDO]),
        0
    );
}

#[test]
fn pie_can_call_envido_after_mano_played() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0]);
    assert_ne!(s.legal_actions() & mask(&[ENVIDO]), 0);
    let s = play(s, &[ENVIDO, QUIERO]);
    assert_eq!(s.turn(), 1, "el pie todavía tiene que jugar su carta");
}

#[test]
fn envido_closed_after_own_first_card_and_after_first_baza() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0, JUGAR0]);
    assert_eq!(s.legal_actions() & mask(&[ENVIDO]), 0);
}

#[test]
fn envido_only_once() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, NO_QUIERO]);
    assert_eq!(
        s.legal_actions() & mask(&[ENVIDO, REAL_ENVIDO, FALTA_ENVIDO]),
        0
    );
}

#[test]
fn mazo_after_envido_played_gives_only_truco_value() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[ENVIDO, NO_QUIERO, MAZO]);
    assert_eq!(
        s.points(),
        [1, 1],
        "envido rechazado: 1 para el 0; mazo: 1 para el 1, sin el extra"
    );
}

#[test]
fn envido_reaching_30_ends_hand_with_truco_pending() {
    let s = new_with("7E 6E 1C", "12O 11O 4B", 1, [28, 0]);
    let s = play(s, &[TRUCO, ENVIDO, QUIERO]);
    assert_eq!(s.score(0), 30);
    assert!(s.is_over());
    assert_eq!(s.legal_actions(), 0);
}

#[test]
fn no_mazo_or_card_while_call_pending() {
    let base = new("7E 6E 1C", "12O 11O 4B");
    for pending in [play(base, &[TRUCO]), play(base, &[ENVIDO])] {
        assert_eq!(
            pending.legal_actions() & mask(&[MAZO, JUGAR0, JUGAR1, JUGAR2]),
            0
        );
    }
}
