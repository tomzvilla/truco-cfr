//! Evaluación exacta de estrategias en juegos chicos: valor esperado, mejor respuesta y explotabilidad.
use crate::game::{actions_of, Action, ExactGame, Node, Player};
use std::collections::HashMap;

pub type Policy<'a, G> = &'a dyn Fn(&G, Player) -> Vec<f64>;

/// Conjuntos de información de un jugador: clave -> (profundidad, estados con su probabilidad de llegada).
type Infosets<G> = HashMap<u64, (usize, Vec<(G, f64)>)>;

/// Valor esperado de cada jugador si ambos juegan con `policy`.
pub fn expected_values<G: ExactGame>(policy: Policy<G>) -> [f64; 2] {
    ev(&G::root(), policy)
}

fn ev<G: ExactGame>(s: &G, policy: Policy<G>) -> [f64; 2] {
    match s.node() {
        Node::Terminal => {
            let r = s.returns();
            [r[0] as f64, r[1] as f64]
        }
        Node::Chance => s.chance_outcomes().iter().fold([0.0; 2], |acc, (c, p)| {
            let v = ev(c, policy);
            [acc[0] + p * v[0], acc[1] + p * v[1]]
        }),
        Node::Decision(q) => {
            let strat = policy(s, q);
            actions_of(s.legal_actions()).fold([0.0; 2], |acc, a| {
                let mut child = s.clone();
                child.apply(a);
                let v = ev(&child, policy);
                [acc[0] + strat[a] * v[0], acc[1] + strat[a] * v[1]]
            })
        }
    }
}

/// Explotabilidad = promedio de lo que gana la mejor respuesta de cada jugador contra `policy`.
/// Es 0 en un equilibrio de Nash.
pub fn exploitability<G: ExactGame>(policy: Policy<G>) -> f64 {
    (best_response_value::<G>(policy, 0) + best_response_value::<G>(policy, 1)) / 2.0
}

/// Valor que obtiene el jugador `br` jugando la mejor respuesta contra `policy`.
/// Las decisiones de `br` se fijan por conjunto de información, de los más profundos a los más superficiales.
pub fn best_response_value<G: ExactGame>(policy: Policy<G>, br: Player) -> f64 {
    let mut infosets: Infosets<G> = HashMap::new();
    collect(&G::root(), br, policy, 1.0, 0, &mut infosets);

    let mut order: Vec<u64> = infosets.keys().copied().collect();
    order.sort_by_key(|k| std::cmp::Reverse(infosets[k].0));

    let mut choice: HashMap<u64, Action> = HashMap::new();
    for key in order {
        let states = &infosets[&key].1;
        let mask = states[0].0.legal_actions();
        let mut best: Option<(Action, f64)> = None;
        for a in actions_of(mask) {
            let v: f64 = states
                .iter()
                .map(|(s, reach)| {
                    let mut child = s.clone();
                    child.apply(a);
                    reach * br_value(&child, br, policy, &choice)
                })
                .sum();
            if best.is_none_or(|(_, bv)| v > bv) {
                best = Some((a, v));
            }
        }
        choice.insert(key, best.expect("conjunto de información sin acciones").0);
    }
    br_value(&G::root(), br, policy, &choice)
}

/// Junta, para cada conjunto de información de `br`, sus estados y la probabilidad de llegar
/// (por azar y por el rival). `depth` = cantidad de decisiones previas de `br`.
fn collect<G: ExactGame>(
    s: &G,
    br: Player,
    policy: Policy<G>,
    reach: f64,
    depth: usize,
    out: &mut Infosets<G>,
) {
    match s.node() {
        Node::Terminal => {}
        Node::Chance => {
            for (c, p) in s.chance_outcomes() {
                collect(&c, br, policy, reach * p, depth, out);
            }
        }
        Node::Decision(q) if q == br => {
            out.entry(s.infoset_key(br))
                .or_insert_with(|| (depth, Vec::new()))
                .1
                .push((s.clone(), reach));
            for a in actions_of(s.legal_actions()) {
                let mut child = s.clone();
                child.apply(a);
                collect(&child, br, policy, reach, depth + 1, out);
            }
        }
        Node::Decision(q) => {
            let strat = policy(s, q);
            for a in actions_of(s.legal_actions()) {
                let mut child = s.clone();
                child.apply(a);
                collect(&child, br, policy, reach * strat[a], depth, out);
            }
        }
    }
}

fn br_value<G: ExactGame>(
    s: &G,
    br: Player,
    policy: Policy<G>,
    choice: &HashMap<u64, Action>,
) -> f64 {
    match s.node() {
        Node::Terminal => s.returns()[br] as f64,
        Node::Chance => s
            .chance_outcomes()
            .iter()
            .map(|(c, p)| p * br_value(c, br, policy, choice))
            .sum(),
        Node::Decision(q) if q == br => {
            let a = *choice
                .get(&s.infoset_key(br))
                .expect("decisión de mejor respuesta todavía no fijada (¿falta perfect recall?)");
            let mut child = s.clone();
            child.apply(a);
            br_value(&child, br, policy, choice)
        }
        Node::Decision(q) => {
            let strat = policy(s, q);
            actions_of(s.legal_actions())
                .map(|a| {
                    let mut child = s.clone();
                    child.apply(a);
                    strat[a] * br_value(&child, br, policy, choice)
                })
                .sum()
        }
    }
}
