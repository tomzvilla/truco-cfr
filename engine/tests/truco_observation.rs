mod truco_common;
use truco_common::*;
use truco_engine::truco::*;

#[test]
fn observation_basics() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[JUGAR0]);
    let o = s.observation(1);
    assert!(!o.is_mano);
    assert_eq!(o.opp_played[0], Some(s.hand(0)[0]));
    assert_eq!(o.my_tantos, 20);
    assert_ne!(o.legal, 0);
    assert_eq!(s.observation(0).legal, 0, "no es su turno");
    assert_eq!(s.observation(0).my_played[0], Some(0));
}

#[test]
fn observation_relative_fields() {
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    assert_eq!(s.observation(0).truco_pending, Some((2, true)));
    assert_eq!(s.observation(1).truco_pending, Some((2, false)));
    let s = play(s, &[ENVIDO]);
    assert_eq!(
        s.observation(1).envido_calls[0],
        Some((EnvidoKind::Envido, true))
    );
}

#[test]
fn encoding_does_not_leak_opponent_hand() {
    let a = new("7E 6E 1C", "12O 11O 4B");
    let b = new("7E 6E 1C", "3C 2C 5O");
    let (mut ea, mut eb) = ([0u8; ENCODING_SIZE], [0u8; ENCODING_SIZE]);
    encode(&a.observation(0), &mut ea);
    encode(&b.observation(0), &mut eb);
    assert_eq!(
        ea, eb,
        "la codificación del jugador 0 no puede depender de las cartas del rival"
    );
    let a = play(a, &[ENVIDO, NO_QUIERO]);
    let b = play(b, &[ENVIDO, NO_QUIERO]);
    encode(&a.observation(0), &mut ea);
    encode(&b.observation(0), &mut eb);
    assert_eq!(ea, eb, "un envido rechazado no revela nada");
}

#[test]
fn encoding_layout() {
    let s = play(new_with("7E 6E 1C", "12O 11O 4B", 0, [12, 20]), &[TRUCO]);
    let mut e = [0u8; ENCODING_SIZE];
    encode(&s.observation(1), &mut e);
    assert_eq!(
        e.iter().filter(|&&x| x > 1).count(),
        3,
        "solo tantos y puntajes superan 1"
    );
    assert!(e.contains(&20), "mi puntaje");
    assert!(e.contains(&12), "puntaje del rival");
    let scale = feature_scale();
    assert_eq!(scale.len(), ENCODING_SIZE);
    assert!(scale.iter().all(|&x| x > 0.0 && x <= 1.0));
}
