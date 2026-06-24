//! Comando `certify`: ejecuta la certificación estructural del núcleo nuevo
//! sobre la matriz de fixtures (paso 16). Sale con error si algún gate falla.
//!
//! Los gates de compilación a PDF (toolchain LaTeX, corpus real, regresión
//! visual) requieren la máquina del usuario y se ejecutan aparte.

use anyhow::Result;
use texis_certification::run_certification;

pub fn run(compile: bool, strict: bool) -> Result<()> {
    let report = run_certification(compile || strict, strict);
    print!("{}", report.summary());
    if report.passed() {
        Ok(())
    } else {
        anyhow::bail!("la certificación falló")
    }
}
