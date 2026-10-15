//! Intervalos de confianza: Wilson para porcentajes y bootstrap para promedios.
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};

/// Intervalo de Wilson al 95 % para `wins` éxitos en `n` intentos.
pub fn wilson(wins: u64, n: u64) -> (f64, f64) {
    if n == 0 {
        return (0.0, 1.0);
    }
    let z = 1.96;
    let nf = n as f64;
    let p = wins as f64 / nf;
    let denom = 1.0 + z * z / nf;
    let center = (p + z * z / (2.0 * nf)) / denom;
    let half = z * (p * (1.0 - p) / nf + z * z / (4.0 * nf * nf)).sqrt() / denom;
    ((center - half).max(0.0), (center + half).min(1.0))
}

/// Media de `suma / cantidad` y su intervalo al 95 % por bootstrap de percentiles.
/// Cada elemento es un grupo que se remuestrea entero (por ejemplo, los puntos netos y la cantidad
/// de manos de un par duplicado), así la correlación dentro del grupo no achica el intervalo.
pub fn bootstrap_mean(clusters: &[(f64, u64)], resamples: usize, seed: u64) -> (f64, f64, f64) {
    let total: f64 = clusters.iter().map(|c| c.0).sum();
    let count: u64 = clusters.iter().map(|c| c.1).sum();
    if count == 0 {
        return (0.0, 0.0, 0.0);
    }
    let mean = total / count as f64;
    let mut rng = SmallRng::seed_from_u64(seed);
    let mut means = Vec::with_capacity(resamples);
    for _ in 0..resamples {
        let (mut s, mut c) = (0.0, 0u64);
        for _ in 0..clusters.len() {
            let k = rng.gen_range(0..clusters.len());
            s += clusters[k].0;
            c += clusters[k].1;
        }
        if c > 0 {
            means.push(s / c as f64);
        }
    }
    means.sort_by(|a, b| a.partial_cmp(b).expect("media no numérica"));
    let q = |f: f64| means[(f * (means.len() - 1) as f64).round() as usize];
    (mean, q(0.025), q(0.975))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wilson_matches_the_training_report() {
        // 1205/2000 contra el heurístico: el informe dice [58,1 %; 62,4 %].
        let (lo, hi) = wilson(1205, 2000);
        assert!((lo - 0.581).abs() < 0.001, "{lo}");
        assert!((hi - 0.624).abs() < 0.001, "{hi}");
    }

    #[test]
    fn wilson_edges() {
        assert_eq!(wilson(0, 0), (0.0, 1.0));
        let (lo, hi) = wilson(0, 10);
        assert_eq!(lo, 0.0);
        assert!(hi > 0.0 && hi < 0.35);
        let (lo, hi) = wilson(10, 10);
        assert!(lo > 0.65 && hi == 1.0);
    }

    #[test]
    fn bootstrap_of_identical_clusters_has_no_spread() {
        let clusters = vec![(3.0, 2); 50];
        let (mean, lo, hi) = bootstrap_mean(&clusters, 500, 1);
        assert_eq!((mean, lo, hi), (1.5, 1.5, 1.5));
    }

    #[test]
    fn bootstrap_interval_contains_mean_and_is_reproducible() {
        let clusters: Vec<(f64, u64)> = (0..200).map(|i| ((i % 7) as f64 - 3.0, 1)).collect();
        let a = bootstrap_mean(&clusters, 2000, 9);
        let b = bootstrap_mean(&clusters, 2000, 9);
        assert_eq!(a, b);
        let (mean, lo, hi) = a;
        assert!(lo < mean && mean < hi, "{a:?}");
        assert!(hi - lo < 1.0, "{a:?}");
    }

    #[test]
    fn bootstrap_of_nothing_is_zero() {
        assert_eq!(bootstrap_mean(&[], 100, 1), (0.0, 0.0, 0.0));
    }
}
