//! Carga de la red de estrategia publicada.
use std::path::Path;
use std::sync::Arc;
use truco_engine::mlp::Mlp;
use truco_engine::truco::{ENCODING_SIZE, NUM_ACTIONS};

/// Lee un archivo TCFRW1 y verifica que sea una red de truco (entrada y salida del tamaño justo).
pub fn load_model(path: &Path) -> Result<Arc<Mlp>, String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("no pude leer el modelo {}: {e}", path.display()))?;
    let net = Mlp::from_bytes(&bytes)
        .map_err(|e| format!("{} no es un archivo TCFRW1 válido: {e}", path.display()))?;
    if net.input_size() != ENCODING_SIZE || net.output_size() != NUM_ACTIONS {
        return Err(format!(
            "{} no es una red de truco (entrada {}, salida {}; se esperaba {ENCODING_SIZE} y {NUM_ACTIONS})",
            path.display(),
            net.input_size(),
            net.output_size()
        ));
    }
    Ok(Arc::new(net))
}
