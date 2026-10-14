//! Recorrido de Deep CFR con muestreo externo (external sampling), genérico sobre `Game`.
//! Un solo hilo y determinista: el resultado depende solo de las redes, la semilla y los
//! índices de recorrido. El paralelismo (rayon) vive en `engine-py`.
use crate::game::{actions_of, Game, Node, Player};
use crate::mlp::Mlp;
use crate::policy::{policy_probs, sample_action, PolicyKind, MAX_ACTIONS};
use rand::rngs::SmallRng;
use rand::SeedableRng;

/// Muestras en columnas: `enc` (n × `ENCODING_SIZE` bytes), `values` (n × `width` floats:
/// arrepentimientos o probabilidades) y `masks` (n máscaras de acciones legales).
#[derive(Clone, Debug, Default)]
pub struct SampleBlock {
    pub width: usize,
    pub enc: Vec<u8>,
    pub values: Vec<f32>,
    pub masks: Vec<u16>,
}

impl SampleBlock {
    pub fn new(width: usize) -> SampleBlock {
        SampleBlock {
            width,
            ..SampleBlock::default()
        }
    }

    pub fn len(&self) -> usize {
        self.masks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.masks.is_empty()
    }

    pub fn push(&mut self, enc: &[u8], values: &[f32], mask: u16) {
        debug_assert_eq!(values.len(), self.width);
        self.enc.extend_from_slice(enc);
        self.values.extend_from_slice(values);
        self.masks.push(mask);
    }

    pub fn append(&mut self, other: SampleBlock) {
        debug_assert_eq!(self.width, other.width);
        self.enc.extend(other.enc);
        self.values.extend(other.values);
        self.masks.extend(other.masks);
    }
}

#[derive(Clone, Debug)]
pub struct TraversalOutput {
    /// Muestras de ventaja del jugador que recorre: (codificación, arrepentimientos, máscara).
    pub adv: SampleBlock,
    /// Muestras de estrategia de los nodos del rival: (codificación, probabilidades, máscara).
    pub strat: SampleBlock,
    /// Nodos de decisión visitados (para medir velocidad).
    pub nodes: u64,
}

impl TraversalOutput {
    pub fn new(width: usize) -> TraversalOutput {
        TraversalOutput {
            adv: SampleBlock::new(width),
            strat: SampleBlock::new(width),
            nodes: 0,
        }
    }

    pub fn append(&mut self, other: TraversalOutput) {
        self.adv.append(other.adv);
        self.strat.append(other.strat);
        self.nodes += other.nodes;
    }
}

struct Ctx<'a> {
    nets: [Option<&'a Mlp>; 2],
    traverser: Player,
    rng: SmallRng,
    out: TraversalOutput,
}

/// Corre los recorridos `first .. first + count`. Cada uno usa su propio RNG, derivado de
/// `seed` y de su índice, así que partir el trabajo en pedazos (o en hilos) no cambia el resultado.
/// `nets[p]` es la red de ventajas del jugador `p` (`None` = política uniforme).
pub fn run_traversals<G: Game>(
    nets: [Option<&Mlp>; 2],
    traverser: Player,
    seed: u64,
    first: u64,
    count: u64,
) -> TraversalOutput {
    assert!(traverser < 2, "jugador inválido: {traverser}");
    let mut total = TraversalOutput::new(G::NUM_ACTIONS);
    for i in first..first + count {
        let mut ctx = Ctx {
            nets,
            traverser,
            rng: SmallRng::seed_from_u64(seed.wrapping_add(i.wrapping_mul(0x9E37_79B9_7F4A_7C15))),
            out: TraversalOutput::new(G::NUM_ACTIONS),
        };
        recurse(&mut ctx, &G::root());
        total.append(ctx.out);
    }
    total
}

fn recurse<G: Game>(ctx: &mut Ctx, s: &G) -> f32 {
    match s.node() {
        Node::Terminal => s.returns()[ctx.traverser],
        Node::Chance => {
            let next = s.sample_chance(&mut ctx.rng);
            recurse(ctx, &next)
        }
        Node::Decision(q) => {
            ctx.out.nodes += 1;
            let mask = s.legal_actions();
            let mut enc = vec![0u8; G::ENCODING_SIZE];
            s.encode(q, &mut enc);
            let probs = policy_probs(ctx.nets[q], PolicyKind::Advantage, &enc, mask);
            if q == ctx.traverser {
                let mut values = [0.0f32; MAX_ACTIONS];
                let mut node_value = 0.0;
                for a in actions_of(mask) {
                    let mut child = s.clone();
                    child.apply(a);
                    values[a] = recurse(ctx, &child);
                    node_value += probs[a] * values[a];
                }
                let mut regrets = [0.0f32; MAX_ACTIONS];
                for a in actions_of(mask) {
                    regrets[a] = values[a] - node_value;
                }
                ctx.out.adv.push(&enc, &regrets[..G::NUM_ACTIONS], mask);
                node_value
            } else {
                ctx.out.strat.push(&enc, &probs[..G::NUM_ACTIONS], mask);
                let a = sample_action(&probs, mask, &mut ctx.rng);
                let mut child = s.clone();
                child.apply(a);
                recurse(ctx, &child)
            }
        }
    }
}
