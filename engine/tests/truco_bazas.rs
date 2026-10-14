mod truco_common;
use truco_common::*;
use truco_engine::cards::Card;
use truco_engine::truco::*;

// Recordatorio: al repartir, cada mano se ordena de la más fuerte a la más débil y el orden
// queda fijo. JUGAR0 = la carta que quedó primera, JUGAR2 = la tercera. Un slot jugado no se repite.

#[test]
fn hand_is_sorted_strongest_first() {
    let s = new("4C 1E 5O", "12C 11C 10C");
    assert_eq!(s.hand(0), hand("1E 5O 4C"));
}

#[test]
fn equal_rank_cards_sort_by_id() {
    let a = new("3O 3E 4C", "12C 11C 10C");
    let b = new("3E 3O 4C", "12C 11C 10C");
    assert_eq!(a.hand(0), b.hand(0));
    assert_eq!(a.hand(0)[0], Card::parse("3E").unwrap(), "a igual jerarquía, primero el id menor (espada)");
}

#[test]
fn mano_wins_first_two_bazas() {
    let s = new("1E 7E 4C", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1]); // 1E>3C, 7E>2C
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn baza_winner_leads_next() {
    let s = new("4C 5C 6C", "1E 7E 3O");
    let s = play(s, &[JUGAR0, JUGAR0]);
    assert_eq!(s.baza_results()[0], Some(BazaResult::Won(1)));
    assert_eq!(s.turn(), 1);
    assert_eq!(s.baza(), 1);
}

#[test]
fn parda_first_then_second_decides() {
    let s = new("3E 4C 5C", "3O 1E 6B");
    let s = play(s, &[JUGAR0, JUGAR1]); // 3E contra 3O: parda
    assert_eq!(s.baza_results()[0], Some(BazaResult::Parda));
    assert_eq!(s.turn(), 0, "después de parda empieza el mano");
    let s = play(s, &[JUGAR1, JUGAR0]); // 5C contra 1E
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 1]);
}

#[test]
fn split_first_two_third_decides() {
    let s = new("1E 4C 7O", "3C 2C 6O");
    let s = play(s, &[JUGAR0, JUGAR2]); // 1E le gana al 6O
    let s = play(s, &[JUGAR2, JUGAR0]); // 4C pierde con 3C
    assert!(!s.is_over());
    assert_eq!(s.turn(), 1);
    let s = play(s, &[JUGAR1, JUGAR1]); // 2C contra 7O: gana 7O
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn first_won_then_parda_first_winner_takes_it() {
    let s = new("1E 2O 4C", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR0]); // 1E le gana al 3C
    let s = play(s, &[JUGAR1, JUGAR1]); // 2O contra 2C: parda
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn won_lost_parda_first_winner_takes_it() {
    let s = new("1E 4C 2O", "3C 2C 5O");
    let s = play(s, &[JUGAR0, JUGAR2]); // 1E le gana al 5O
    let s = play(s, &[JUGAR2, JUGAR0]); // 4C pierde con 3C
    let s = play(s, &[JUGAR1, JUGAR1]); // 2C contra 2O: parda
    assert!(s.is_over());
    assert_eq!(s.points(), [1, 0]);
}

#[test]
fn three_pardas_mano_wins() {
    let s = new_with("3E 2E 4E", "3O 2O 4O", 1, [0, 0]);
    let s = play(s, &[JUGAR0, JUGAR0, JUGAR1, JUGAR1, JUGAR2, JUGAR2]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 1], "el mano (jugador 1) gana con tres pardas");
}

#[test]
fn mazo_in_first_baza_without_envido_gives_two() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[MAZO]);
    assert!(s.is_over());
    assert_eq!(s.points(), [0, 2]);
}

#[test]
fn mazo_in_second_baza_gives_one() {
    let s = play(new("1E 7E 4C", "3C 2C 5O"), &[JUGAR0, JUGAR0, MAZO]);
    assert_eq!(s.points(), [0, 1]);
}

#[test]
fn points_capped_at_30() {
    let s = new_with("1E 7E 4C", "3C 2C 5O", 0, [0, 29]);
    let s = play(s, &[MAZO]); // el mazo en primera vale 2, pero al jugador 1 le falta 1
    assert_eq!(s.points(), [0, 1]);
    assert_eq!(s.score(1), 30);
    assert!(s.is_over());
}
