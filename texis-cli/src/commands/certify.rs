//! Comando `certify`: ejecuta la certificación estructural del núcleo nuevo
//! sobre la matriz de fixtures (paso 16). Sale con error si algún gate falla.
//!
//! Los gates de compilación a PDF (toolchain LaTeX, corpus real, regresión
//! visual) requieren la máquina del usuario y se ejecutan aparte.

use anyhow::Result;
use texis_certification::run_certification;

pub fn run(compile: bool, strict: bool, compile_matrix: bool) -> Result<()> {
    // La matriz de compilación implica compilar; --strict también.
    let include_compile = compile || strict || compile_matrix;
    let report = run_certification(include_compile, strict, compile_matrix);
    print!("{}", report.summary());
    if report.passed() {
        Ok(())
    } else {
        anyhow::bail!("la certificación falló")
    }
}
