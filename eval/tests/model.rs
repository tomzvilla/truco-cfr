use rand::rngs::SmallRng;
use rand::SeedableRng;
use std::path::{Path, PathBuf};
use truco_engine::mlp::Mlp;
use truco_engine::truco::{feature_scale, ENCODING_SIZE};
use truco_eval::model::load_model;

fn tmp(name: &str, bytes: &[u8]) -> PathBuf {
    let p = std::env::temp_dir().join(format!("truco-eval-{}-{name}", std::process::id()));
    std::fs::write(&p, bytes).unwrap();
    p
}

#[test]
fn published_model_loads() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../models/strategy.tcfrw");
    let net = load_model(&root).expect("el modelo publicado tiene que cargar");
    assert_eq!(net.input_size(), ENCODING_SIZE);
    assert_eq!(net.output_size(), 12);
}

#[test]
fn missing_file_is_a_clear_error() {
    let err = load_model(Path::new("/no/existe.tcfrw")).unwrap_err();
    assert!(err.contains("no pude leer el modelo"), "{err}");
}

#[test]
fn garbage_is_rejected() {
    let p = tmp("garbage", b"esto no es una red");
    let err = load_model(&p).unwrap_err();
    assert!(err.contains("no es un archivo TCFRW1"), "{err}");
}

#[test]
fn a_non_truco_net_is_rejected() {
    let mut rng = SmallRng::seed_from_u64(1);
    let kuhn_like = Mlp::random(&[10, 8, 3], vec![1.0; 10], &mut rng);
    let p = tmp("kuhn", &kuhn_like.to_bytes());
    let err = load_model(&p).unwrap_err();
    assert!(err.contains("no es una red de truco"), "{err}");
    let truco_like = Mlp::random(&[ENCODING_SIZE, 16, 12], feature_scale(), &mut rng);
    let p = tmp("truco", &truco_like.to_bytes());
    assert!(load_model(&p).is_ok());
}
