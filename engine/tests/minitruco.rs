use truco_engine::cfr::TabularCfr;
use truco_engine::exact::exploitability;
use truco_engine::game::{bit, ExactGame, Game, Node, Player};
use truco_engine::minitruco::MiniTruco;

const JUGAR: usize = 0;
const TRUCO: usize = 6;
const RETRUCO: usize = 7;
const VALE_CUATRO: usize = 8;
const QUIERO: usize = 9;
const NO_QUIERO: usize = 10;
const MAZO: usize = 11;

fn dealt(c0: u8, c1: u8) -> MiniTruco {
    MiniTruco::root()
        .chance_outcomes()
        .into_iter()
        .map(|(s, _)| s)
        .find(|s| s.cards() == Some([c0, c1]))
        .unwrap()
}

fn play(mut s: MiniTruco, actions: &[usize]) -> MiniTruco {
    for &a in actions {
        assert!(s.legal_actions() & bit(a) != 0, "acción {a} ilegal");
        s.apply(a);
    }
    s
}

#[test]
fn thirty_deals() {
    assert_eq!(MiniTruco::root().chance_outcomes().len(), 30);
}

#[test]
fn plain_play_higher_card_wins_one() {
    let s = play(dealt(5, 2), &[JUGAR, JUGAR]);
    assert_eq!(s.node(), Node::Terminal);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn truco_chain() {
    let s = play(
        dealt(1, 4),
        &[TRUCO, RETRUCO, VALE_CUATRO, QUIERO, JUGAR, JUGAR],
    );
    assert_eq!(s.returns(), [-4.0, 4.0]);
    let s = play(dealt(1, 4), &[TRUCO, RETRUCO, NO_QUIERO]);
    assert_eq!(
        s.returns(),
        [-2.0, 2.0],
        "rechazar el retruco paga el truco aceptado"
    );
    let s = play(dealt(1, 4), &[TRUCO, NO_QUIERO]);
    assert_eq!(s.returns(), [1.0, -1.0]);
}

#[test]
fn only_holder_can_raise() {
    let s = play(dealt(0, 1), &[TRUCO, QUIERO]);
    assert_eq!(s.node(), Node::Decision(0));
    assert_eq!(
        s.legal_actions(),
        bit(JUGAR) | bit(MAZO),
        "el que cantó no puede subir"
    );
    let s = play(s, &[JUGAR]);
    assert_eq!(
        s.legal_actions() & bit(RETRUCO),
        bit(RETRUCO),
        "el que dijo quiero sí puede"
    );
}

#[test]
fn mazo_pays_current_level() {
    let s = play(dealt(0, 1), &[TRUCO, QUIERO, MAZO]);
    assert_eq!(s.returns(), [-2.0, 2.0]);
}

#[test]
fn cfr_converges_on_minitruco() {
    let mut cfr = TabularCfr::<MiniTruco>::new();
    cfr.run(300);
    let early = exploitability::<MiniTruco>(&|s: &MiniTruco, p: Player| cfr.average_strategy(s, p));
    cfr.run(2700);
    let late = exploitability::<MiniTruco>(&|s: &MiniTruco, p: Player| cfr.average_strategy(s, p));
    assert!(late < 0.05, "explotabilidad final {late}");
    assert!(late < early / 2.0, "early={early} late={late}");
}

#[test]
fn legal_actions_empty_outside_decision_nodes() {
    assert_eq!(MiniTruco::root().legal_actions(), 0, "nodo de azar");
    let terminal = play(dealt(5, 2), &[JUGAR, JUGAR]);
    assert_eq!(terminal.node(), Node::Terminal);
    assert_eq!(terminal.legal_actions(), 0, "nodo terminal");
    assert_ne!(dealt(5, 2).legal_actions(), 0, "nodo de decisión");
}
