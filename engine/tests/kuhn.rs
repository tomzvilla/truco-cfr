use truco_engine::game::{ExactGame, Game, Node};
use truco_engine::kuhn::Kuhn;

fn dealt(c0: u8, c1: u8) -> Kuhn {
    Kuhn::root()
        .chance_outcomes()
        .into_iter()
        .map(|(s, _)| s)
        .find(|s| {
            let mut a = [0u8; 9];
            let mut b = [0u8; 9];
            s.encode(0, &mut a);
            s.encode(1, &mut b);
            a[c0 as usize] == 1 && b[c1 as usize] == 1
        })
        .unwrap()
}

fn play(mut s: Kuhn, actions: &[usize]) -> Kuhn {
    for &a in actions {
        s.apply(a);
    }
    s
}

#[test]
fn root_is_chance_with_six_deals() {
    assert_eq!(Kuhn::root().node(), Node::Chance);
    let outs = Kuhn::root().chance_outcomes();
    assert_eq!(outs.len(), 6);
    let total: f64 = outs.iter().map(|(_, p)| p).sum();
    assert!((total - 1.0).abs() < 1e-12);
}

#[test]
fn payoffs() {
    // cartas: 0 = J, 1 = Q, 2 = K
    assert_eq!(play(dealt(2, 0), &[Kuhn::PASS, Kuhn::PASS]).returns(), [1.0, -1.0]);
    assert_eq!(play(dealt(0, 2), &[Kuhn::BET, Kuhn::PASS]).returns(), [1.0, -1.0]);
    assert_eq!(play(dealt(0, 2), &[Kuhn::BET, Kuhn::BET]).returns(), [-2.0, 2.0]);
    assert_eq!(play(dealt(2, 0), &[Kuhn::PASS, Kuhn::BET, Kuhn::PASS]).returns(), [-1.0, 1.0]);
    assert_eq!(play(dealt(2, 1), &[Kuhn::PASS, Kuhn::BET, Kuhn::BET]).returns(), [2.0, -2.0]);
}

#[test]
fn turns_and_terminal() {
    let s = dealt(1, 2);
    assert_eq!(s.node(), Node::Decision(0));
    let s = play(s, &[Kuhn::PASS]);
    assert_eq!(s.node(), Node::Decision(1));
    let s = play(s, &[Kuhn::BET]);
    assert_eq!(s.node(), Node::Decision(0));
    let s = play(s, &[Kuhn::PASS]);
    assert_eq!(s.node(), Node::Terminal);
}

#[test]
fn infoset_keys_hide_opponent_card() {
    assert_eq!(dealt(1, 0).infoset_key(0), dealt(1, 2).infoset_key(0));
    assert_ne!(dealt(1, 0).infoset_key(0), dealt(2, 0).infoset_key(0));
    let a = play(dealt(1, 0), &[Kuhn::PASS]);
    let b = play(dealt(2, 0), &[Kuhn::PASS]);
    assert_eq!(a.infoset_key(1), b.infoset_key(1));
}
