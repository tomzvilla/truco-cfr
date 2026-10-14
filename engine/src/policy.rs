//! Política compartida por el entrenamiento (Deep CFR), `MlpAgent` y, más adelante, el WASM.
//! Todo lo que convierte la salida de una red en probabilidades vive acá, para que el
//! entrenamiento y la web jueguen exactamente igual.
use crate::game::{actions_of, Action, ActionMask};
use crate::mlp::Mlp;
use rand::{Rng, RngCore};

/// Cantidad máxima de acciones de cualquier juego (el truco usa las 12).
pub const MAX_ACTIONS: usize = 12;

/// Probabilidad de cada acción; las acciones ilegales valen 0.
pub type Probs = [f32; MAX_ACTIONS];

/// De dónde sale la política a partir de la salida de la red.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PolicyKind {
    /// La red predice ventajas (arrepentimientos): se juega con regret matching.
    Advantage,
    /// La red predice logits de la estrategia promedio: se juega con softmax.
    Strategy,
}

/// Uniforme sobre las acciones legales.
pub fn uniform(mask: ActionMask) -> Probs {
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    let n = actions_of(mask).count() as f32;
    let mut out = [0.0; MAX_ACTIONS];
    for a in actions_of(mask) {
        out[a] = 1.0 / n;
    }
    out
}

fn check(len: usize, mask: ActionMask) {
    assert!(len <= MAX_ACTIONS, "demasiadas acciones: {len}");
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    assert_eq!(
        (mask as u32) >> len,
        0,
        "la máscara {mask:#b} tiene acciones fuera de las {len} de la red"
    );
}

/// Regret matching sobre las acciones legales: proporcional a la parte positiva de la ventaja.
/// Si ninguna ventaja es positiva, toda la probabilidad va a la acción legal con mayor ventaja
/// (como en Brown et al., 2019).
pub fn regret_matching(adv: &[f32], mask: ActionMask) -> Probs {
    check(adv.len(), mask);
    let mut out = [0.0; MAX_ACTIONS];
    let total: f32 = actions_of(mask).map(|a| adv[a].max(0.0)).sum();
    if total > 0.0 && total.is_finite() {
        for a in actions_of(mask) {
            out[a] = adv[a].max(0.0) / total;
        }
        return out;
    }
    let mut best: Option<Action> = None;
    for a in actions_of(mask) {
        if adv[a].is_finite() && best.is_none_or(|b| adv[a] > adv[b]) {
            best = Some(a);
        }
    }
    match best {
        Some(a) => out[a] = 1.0,
        None => return uniform(mask),
    }
    out
}

/// Softmax sobre las acciones legales (numéricamente estable).
pub fn masked_softmax(logits: &[f32], mask: ActionMask) -> Probs {
    check(logits.len(), mask);
    let max = actions_of(mask)
        .map(|a| logits[a])
        .filter(|x| x.is_finite())
        .fold(f32::NEG_INFINITY, f32::max);
    if max == f32::NEG_INFINITY {
        return uniform(mask);
    }
    let mut out = [0.0; MAX_ACTIONS];
    let mut total = 0.0;
    for a in actions_of(mask) {
        out[a] = if logits[a].is_finite() {
            (logits[a] - max).exp()
        } else {
            0.0
        };
        total += out[a];
    }
    for a in actions_of(mask) {
        out[a] /= total;
    }
    out
}

/// Política de una red sobre una codificación. Sin red (`None`) es uniforme: así arranca la
/// iteración 1 de Deep CFR, cuando todavía no hay ventajas.
pub fn policy_probs(net: Option<&Mlp>, kind: PolicyKind, enc: &[u8], mask: ActionMask) -> Probs {
    let Some(net) = net else {
        return uniform(mask);
    };
    let n = net.output_size();
    assert!(
        n <= MAX_ACTIONS,
        "la red tiene {n} salidas (máximo {MAX_ACTIONS})"
    );
    let mut raw = [0.0f32; MAX_ACTIONS];
    net.forward(enc, &mut raw[..n]);
    match kind {
        PolicyKind::Advantage => regret_matching(&raw[..n], mask),
        PolicyKind::Strategy => masked_softmax(&raw[..n], mask),
    }
}

/// Elige una acción legal según `probs`.
pub fn sample_action(probs: &Probs, mask: ActionMask, rng: &mut dyn RngCore) -> Action {
    assert_ne!(mask, 0, "máscara vacía: no hay acciones legales");
    let r: f32 = rng.gen();
    let mut acc = 0.0;
    let mut last = 0;
    for a in actions_of(mask) {
        acc += probs[a];
        last = a;
        if r < acc {
            return a;
        }
    }
    // El error de redondeo puede dejar `acc` apenas debajo de 1: la última acción legal.
    last
}
