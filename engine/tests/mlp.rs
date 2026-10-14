use rand::rngs::SmallRng;
use rand::SeedableRng;
use truco_engine::mlp::{Layer, Mlp, MAGIC};

fn tiny() -> Mlp {
    Mlp::new(
        vec![
            Layer { inp: 2, out: 2, w: vec![1.0, -1.0, 0.5, 2.0], b: vec![0.0, -1.0] },
            Layer { inp: 2, out: 1, w: vec![1.0, 1.0], b: vec![0.5] },
        ],
        vec![1.0, 0.5],
    )
}

#[test]
fn forward_known_value() {
    // entrada escalada [2, 2]; oculta = relu([0, 4]); salida = 0 + 4 + 0.5
    let mut out = [0.0f32; 1];
    tiny().forward(&[2, 4], &mut out);
    assert!((out[0] - 4.5).abs() < 1e-6, "salida {}", out[0]);
}

#[test]
fn bytes_roundtrip() {
    let m = tiny();
    let back = Mlp::from_bytes(&m.to_bytes()).unwrap();
    let (mut a, mut b) = ([0.0f32; 1], [0.0f32; 1]);
    m.forward(&[3, 7], &mut a);
    back.forward(&[3, 7], &mut b);
    assert_eq!(a, b);
    assert_eq!(back.input_size(), 2);
    assert_eq!(back.output_size(), 1);
}

#[test]
fn rejects_bad_files() {
    let bytes = tiny().to_bytes();
    let mut bad = bytes.clone();
    bad[0] = b'X';
    assert!(Mlp::from_bytes(&bad).is_err(), "magic incorrecto");
    assert!(Mlp::from_bytes(&bytes[..bytes.len() - 3]).is_err(), "archivo truncado");
    let mut extra = bytes.clone();
    extra.push(0);
    assert!(Mlp::from_bytes(&extra).is_err(), "bytes de sobra");
}

#[test]
fn rejects_corrupt_headers_without_panicking() {
    let header = |n_layers: u32, input_size: u32| {
        let mut v = MAGIC.to_vec();
        v.extend_from_slice(&n_layers.to_le_bytes());
        v.extend_from_slice(&input_size.to_le_bytes());
        v
    };
    // n_layers absurdo con el archivo cortado justo después del encabezado.
    assert!(Mlp::from_bytes(&header(u32::MAX, 2)).is_err());
    assert!(Mlp::from_bytes(&header(1000, 0)).is_err(), "más de 64 capas");
    // input_size gigante: no puede reservar memoria ni entrar en pánico.
    assert!(Mlp::from_bytes(&header(1, u32::MAX)).is_err());
    // Dimensiones de capa gigantes (inp * out desborda en 32 bits y es enorme en 64).
    let mut v = header(1, 0);
    v.extend_from_slice(&u32::MAX.to_le_bytes());
    v.extend_from_slice(&u32::MAX.to_le_bytes());
    assert!(Mlp::from_bytes(&v).is_err());
    // Archivos truncados en cada prefijo posible: siempre Err, nunca pánico.
    let bytes = tiny().to_bytes();
    for cut in 0..bytes.len() {
        assert!(Mlp::from_bytes(&bytes[..cut]).is_err(), "prefijo de {cut} bytes");
    }
    // Sin capas.
    assert!(Mlp::from_bytes(&header(0, 0)).is_err());
}

#[test]
fn random_has_requested_shape() {
    let mut rng = SmallRng::seed_from_u64(0);
    let m = Mlp::random(&[304, 64, 12], vec![1.0; 304], &mut rng);
    let mut out = [0.0f32; 12];
    m.forward(&[1u8; 304], &mut out);
    assert!(out.iter().all(|x| x.is_finite()));
}
