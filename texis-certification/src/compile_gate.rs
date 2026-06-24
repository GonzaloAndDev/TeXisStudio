//! Gate de compilación real a PDF (Etapa J).
//!
//! Escribe los artefactos ensamblados en un directorio temporal y ejecuta el
//! toolchain LaTeX. Sólo se ejecuta si hay un motor disponible; si no, devuelve
//! un resultado "omitido" (no falla) y deja constancia de que requiere toolchain.

use std::path::Path;
use std::process::Command;

use texis_core::postflight::{PdfChecker, PdfPostflightResult};
use texis_document_application::{AssembleDocumentUseCase, BuildMode};
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

    let log = read_log_tail(root);
    Ok(CompileOutcome {
        attempted: true,
        compiler_success,
        produced_pdf,
        postflight,
        log_tail: if produced_pdf && compiler_success {
            String::new()
        } else {
            format!("compilador status={:?}\n{}", output.status.code(), log)
        },
    })
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
