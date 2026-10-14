//! Argumentos `--clave valor` de la línea de comandos (sin dependencias).
use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;

pub struct Args {
    values: HashMap<String, String>,
}

impl Args {
    pub fn parse(argv: &[String]) -> Result<Args, String> {
        let mut values = HashMap::new();
        let mut it = argv.iter();
        while let Some(key) = it.next() {
            let name = key.strip_prefix("--").ok_or_else(|| {
                format!("argumento inesperado: {key} (se esperaba --clave valor)")
            })?;
            let value = it
                .next()
                .ok_or_else(|| format!("falta el valor de --{name}"))?;
            values.insert(name.to_string(), value.clone());
        }
        Ok(Args { values })
    }

    pub fn get<T: FromStr>(&self, key: &str, default: Option<T>) -> Result<T, String> {
        match self.values.get(key) {
            Some(v) => v
                .parse()
                .map_err(|_| format!("valor inválido para --{key}: {v}")),
            None => default.ok_or_else(|| format!("falta --{key}")),
        }
    }

    pub fn path(&self, key: &str, default: &str) -> PathBuf {
        PathBuf::from(self.values.get(key).map(String::as_str).unwrap_or(default))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }

    #[test]
    fn parses_pairs_and_defaults() {
        let a = Args::parse(&argv("--pairs 10 --out x/y")).unwrap();
        assert_eq!(a.get::<u64>("pairs", None).unwrap(), 10);
        assert_eq!(a.get::<u64>("seed", Some(7)).unwrap(), 7);
        assert_eq!(a.path("out", "eval/results"), PathBuf::from("x/y"));
        assert_eq!(a.path("logs", "eval/logs"), PathBuf::from("eval/logs"));
    }

    #[test]
    fn rejects_bad_input() {
        assert!(Args::parse(&argv("pairs 10")).is_err());
        assert!(Args::parse(&argv("--pairs")).is_err());
        let a = Args::parse(&argv("--pairs diez")).unwrap();
        assert!(a.get::<u64>("pairs", None).unwrap_err().contains("--pairs"));
        assert!(a
            .get::<u64>("seed", None)
            .unwrap_err()
            .contains("falta --seed"));
    }
}
