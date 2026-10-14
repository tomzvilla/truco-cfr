use truco_eval::highlights::{find, select};
use truco_eval::logs::{HandLog, MatchLog};
use truco_eval::strength::StrengthTable;

fn hand(bot: [&str; 3], rival: [&str; 3], actions: &[(usize, &str)], points: [u8; 2]) -> HandLog {
    HandLog {
        mano: 0,
        start_scores: [0, 0],
        hands: [bot.map(String::from), rival.map(String::from)],
        actions: actions.iter().map(|&(p, a)| (p, a.to_string())).collect(),
        points,
    }
}

fn one_match(h: HandLog) -> Vec<MatchLog> {
    vec![MatchLog {
        pair: 0,
        bot_seat: 0,
        winner: 0,
        final_scores: [30, 0],
        hands: vec![h],
    }]
}

#[test]
fn finds_a_successful_truco_bluff_and_ignores_honest_calls() {
    let table = StrengthTable::build(50, 1, 8);
    // El bot (asiento 0) canta truco con 4-4-5 y el rival no quiere.
    let bluff = hand(
        ["5E", "4B", "4O"],
        ["1E", "1B", "3C"],
        &[(0, "truco"), (1, "noQuiero")],
        [1, 0],
    );
    let found = find("heuristic", &one_match(bluff), &table);
    assert_eq!(found.len(), 1);
    let h = &found[0];
    assert_eq!(
        (h.kind.as_str(), h.call.as_str(), h.response.as_str()),
        ("truco", "truco", "noQuiero")
    );
    assert_eq!((h.call_index, h.points_won, h.bot_seat), (0, 1, 0));
    assert!(h.strength < 0.1);
    // Con 1E-1B-7E no es farol.
    let honest = hand(
        ["1E", "1B", "7E"],
        ["4E", "4C", "5O"],
        &[(0, "truco"), (1, "noQuiero")],
        [1, 0],
    );
    assert!(find("heuristic", &one_match(honest), &table).is_empty());
    // Si el rival quiere, no es un farol exitoso.
    let called = hand(
        ["5E", "4B", "4O"],
        ["1E", "1B", "3C"],
        &[(0, "truco"), (1, "quiero")],
        [0, 0],
    );
    assert!(find("heuristic", &one_match(called), &table).is_empty());
}

#[test]
fn finds_envido_bluffs_with_seven_or_less() {
    let table = StrengthTable::build(50, 1, 8);
    // 12E 4B 6O: tantos 6. Canta envido y el rival no quiere.
    let h = hand(
        ["12E", "4B", "6O"],
        ["1E", "1B", "3C"],
        &[(0, "envido"), (1, "noQuiero")],
        [1, 0],
    );
    let found = find("haiku", &one_match(h), &table);
    assert_eq!(found.len(), 1);
    assert_eq!((found[0].kind.as_str(), found[0].strength), ("envido", 6.0));
    assert_eq!(found[0].rival, "haiku");
}

#[test]
fn select_keeps_the_weakest_first() {
    let table = StrengthTable::build(50, 1, 8);
    let mut logs = Vec::new();
    for (bot, pts) in [
        (["5E", "4B", "4O"], 1),
        (["6E", "5B", "4C"], 2),
        (["7C", "6B", "5O"], 1),
    ] {
        logs.extend(one_match(hand(
            bot,
            ["1E", "1B", "3C"],
            &[(0, "truco"), (1, "noQuiero")],
            [pts, 0],
        )));
    }
    let found = find("heuristic", &logs, &table);
    let (truco, envido) = select(found, 2, 2);
    assert_eq!(truco.len(), 2);
    assert!(envido.is_empty());
    assert!(truco[0].strength <= truco[1].strength);
}
