//! truco-eval: evaluación del bot.
//!
//!     cargo run --release -p truco-eval -- tournament --rivals random,heuristic
//!     cargo run --release -p truco-eval -- bluff
//!     cargo run --release -p truco-eval -- highlights
use std::process::ExitCode;
use truco_eval::args::Args;

const USAGE: &str = "uso: truco-eval <tournament|bluff|highlights> [--clave valor ...]";

fn run(argv: &[String]) -> Result<(), String> {
    let (cmd, rest) = argv.split_first().ok_or(USAGE)?;
    let _args = Args::parse(rest)?;
    Err(format!("subcomando desconocido: {cmd}\n{USAGE}"))
}

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    match run(&argv) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
