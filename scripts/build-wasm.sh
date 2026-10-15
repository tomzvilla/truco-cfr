#!/usr/bin/env bash
# Compila engine-wasm para el navegador y deja el paquete en web/src/engine/pkg (se versiona:
# así el deploy y el CI de la web no necesitan Rust). Requiere: rustup target add wasm32-unknown-unknown
# y cargo install wasm-bindgen-cli --version 0.2.129 --locked
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-unknown-unknown -p truco-engine-wasm
rm -rf web/src/engine/pkg
wasm-bindgen --target web --out-dir web/src/engine/pkg   target/wasm32-unknown-unknown/release/truco_engine_wasm.wasm
rm -f web/src/engine/pkg/.gitignore
ls -l web/src/engine/pkg
