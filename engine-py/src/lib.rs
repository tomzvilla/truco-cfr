//! Puente Python <-> motor. Python solo ve bytes y números: las redes viajan como archivos
//! TCFRW1 en memoria y las muestras vuelven como bytes que `numpy.frombuffer` lee sin copiar.
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::PyBytes;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use rayon::prelude::*;
use std::sync::Arc;
use truco_engine::agents::{Agent, HeuristicAgent, RandomAgent};
use truco_engine::game::{bit, Game, Node};
use truco_engine::kuhn::Kuhn;
use truco_engine::match_runner::play_duplicate;
use truco_engine::minitruco::MiniTruco;
use truco_engine::mlp::Mlp;
use truco_engine::mlp_agent::MlpAgent;
use truco_engine::net_eval::net_exploitability;
use truco_engine::policy::PolicyKind;
use truco_engine::traversal::{run_traversals, TraversalOutput};
use truco_engine::truco::{TrucoGame, NUM_ACTIONS};

/// Ejecuta `$body` con `$G` = el juego pedido por nombre.
macro_rules! with_game {
    ($name:expr, $G:ident => $body:expr) => {
        match $name {
            "kuhn" => {
                type $G = Kuhn;
                $body
            }
            "minitruco" => {
                type $G = MiniTruco;
                $body
            }
            "truco" => {
                type $G = TrucoGame;
                $body
            }
            other => Err(PyValueError::new_err(format!(
                "juego desconocido: {other} (kuhn, minitruco o truco)"
            ))),
        }
    };
}

/// Igual, pero solo para los juegos chicos que se pueden recorrer enteros.
macro_rules! with_exact_game {
    ($name:expr, $G:ident => $body:expr) => {
        match $name {
            "kuhn" => {
                type $G = Kuhn;
                $body
            }
            "minitruco" => {
                type $G = MiniTruco;
                $body
            }
            other => Err(PyValueError::new_err(format!(
                "la explotabilidad exacta solo existe para kuhn y minitruco, no para {other}"
            ))),
        }
    };
}

fn parse_kind(mode: &str) -> PyResult<PolicyKind> {
    match mode {
        "advantage" => Ok(PolicyKind::Advantage),
        "strategy" => Ok(PolicyKind::Strategy),
        other => Err(PyValueError::new_err(format!(
            "modo desconocido: {other} (advantage o strategy)"
        ))),
    }
}

/// Lee una red TCFRW1 y verifica que encaje con el juego (entrada y salidas).
fn parse_net<G: Game>(bytes: &Bound<'_, PyBytes>, label: &str) -> PyResult<Mlp> {
    let net = Mlp::from_bytes(bytes.as_bytes())
        .map_err(|e| PyValueError::new_err(format!("{label}: {e}")))?;
    if net.input_size() != G::ENCODING_SIZE || net.output_size() != G::NUM_ACTIONS {
        return Err(PyValueError::new_err(format!(
            "{label}: la red es de {}→{} y el juego necesita {}→{}",
            net.input_size(),
            net.output_size(),
            G::ENCODING_SIZE,
            G::NUM_ACTIONS
        )));
    }
    Ok(net)
}

fn parse_optional_net<G: Game>(
    bytes: &Option<Bound<'_, PyBytes>>,
    label: &str,
) -> PyResult<Option<Mlp>> {
    bytes.as_ref().map(|b| parse_net::<G>(b, label)).transpose()
}

fn floats_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn masks_to_bytes(v: &[u16]) -> Vec<u8> {
    v.iter().flat_map(|m| m.to_le_bytes()).collect()
}

fn pool(threads: usize) -> PyResult<rayon::ThreadPool> {
    if threads == 0 {
        return Err(PyValueError::new_err("threads tiene que ser al menos 1"));
    }
    rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

/// (tamaño de la codificación, cantidad de acciones, factor de escala de cada byte de entrada)
#[pyfunction]
fn game_info(game: &str) -> PyResult<(usize, usize, Vec<f32>)> {
    with_game!(game, G => Ok((G::ENCODING_SIZE, G::NUM_ACTIONS, G::feature_scale())))
}

type Batch<'py> = (
    Bound<'py, PyBytes>, // adv_enc: n × ENCODING_SIZE u8
    Bound<'py, PyBytes>, // adv_regrets: n × NUM_ACTIONS f32 (little-endian)
    Bound<'py, PyBytes>, // adv_masks: n u16 (little-endian)
    Bound<'py, PyBytes>, // strat_enc
    Bound<'py, PyBytes>, // strat_probs
    Bound<'py, PyBytes>, // strat_masks
    u64,                 // nodos de decisión visitados
);

