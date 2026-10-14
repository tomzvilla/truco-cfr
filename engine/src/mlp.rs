//! Perceptrón multicapa: solo el forward, con pesos en formato TCFRW1 (ver docs/weights-format.md).
use rand::{Rng, RngCore};

pub const MAGIC: [u8; 8] = *b"TCFRW1\0\0";

/// Máxima cantidad de capas aceptada al leer un archivo (defensa contra encabezados corruptos).
const MAX_LAYERS: usize = 64;

#[derive(Clone, Debug)]
pub struct Layer {
    pub inp: usize,
    pub out: usize,
    /// Pesos por filas: `w[o * inp + i]`.
    pub w: Vec<f32>,
    pub b: Vec<f32>,
}

#[derive(Clone, Debug)]
pub struct Mlp {
    layers: Vec<Layer>,
    input_scale: Vec<f32>,
}

impl Mlp {
    pub fn new(layers: Vec<Layer>, input_scale: Vec<f32>) -> Mlp {
        assert!(!layers.is_empty(), "red sin capas");
        assert_eq!(layers[0].inp, input_scale.len(), "input_scale no coincide con la primera capa");
        for pair in layers.windows(2) {
            assert_eq!(pair[0].out, pair[1].inp, "capas encadenadas con tamaños distintos");
        }
        for l in &layers {
            assert_eq!(l.w.len(), l.inp * l.out);
            assert_eq!(l.b.len(), l.out);
        }
        Mlp { layers, input_scale }
    }

    /// Pesos uniformes en [-0.1, 0.1]: solo para benchmarks y tests.
    pub fn random(sizes: &[usize], input_scale: Vec<f32>, rng: &mut dyn RngCore) -> Mlp {
        let layers = sizes
            .windows(2)
            .map(|w| Layer {
                inp: w[0],
                out: w[1],
                w: (0..w[0] * w[1]).map(|_| rng.gen_range(-0.1..0.1)).collect(),
                b: (0..w[1]).map(|_| rng.gen_range(-0.1..0.1)).collect(),
            })
            .collect();
        Mlp::new(layers, input_scale)
    }

    pub fn input_size(&self) -> usize {
        self.layers[0].inp
    }

    pub fn output_size(&self) -> usize {
        self.layers.last().unwrap().out
    }

    pub fn forward(&self, x: &[u8], out: &mut [f32]) {
        assert_eq!(x.len(), self.input_size());
        assert_eq!(out.len(), self.output_size());
        let mut cur: Vec<f32> = x.iter().zip(&self.input_scale).map(|(&v, &s)| v as f32 * s).collect();
        let last = self.layers.len() - 1;
        for (li, l) in self.layers.iter().enumerate() {
            let mut next = l.b.clone();
            for (o, acc) in next.iter_mut().enumerate() {
                let row = &l.w[o * l.inp..(o + 1) * l.inp];
                *acc += row.iter().zip(&cur).map(|(w, v)| w * v).sum::<f32>();
                if li != last {
                    *acc = acc.max(0.0);
                }
            }
            cur = next;
        }
        out.copy_from_slice(&cur);
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(&MAGIC);
        v.extend_from_slice(&(self.layers.len() as u32).to_le_bytes());
        v.extend_from_slice(&(self.input_scale.len() as u32).to_le_bytes());
        self.input_scale.iter().for_each(|f| v.extend_from_slice(&f.to_le_bytes()));
        for l in &self.layers {
            v.extend_from_slice(&(l.inp as u32).to_le_bytes());
            v.extend_from_slice(&(l.out as u32).to_le_bytes());
            l.w.iter().chain(&l.b).for_each(|f| v.extend_from_slice(&f.to_le_bytes()));
        }
        v
    }

    /// Lee un archivo TCFRW1. No confía en el encabezado: todo tamaño se valida contra los bytes
    /// que realmente hay antes de reservar memoria, y cualquier problema devuelve `Err` (nunca pánico).
    pub fn from_bytes(bytes: &[u8]) -> Result<Mlp, String> {
        let mut r = Reader { bytes, pos: 0 };
        if r.take(8)? != MAGIC {
            return Err("no es un archivo TCFRW1".into());
        }
        let n_layers = r.u32()? as usize;
        if n_layers == 0 || n_layers > MAX_LAYERS {
            return Err(format!("cantidad de capas inválida: {n_layers} (máximo {MAX_LAYERS})"));
        }
        let input_size = r.u32()? as usize;
        let input_scale = r.f32s(input_size)?;
        let mut layers = Vec::with_capacity(n_layers);
        for _ in 0..n_layers {
            let inp = r.u32()? as usize;
            let out = r.u32()? as usize;
            let n_w = inp.checked_mul(out).ok_or("dimensiones de capa inválidas")?;
            let w = r.f32s(n_w)?;
            let b = r.f32s(out)?;
            layers.push(Layer { inp, out, w, b });
        }
        if r.pos != bytes.len() {
            return Err(format!("sobran {} bytes al final", bytes.len() - r.pos));
        }
        if layers[0].inp != input_size {
            return Err("capas inconsistentes con input_size".into());
        }
        if layers.windows(2).any(|p| p[0].out != p[1].inp) {
            return Err("capas encadenadas con tamaños distintos".into());
        }
        Ok(Mlp { layers, input_scale })
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.pos.checked_add(n).filter(|&e| e <= self.bytes.len()).ok_or("archivo truncado")?;
        let s = &self.bytes[self.pos..end];
        self.pos = end;
        Ok(s)
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn f32s(&mut self, n: usize) -> Result<Vec<f32>, String> {
        let raw = self.take(n.checked_mul(4).ok_or("tamaño inválido")?)?;
        Ok(raw.as_chunks::<4>().0.iter().map(|c| f32::from_le_bytes(*c)).collect())
    }
}
