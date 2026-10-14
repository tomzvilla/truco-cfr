//! Interfaz común a todos los juegos: Kuhn, MiniTruco y Truco.
use rand::RngCore;

pub type Player = usize;
pub type Action = usize;
/// Conjunto de acciones legales como bits: el bit `a` encendido = la acción `a` es legal.
pub type ActionMask = u16;

pub const fn bit(a: Action) -> ActionMask {
    1 << a
}

pub fn actions_of(mask: ActionMask) -> impl Iterator<Item = Action> {
    (0..16).filter(move |&a| mask & bit(a) != 0)
}

pub fn other(p: Player) -> Player {
    1 - p
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Node {
    /// Le toca al azar (repartir cartas).
    Chance,
    /// Le toca decidir a un jugador.
    Decision(Player),
    /// Terminó: se pueden leer los puntos con `returns`.
    Terminal,
}

pub trait Game: Clone + Send + Sync + 'static {
    const NUM_ACTIONS: usize;
    const ENCODING_SIZE: usize;

    fn root() -> Self;
    fn node(&self) -> Node;
    /// Resuelve un nodo de azar eligiendo un resultado al azar.
    fn sample_chance(&self, rng: &mut dyn RngCore) -> Self;
    fn legal_actions(&self) -> ActionMask;
    fn apply(&mut self, a: Action);
    /// Puntos netos de cada jugador (suma cero).
    fn returns(&self) -> [f32; 2];
    /// Lo que ve el jugador `p`, como bytes para la red neuronal (largo `ENCODING_SIZE`).
    fn encode(&self, p: Player, out: &mut [u8]);
    /// Factor por el que se multiplica cada byte de `encode` antes de entrar a la red.
    fn feature_scale() -> Vec<f32>;
}

/// Juegos lo bastante chicos para recorrerlos enteros (CFR exacto y explotabilidad exacta).
pub trait ExactGame: Game {
    fn chance_outcomes(&self) -> Vec<(Self, f64)>;
    /// Identificador de lo que sabe el jugador `p` (su "conjunto de información").
    fn infoset_key(&self, p: Player) -> u64;
}
