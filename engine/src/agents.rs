//! Agentes que juegan al truco a partir de una Observation.
use crate::cards::Card;
use crate::game::{actions_of, bit, Action};
use crate::truco::*;
use rand::{Rng, RngCore};

pub trait Agent: Send {
    fn name(&self) -> String;
    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action;
}

/// Elige cualquier jugada legal con la misma probabilidad.
pub struct RandomAgent;

impl Agent for RandomAgent {
    fn name(&self) -> String {
        "random".into()
    }

    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action {
        let acts: Vec<Action> = actions_of(obs.legal).collect();
        assert!(!acts.is_empty(), "le pidieron jugar sin acciones legales");
        acts[rng.gen_range(0..acts.len())]
    }
}

/// Carta alta = un 3 o mejor.
pub fn is_high(card: Card) -> bool {
    card.rank() >= 10
}

/// Jugador de reglas fijas (ver spec, sección 3.3, y las precisiones del Plan 1).
pub struct HeuristicAgent;

impl HeuristicAgent {
    fn high_unplayed(o: &Observation) -> usize {
        (0..3)
            .filter(|&slot| !o.my_played.contains(&Some(slot)) && is_high(o.hand[slot]))
            .count()
    }

    fn play_card(o: &Observation) -> Action {
        // Slots sin jugar, de la carta más fuerte a la más débil.
        let unplayed: Vec<usize> = (0..3).filter(|&s| o.legal & bit(JUGAR0 + s) != 0).collect();
        let weakest = *unplayed.last().expect("sin cartas para jugar");
        if let Some(opp) = o.opp_played[o.baza] {
            return match unplayed
                .iter()
                .rev()
                .find(|&&s| o.hand[s].rank() > opp.rank())
            {
                Some(&s) => JUGAR0 + s,
                None => JUGAR0 + weakest,
            };
        }
        if o.baza == 0 {
            JUGAR0 + weakest
        } else {
            JUGAR0 + unplayed[0]
        }
    }
}

impl Agent for HeuristicAgent {
    fn name(&self) -> String {
        "heuristic".into()
    }

    fn act(&mut self, o: &Observation, _rng: &mut dyn RngCore) -> Action {
        let can = |a: Action| o.legal & bit(a) != 0;
        let envido_call = |t: u8| if t >= 30 { REAL_ENVIDO } else { ENVIDO };

        if o.envido_status == EnvidoStatus::Pending {
            return if o.my_tantos >= 26 { QUIERO } else { NO_QUIERO };
        }
        if o.truco_pending.is_some() {
            if can(ENVIDO) && o.my_tantos >= 27 {
                return envido_call(o.my_tantos);
            }
            return if Self::high_unplayed(o) >= 1 {
                QUIERO
            } else {
                NO_QUIERO
            };
        }
        if can(ENVIDO) && o.my_tantos >= 27 {
            return envido_call(o.my_tantos);
        }
        for a in [TRUCO, RETRUCO, VALE_CUATRO] {
            if can(a) && Self::high_unplayed(o) >= 2 {
                return a;
            }
        }
        Self::play_card(o)
    }
}