/// Corre los recorridos `first .. first + count` de Deep CFR para el jugador `traverser`,
/// repartidos en `threads` hilos. El resultado no depende de `threads`.
#[pyfunction]
#[pyo3(signature = (game, traverser, seed, first, count, net0=None, net1=None, threads=1))]
#[allow(clippy::too_many_arguments)]
fn traverse_batch<'py>(
    py: Python<'py>,
    game: &str,
    traverser: usize,
    seed: u64,
    first: u64,
    count: u64,
    net0: Option<Bound<'py, PyBytes>>,
    net1: Option<Bound<'py, PyBytes>>,
    threads: usize,
) -> PyResult<Batch<'py>> {
    if traverser > 1 {
        return Err(PyValueError::new_err("traverser tiene que ser 0 o 1"));
    }
    let out: TraversalOutput = with_game!(game, G => {
        let nets = [
            parse_optional_net::<G>(&net0, "net0")?,
            parse_optional_net::<G>(&net1, "net1")?,
        ];
        let pool = pool(threads)?;
        Ok(py.allow_threads(|| {
            const CHUNK: u64 = 32;
            let chunks: Vec<(u64, u64)> = (0..count.div_ceil(CHUNK))
                .map(|c| (first + c * CHUNK, CHUNK.min(count - c * CHUNK)))
                .collect();
            let parts: Vec<TraversalOutput> = pool.install(|| {
                chunks
                    .par_iter()
                    .map(|&(a, n)| {
                        run_traversals::<G>(
                            [nets[0].as_ref(), nets[1].as_ref()],
                            traverser,
                            seed,
                            a,
                            n,
                        )
                    })
                    .collect()
            });
            let mut total = TraversalOutput::new(G::NUM_ACTIONS);
            for p in parts {
                total.append(p);
            }
            total
        }))
    })?;
    Ok((
        PyBytes::new(py, &out.adv.enc),
        PyBytes::new(py, &floats_to_bytes(&out.adv.values)),
        PyBytes::new(py, &masks_to_bytes(&out.adv.masks)),
        PyBytes::new(py, &out.strat.enc),
        PyBytes::new(py, &floats_to_bytes(&out.strat.values)),
        PyBytes::new(py, &masks_to_bytes(&out.strat.masks)),
        out.nodes,
    ))
}

/// Explotabilidad exacta (Kuhn o MiniTruco) cuando cada jugador juega con su red.
/// `mode`: "advantage" (regret matching) o "strategy" (softmax). Sin `net1`, los dos usan `net0`.
#[pyfunction]
#[pyo3(signature = (game, mode, net0, net1=None))]
fn exploitability(
    game: &str,
    mode: &str,
    net0: Bound<'_, PyBytes>,
    net1: Option<Bound<'_, PyBytes>>,
) -> PyResult<f64> {
    let kind = parse_kind(mode)?;
    with_exact_game!(game, G => {
        let a = parse_net::<G>(&net0, "net0")?;
        let b = match &net1 {
            Some(bytes) => parse_net::<G>(bytes, "net1")?,
            None => a.clone(),
        };
        Ok(net_exploitability::<G>([&a, &b], kind))
    })
}

/// Juega `pairs` partidos duplicados (2 partidos a 30 cada uno) de la red contra `opponent`
/// ("random" o "heuristic"). Devuelve (partidos ganados por la red, partidos jugados).
#[pyfunction]
#[pyo3(signature = (opponent, mode, net0, net1=None, pairs=100, seed=0, threads=1))]
#[allow(clippy::too_many_arguments)]
fn eval_duplicate(
    py: Python<'_>,
    opponent: &str,
    mode: &str,
    net0: Bound<'_, PyBytes>,
    net1: Option<Bound<'_, PyBytes>>,
    pairs: u64,
    seed: u64,
    threads: usize,
) -> PyResult<(u64, u64)> {
    let kind = parse_kind(mode)?;
    let heuristic = match opponent {
        "random" => false,
        "heuristic" => true,
        other => {
            return Err(PyValueError::new_err(format!(
                "rival desconocido: {other} (random o heuristic)"
            )))
        }
    };
    let a = Arc::new(parse_net::<TrucoGame>(&net0, "net0")?);
    let b = match &net1 {
        Some(bytes) => Arc::new(parse_net::<TrucoGame>(bytes, "net1")?),
        None => a.clone(),
    };
    let pool = pool(threads)?;
    let wins: u64 = py.allow_threads(|| {
        pool.install(|| {
            (0..pairs)
                .into_par_iter()
                .map(|i| {
                    let mut rng =
                        SmallRng::seed_from_u64(seed ^ i.wrapping_mul(0xD1B5_4A32_D192_ED03));
                    let deal_seed = seed.wrapping_mul(31).wrapping_add(i);
                    let mut agent = MlpAgent::new([a.clone(), b.clone()], kind, "net");
                    let mut rival: Box<dyn Agent> = if heuristic {
                        Box::new(HeuristicAgent)
                    } else {
                        Box::new(RandomAgent)
                    };
                    play_duplicate(&mut agent, &mut *rival, deal_seed, &mut rng).a_wins() as u64
                })
                .sum()
        })
    });
    Ok((wins, pairs * 2))
}

