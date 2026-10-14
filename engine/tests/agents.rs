mod truco_common;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_common::*;
use truco_engine::agents::{Agent, HeuristicAgent, RandomAgent};
use truco_engine::truco::*;

fn heur(s: &TrucoState) -> usize {
    let mut rng = SmallRng::seed_from_u64(0);
    HeuristicAgent.act(&s.observation(s.turn()), &mut rng)
}

#[test]
fn heuristic_envido_thresholds() {
    assert_eq!(heur(&new("7E 6E 1C", "12O 11O 4B")), REAL_ENVIDO, "33 tantos");
    assert_eq!(heur(&new("7E 1E 4C", "12O 11O 4B")), ENVIDO, "28 tantos");
    let pending = play(new("12O 11O 4B", "6E 1E 4C"), &[ENVIDO]);
    assert_eq!(heur(&pending), QUIERO, "27 >= 26");
    let pending = play(new("12O 11O 4B", "5E 1E 4C"), &[ENVIDO]);
    assert_eq!(heur(&pending), QUIERO, "26 >= 26");
    let pending = play(new("12O 11O 4B", "4E 1E 5C"), &[ENVIDO]);
    assert_eq!(heur(&pending), NO_QUIERO, "25 < 26");
}

#[test]
fn heuristic_truco_with_two_high_cards() {
    // Palos distintos: 3 de tantos, no canta envido. Dos cartas altas (1E, 3O): canta truco.
    let s = new("1E 3O 12C", "4C 5B 6O");
    assert_eq!(heur(&s), TRUCO);
}

#[test]
fn heuristic_answers_truco() {
    let s = play(new("4C 5B 6O", "1E 11O 12C"), &[TRUCO]);
    assert_eq!(heur(&s), QUIERO, "tiene una carta alta");
    let s = play(new("1E 7E 3C", "4C 5B 12O"), &[TRUCO]);
    assert_eq!(heur(&s), NO_QUIERO);
}

#[test]
fn heuristic_plays_lowest_winning_card() {
    // El pie tiene una sola carta alta (7O) y 7 de tantos: no canta nada, juega.
    let s = play(new("12C 11B 4E", "7O 2B 4C"), &[JUGAR0]); // el mano tiró el 12C
    assert_eq!(heur(&s), JUGAR1, "2B es la más baja que le gana al 12C");
    let s = play(new("1E 12C 11B", "3E 2O 4C"), &[JUGAR0]); // tiró el 1E
    assert_eq!(heur(&s), JUGAR2, "si no puede ganar, tira la más baja");
}

#[test]
fn heuristic_leads_lowest_in_first_baza() {
    let s = new("1E 12C 4C", "3E 2O 5C");
    assert_eq!(heur(&s), JUGAR2);
}

#[test]
fn random_agent_only_plays_legal() {
    let mut rng = SmallRng::seed_from_u64(3);
    let s = play(new("7E 6E 1C", "12O 11O 4B"), &[TRUCO]);
    for _ in 0..200 {
        let a = RandomAgent.act(&s.observation(1), &mut rng);
        assert_ne!(s.legal_actions() & (1 << a), 0);
    }
}
