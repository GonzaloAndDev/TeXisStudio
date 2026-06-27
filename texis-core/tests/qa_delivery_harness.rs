//! Harness de QA estructural de entrega (Plan Integral §3).
//!
//! Genera una tesis real (fixture rico), la compila con `latexmk -xelatex`,
//! analiza `main.log`, ejecuta el postflight del PDF y usa la **compuerta única
//! de calidad** (`texis_core::quality`) como oráculo. Verifica, con reglas
//! estructurales tolerantes pero estrictas, que la salida es de calidad de
//! entrega: sin errores LaTeX, sin referencias/citas indefinidas, sin overfull
//! boxes, con fuentes incrustadas, sin páginas casi vacías, y que las compuertas
//! `review` y `final` pasan.
//!
//! Se **omite sin fallar** si no hay toolchain LaTeX en PATH (igual que la
//! certificación), de modo que no rompe entornos sin LaTeX; en CI con TeX Live
//! instalado se ejecuta de verdad.

mod fixtures;

use std::path::Path;
use std::process::Command;

use texis_core::document::DocumentEngine;
use texis_core::events::EventBus;
use texis_core::postflight::PdfChecker;
use texis_core::quality::{self, QualityInputs};
use texis_core::validator::Validator;

fn tool_ok(bin: &str, flag: &str) -> bool {
    Command::new(bin)
        .arg(flag)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn latex_available() -> bool {
    tool_ok("latexmk", "--version") && tool_ok("xelatex", "--version")
}

fn log_tail(log: &str) -> String {
    log.lines().rev().take(30).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n")
}

/// Texto por página (separadas por form-feed de pdftotext). Vacío si la
/// herramienta no está disponible.
fn pdftotext_pages(pdf: &Path) -> Vec<String> {
    let out = match Command::new("pdftotext").args(["-enc", "UTF-8"]).arg(pdf).arg("-").output() {
        Ok(o) if o.status.success() => o,
        _ => return vec![],
    };
    String::from_utf8_lossy(&out.stdout)
        .split('\u{000c}')
        .map(|s| s.to_string())
        .collect()
}

#[test]
fn qa_delivery_thesis_compiles_clean_and_passes_quality_gate() {
    if !latex_available() {
        eprintln!("omitido: sin latexmk+xelatex en PATH");
        return;
    }

    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let model = fixtures::qa_delivery_model();

    // Bibliografía: el generador la copia a build/ y latexmk corre biber.
    let bib_dir = root.join("content").join("bibliography");
    std::fs::create_dir_all(&bib_dir).unwrap();
    std::fs::write(bib_dir.join("references.bib"), fixtures::qa_delivery_bib()).unwrap();

    // ── Generar build/ por el camino REAL del editor (ProjectModel) ─────────
    let build = root.join("build");
    let mut engine = DocumentEngine::new().expect("engine");
    engine.generate(&model, &build, &EventBus::new()).expect("generar");

    // ── Compilar con los flags reales de la app ─────────────────────────────
    let out = Command::new("latexmk")
        .args(["-xelatex", "-interaction=nonstopmode", "-file-line-error", "main.tex"])
        .current_dir(&build)
        .output()
        .expect("latexmk");
    let log = std::fs::read_to_string(build.join("main.log")).unwrap_or_default();
    let pdf = build.join("main.pdf");

    assert!(
        pdf.exists(),
        "no se generó PDF (status={:?})\n{}",
        out.status.code(),
        log_tail(&log)
    );

    // ── Reglas estructurales sobre el log ───────────────────────────────────
    assert!(!log.contains("LaTeX Error"), "el log contiene 'LaTeX Error'");
    assert!(
        !log.contains("Undefined control sequence"),
        "comando LaTeX indefinido en el log"
    );
    assert!(
        !log.contains("There were undefined references"),
        "referencias indefinidas en el log"
    );
    assert!(
        !log.contains("There were undefined citations"),
        "citas indefinidas en el log"
    );
    let overfull = log.matches("Overfull \\hbox").count();
    assert!(overfull == 0, "se esperaban 0 overfull hboxes, hubo {overfull}");

    // ── Postflight: fuentes incrustadas ─────────────────────────────────────
    let postflight = PdfChecker::check(&pdf);
    assert!(
        postflight.all_fonts_embedded,
        "fuentes sin incrustar: {:?}",
        postflight.non_embedded_fonts
    );

    // ── Compuerta única de calidad como oráculo ─────────────────────────────
    let validation = Validator::new()
        .validate_with_profile(&model, root, None)
        .expect("validación");
    let report = quality::assess(QualityInputs {
        validation: &validation,
        postflight: Some(&postflight),
        log: Some(&log),
        profile: None,
    });
    assert!(
        report.review_gate.passed,
        "compuerta review bloqueada: {:?}",
        report.review_gate.blocking_codes
    );
    assert!(
        report.final_gate.passed,
        "compuerta final bloqueada: {:?}",
        report.final_gate.blocking_codes
    );

    // ── Estructura/visual: páginas y ausencia de páginas casi vacías ────────
    let pages = pdftotext_pages(&pdf);
    if !pages.is_empty() {
        assert!(
            pages.len() >= 7,
            "se esperaban >= 7 páginas de entrega, hubo {}",
            pages.len()
        );
        for (i, txt) in pages.iter().enumerate() {
            // La última "página" tras el último form-feed suele ser vacía.
            if i == pages.len() - 1 && txt.trim().is_empty() {
                continue;
            }
            let chars = txt.chars().filter(|c| !c.is_whitespace()).count();
            assert!(
                chars >= 30,
                "página {} casi vacía ({} caracteres) — posible hueco de layout",
                i + 1,
                chars
            );
        }
    }
}
