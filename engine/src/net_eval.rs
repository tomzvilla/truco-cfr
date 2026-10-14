//! Explotabilidad exacta de una política definida por redes, en los juegos chicos.
use crate::exact::exploitability;
use crate::game::{ExactGame, Player};
use crate::mlp::Mlp;
use crate::policy::{policy_probs, PolicyKind};

/// Explotabilidad exacta cuando el jugador `p` juega con `nets[p]` (según `kind`).
/// Para una red de estrategia promedio compartida, pasar la misma red dos veces.
pub fn net_exploitability<G: ExactGame>(nets: [&Mlp; 2], kind: PolicyKind) -> f64 {
    let policy = |s: &G, p: Player| -> Vec<f64> {
        let mut enc = vec![0u8; G::ENCODING_SIZE];
        s.encode(p, &mut enc);
        let probs = policy_probs(Some(nets[p]), kind, &enc, s.legal_actions());
        probs[..G::NUM_ACTIONS].iter().map(|&x| x as f64).collect()
    };
    exploitability::<G>(&policy)
}
