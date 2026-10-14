//! Agente de truco que juega con redes entrenadas (la misma política que usará la web).
use crate::agents::Agent;
use crate::game::Action;
use crate::mlp::Mlp;
use crate::policy::{policy_probs, sample_action, PolicyKind, Probs};
use crate::truco::{encode, Observation, ENCODING_SIZE};
use rand::RngCore;
use std::sync::Arc;

pub struct MlpAgent {
    /// Una red por asiento (las redes de ventajas son una por jugador). Para la red de
    /// estrategia promedio, las dos son la misma.
    nets: [Arc<Mlp>; 2],
    kind: PolicyKind,
    label: String,
}

impl MlpAgent {
    pub fn new(nets: [Arc<Mlp>; 2], kind: PolicyKind, label: &str) -> MlpAgent {
        for net in &nets {
            assert_eq!(net.input_size(), ENCODING_SIZE, "la red no es de truco");
        }
        MlpAgent {
            nets,
            kind,
            label: label.to_string(),
        }
    }

    /// La misma red en los dos asientos.
    pub fn shared(net: Arc<Mlp>, kind: PolicyKind, label: &str) -> MlpAgent {
        MlpAgent::new([net.clone(), net], kind, label)
    }

    /// Probabilidad de cada acción en esta situación (para el "modo rayos X" de la web).
    pub fn probabilities(&self, obs: &Observation) -> Probs {
        let mut enc = [0u8; ENCODING_SIZE];
        encode(obs, &mut enc);
        policy_probs(Some(&self.nets[obs.me]), self.kind, &enc, obs.legal)
    }
}

impl Agent for MlpAgent {
    fn name(&self) -> String {
        self.label.clone()
    }

    fn act(&mut self, obs: &Observation, rng: &mut dyn RngCore) -> Action {
        sample_action(&self.probabilities(obs), obs.legal, rng)
    }
}