/// Forward de una red TCFRW1 sobre `n` entradas de `input_size` bytes seguidas.
/// Devuelve n × output_size floats little-endian. Sirve para el test de paridad con PyTorch.
#[pyfunction]
fn mlp_forward<'py>(
    py: Python<'py>,
    net: Bound<'py, PyBytes>,
    x: Bound<'py, PyBytes>,
) -> PyResult<Bound<'py, PyBytes>> {
    let net = Mlp::from_bytes(net.as_bytes()).map_err(PyValueError::new_err)?;
    let x = x.as_bytes();
    let n_in = net.input_size();
    if x.is_empty() || x.len() % n_in != 0 {
        return Err(PyValueError::new_err(format!(
            "x tiene {} bytes, que no es un múltiplo de {n_in}",
            x.len()
        )));
    }
    let mut out = vec![0f32; x.len() / n_in * net.output_size()];
    for (row, dst) in x
        .chunks_exact(n_in)
        .zip(out.chunks_exact_mut(net.output_size()))
    {
        net.forward(row, dst);
    }
    Ok(PyBytes::new(py, &floats_to_bytes(&out)))
}

/// Una mano de truco que Python puede jugar paso a paso. Toda acción se valida contra la
/// máscara de acciones legales: una acción ilegal levanta `ValueError` y no toca el estado.
#[pyclass]
struct Hand {
    game: TrucoGame,
}

#[pymethods]
impl Hand {
    /// Reparte una mano al azar (con puntajes de inicio muestreados como en el entrenamiento).
    #[new]
    fn new(seed: u64) -> Hand {
        let mut rng = SmallRng::seed_from_u64(seed);
        Hand {
            game: TrucoGame::root().sample_chance(&mut rng),
        }
    }

    fn is_terminal(&self) -> bool {
        self.game.node() == Node::Terminal
    }

    /// Jugador al que le toca decidir, o `None` si la mano terminó.
    fn current_player(&self) -> Option<usize> {
        match self.game.node() {
            Node::Decision(p) => Some(p),
            _ => None,
        }
    }

    fn legal_mask(&self) -> u16 {
        self.game.legal_actions()
    }

    fn apply(&mut self, action: usize) -> PyResult<()> {
        if self.is_terminal() {
            return Err(PyValueError::new_err("la mano ya terminó"));
        }
        if action >= NUM_ACTIONS || self.game.legal_actions() & bit(action) == 0 {
            return Err(PyValueError::new_err(format!(
                "acción ilegal: {action} (máscara legal {:#014b})",
                self.game.legal_actions()
            )));
        }
        self.game.apply(action);
        Ok(())
    }

    /// Lo que ve el jugador `player`, como 304 bytes.
    fn encode<'py>(&self, py: Python<'py>, player: usize) -> PyResult<Bound<'py, PyBytes>> {
        if player > 1 {
            return Err(PyValueError::new_err("player tiene que ser 0 o 1"));
        }
        let mut buf = vec![0u8; TrucoGame::ENCODING_SIZE];
        self.game.encode(player, &mut buf);
        Ok(PyBytes::new(py, &buf))
    }

    /// Puntos netos de cada jugador; solo cuando la mano terminó.
    fn returns(&self) -> PyResult<(f32, f32)> {
        if !self.is_terminal() {
            return Err(PyValueError::new_err("la mano todavía no terminó"));
        }
        let r = self.game.returns();
        Ok((r[0], r[1]))
    }
}

#[pymodule]
fn truco_engine_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(game_info, m)?)?;
    m.add_function(wrap_pyfunction!(traverse_batch, m)?)?;
    m.add_function(wrap_pyfunction!(exploitability, m)?)?;
    m.add_function(wrap_pyfunction!(eval_duplicate, m)?)?;
    m.add_function(wrap_pyfunction!(mlp_forward, m)?)?;
    m.add_class::<Hand>()?;
    Ok(())
}
