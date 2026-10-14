//! CFR "vainilla" con tablas, para juegos chicos (ExactGame). Actualizaciones alternadas.
use crate::game::{actions_of, ActionMask, ExactGame, Node, Player};
use std::collections::HashMap;
use std::marker::PhantomData;

pub struct TabularCfr<G: ExactGame> {
    regrets: HashMap<u64, Vec<f64>>,
    strategy_sum: HashMap<u64, Vec<f64>>,
    iterations: u64,
    _game: PhantomData<G>,
}

impl<G: ExactGame> Default for TabularCfr<G> {
    fn default() -> Self {
        Self::new()
    }
}

impl<G: ExactGame> TabularCfr<G> {
    pub fn new() -> Self {
        TabularCfr {
            regrets: HashMap::new(),
            strategy_sum: HashMap::new(),
            iterations: 0,
            _game: PhantomData,
        }
    }

    pub fn iterations(&self) -> u64 {
        self.iterations
    }

    pub fn run(&mut self, iterations: u64) {
        for _ in 0..iterations {
            for p in 0..2 {
                self.cfr(&G::root(), p, 1.0, 1.0, 1.0);
            }
            self.iterations += 1;
        }
    }

    /// Devuelve el valor esperado del nodo para el jugador `p`.
    /// `pi_p`, `pi_o`, `pi_c`: probabilidad de llegar acá por las jugadas de p, del rival y del azar.
    fn cfr(&mut self, s: &G, p: Player, pi_p: f64, pi_o: f64, pi_c: f64) -> f64 {
        match s.node() {
            Node::Terminal => s.returns()[p] as f64,
            Node::Chance => s
                .chance_outcomes()
                .into_iter()
                .map(|(c, prob)| prob * self.cfr(&c, p, pi_p, pi_o, pi_c * prob))
                .sum(),
            Node::Decision(q) => {
                let mask = s.legal_actions();
                let key = s.infoset_key(q);
                let strat = self.current_strategy(key, mask);
                let mut values = vec![0.0; G::NUM_ACTIONS];
                let mut node_value = 0.0;
                for a in actions_of(mask) {
                    let mut child = s.clone();
                    child.apply(a);
                    values[a] = if q == p {
                        self.cfr(&child, p, pi_p * strat[a], pi_o, pi_c)
                    } else {
                        self.cfr(&child, p, pi_p, pi_o * strat[a], pi_c)
                    };
                    node_value += strat[a] * values[a];
                }
                if q == p {
                    let r = self
                        .regrets
                        .entry(key)
                        .or_insert_with(|| vec![0.0; G::NUM_ACTIONS]);
                    for a in actions_of(mask) {
                        r[a] += pi_o * pi_c * (values[a] - node_value);
                    }
                    let ss = self
                        .strategy_sum
                        .entry(key)
                        .or_insert_with(|| vec![0.0; G::NUM_ACTIONS]);
                    for a in actions_of(mask) {
                        ss[a] += pi_p * strat[a];
                    }
                }
                node_value
            }
        }
    }

    /// Regret matching: proporcional al arrepentimiento positivo; uniforme si no hay ninguno.
    fn current_strategy(&self, key: u64, mask: ActionMask) -> Vec<f64> {
        let mut strat = vec![0.0; G::NUM_ACTIONS];
        if let Some(r) = self.regrets.get(&key) {
            let total: f64 = actions_of(mask).map(|a| r[a].max(0.0)).sum();
            if total > 0.0 {
                for a in actions_of(mask) {
                    strat[a] = r[a].max(0.0) / total;
                }
                return strat;
            }
        }
        uniform(mask, G::NUM_ACTIONS)
    }

    /// Estrategia promedio: la que converge al equilibrio.
    pub fn average_strategy(&self, s: &G, p: Player) -> Vec<f64> {
        let mask = s.legal_actions();
        if let Some(ss) = self.strategy_sum.get(&s.infoset_key(p)) {
            let total: f64 = actions_of(mask).map(|a| ss[a]).sum();
            if total > 0.0 {
                let mut out = vec![0.0; G::NUM_ACTIONS];
                for a in actions_of(mask) {
                    out[a] = ss[a] / total;
                }
                return out;
            }
        }
        uniform(mask, G::NUM_ACTIONS)
    }
}

fn uniform(mask: ActionMask, n: usize) -> Vec<f64> {
    let count = actions_of(mask).count() as f64;
    let mut out = vec![0.0; n];
    for a in actions_of(mask) {
        out[a] = 1.0 / count;
    }
    out
}
