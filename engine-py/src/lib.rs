//! Puente Python <-> motor. Esqueleto: la Tarea 4 lo completa con el resto de las funciones.
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use truco_engine::game::Game;
use truco_engine::kuhn::Kuhn;
use truco_engine::minitruco::MiniTruco;
use truco_engine::truco::TrucoGame;

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

/// (tamaño de la codificación, cantidad de acciones, factor de escala de cada byte de entrada)
#[pyfunction]
fn game_info(game: &str) -> PyResult<(usize, usize, Vec<f32>)> {
    with_game!(game, G => Ok((G::ENCODING_SIZE, G::NUM_ACTIONS, G::feature_scale())))
}

#[pymodule]
fn truco_engine_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(game_info, m)?)?;
    Ok(())
}
