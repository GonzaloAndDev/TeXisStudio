//! Gate de compilación real a PDF (Etapa J).
//!
//! Escribe los artefactos ensamblados en un directorio temporal y ejecuta el
//! toolchain LaTeX. Sólo se ejecuta si hay un motor disponible; si no, devuelve
//! un resultado "omitido" (no falla) y deja constancia de que requiere toolchain.

use std::path::Path;
use std::process::Command;

use texis_core::postflight::{PdfChecker, PdfIssueSeverity, PdfPostflightResult};
use texis_document_application::ports::ContentHasher;
use texis_document_application::{AssembleDocumentUseCase, BuildMode};
use texis_document_contracts::manifest::{BuildManifest, PostflightSummary};
use texis_document_domain::ir::DocumentIR;
use texis_document_infra::{JsonIrSerializer, LatexRenderBackend, Sha256Hasher};

/// Disponibilidad del toolchain.
pub struct Toolchain;

impl Toolchain {
    pub fn has(bin: &str) -> bool {
        Command::new(bin)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// `true` si hay al menos un motor LaTeX usable vía latexmk o tectonic.
    pub fn available() -> bool {
        (Self::has("latexmk") && (Self::has("xelatex") || Self::has("pdflatex")))
            || Self::has("tectonic")
    }
}

/// Resultado de un intento de compilación.
#[derive(Debug)]
pub struct CompileOutcome {
    pub attempted: bool,
    pub compiler_success: bool,
    pub produced_pdf: bool,
    pub postflight: Option<PdfPostflightResult>,
    /// Manifiesto de build con datos de entrega (hash del PDF + postflight)
    /// cuando se produjo el PDF.
    pub manifest: Option<BuildManifest>,
    pub log_tail: String,
}

/// Compila el IR a PDF en un directorio temporal. Devuelve el resultado.
pub fn compile(ir: &DocumentIR) -> std::io::Result<CompileOutcome> {
    if !Toolchain::available() {
        return Ok(CompileOutcome {
            attempted: false,
            compiler_success: false,
            produced_pdf: false,
            postflight: None,
            manifest: None,
            log_tail: "toolchain LaTeX no disponible".to_string(),
        });
    }

    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );
    // El pipeline en modo Final debe pasar antes de compilar (sin bloqueantes).
    let assembled = match use_case.execute(ir, BuildMode::Final) {
        Ok(a) => a,
        Err(e) => {
            let codes: Vec<&str> = e.diagnostics.errors().map(|d| d.code.as_str()).collect();
            return Ok(CompileOutcome {
                attempted: true,
                compiler_success: false,
                produced_pdf: false,
                postflight: None,
                manifest: None,
                log_tail: format!("pipeline Final bloqueado antes de compilar: {codes:?}"),
            });
        }
    };

    let dir = tempfile::tempdir()?;
    let root = dir.path();
    for f in &assembled.rendered.files {
        let path = root.join(&f.relative_path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, &f.content)?;
    }

    let engine = ir.profile.engine.as_str();
    let output = run_compiler(root, engine)?;
    let pdf = root.join("main.pdf");
    let produced_pdf = pdf.exists();
    let compiler_success = output.status.success();
    let postflight = produced_pdf.then(|| PdfChecker::check(&pdf));

    // Manifiesto de entrega: hash del PDF + resumen de postflight (§ Entrega).
    let mut manifest = assembled.manifest.clone();
    if produced_pdf {
        if let Ok(pdf_bytes) = std::fs::read(&pdf) {
            let pdf_hash = Sha256Hasher.hash_hex(&pdf_bytes);
            let summary = postflight
                .as_ref()
                .map(postflight_summary)
                .unwrap_or(PostflightSummary {
                    passed: false,
                    all_fonts_embedded: false,
                    error_codes: Vec::new(),
                    pdfa_compliant: None,
                });
            manifest.attach_delivery(pdf_hash, summary);
        }
    }

    let log = read_log_tail(root);
    Ok(CompileOutcome {
        attempted: true,
        compiler_success,
        produced_pdf,
        postflight,
        manifest: Some(manifest),
        log_tail: if produced_pdf && compiler_success {
            String::new()
        } else {
            format!("compilador status={:?}\n{}", output.status.code(), log)
        },
    })
}

/// Construye el resumen de postflight ligero para el manifiesto de entrega.
fn postflight_summary(pf: &PdfPostflightResult) -> PostflightSummary {
    let mut error_codes: Vec<String> = pf
        .issues
        .iter()
        .filter(|i| i.severity == PdfIssueSeverity::Error)
        .map(|i| i.code.clone())
        .collect();
    error_codes.sort();
    PostflightSummary {
        passed: pf.passed,
        all_fonts_embedded: pf.all_fonts_embedded,
        error_codes,
        pdfa_compliant: pf.pdfa.as_ref().map(|c| c.compliant),
    }
}

fn run_compiler(root: &Path, engine: &str) -> std::io::Result<std::process::Output> {
    if Toolchain::has("latexmk") {
        let engine_flag = match engine {
            "lualatex" => "-lualatex",
            "pdflatex" => "-pdflatex",
            _ => "-xelatex",
        };
        Command::new("latexmk")
            .args([
                engine_flag,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "main.tex",
            ])
            .current_dir(root)
            .output()
    } else {
        Command::new("tectonic")
            .args(["main.tex"])
            .current_dir(root)
            .output()
    }
}

fn read_log_tail(root: &Path) -> String {
    let log_path = root.join("main.log");
    match std::fs::read_to_string(&log_path) {
        Ok(content) => content
            .lines()
            .rev()
            .take(25)
            .collect::<Vec<_>>()
            .join("\n"),
        Err(_) => "sin main.log".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use texis_document_infra::fixtures::compilable_thesis_ir;

    #[test]
    fn delivery_manifest_carries_pdf_hash_and_postflight() {
        // Sólo se ejecuta de verdad si hay toolchain LaTeX (CI / máquina del
        // usuario); si no, se omite sin fallar (no se simula un PDF).
        if !Toolchain::available() {
            eprintln!("omitido: sin toolchain LaTeX en PATH");
            return;
        }
        let outcome = compile(&compilable_thesis_ir()).expect("compilación");
        if outcome.produced_pdf {
            let manifest = outcome.manifest.expect("manifiesto de entrega");
            assert!(manifest.pdf_sha256.is_some(), "falta hash del PDF");
            assert!(manifest.postflight.is_some(), "falta resumen de postflight");
        }
    }
}
