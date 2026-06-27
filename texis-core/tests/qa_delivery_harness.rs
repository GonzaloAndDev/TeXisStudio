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

use texis_core::compiler::latexmk::LatexmkBackend;
use texis_core::compiler::{CompilationBackend, CompilationOptions};
use texis_core::document::DocumentEngine;
use texis_core::events::EventBus;
use texis_core::postflight::PdfChecker;
use texis_core::profile::loader::ProfileLoader;
use texis_core::profile::model::Profile;
use texis_core::project::model::{
    BibliographyBackend, CompilerKind, LatexEngine, PageLayout, PageMargins, ProjectModel,
};
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
    log.lines()
        .rev()
        .take(30)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n")
}

/// Texto por página (separadas por form-feed de pdftotext). Vacío si la
/// herramienta no está disponible.
fn pdftotext_pages(pdf: &Path) -> Vec<String> {
    let out = match Command::new("pdftotext")
        .args(["-enc", "UTF-8"])
        .arg(pdf)
        .arg("-")
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return vec![],
    };
    String::from_utf8_lossy(&out.stdout)
        .split('\u{000c}')
        .map(|s| s.to_string())
        .collect()
}

fn apply_profile_to_model(model: &mut ProjectModel, profile: &Profile) {
    model.profile_id = profile.id.clone();
    model.latex_config.document_class.name = profile.document_class.name.clone();
    model.latex_config.document_class.options = profile.document_class.options.clone();
    model.latex_config.engine = match profile.latex_engine.as_str() {
        "pdflatex" => LatexEngine::Pdflatex,
        "lualatex" => LatexEngine::Lualatex,
        _ => LatexEngine::Xelatex,
    };
    model.latex_config.compiler = match profile.compiler.as_str() {
        "tectonic" => CompilerKind::Tectonic,
        _ => CompilerKind::Latexmk,
    };
    model.latex_config.bibliography_backend = match profile.bibliography_backend.as_str() {
        "bibtex" => BibliographyBackend::Bibtex,
        _ => BibliographyBackend::Biber,
    };
    model.latex_config.bibliography_style = profile.bibliography_style.clone();
    model.latex_config.packages_required = profile.packages.clone();
    model.latex_config.page_layout = profile.page_layout.as_ref().map(|layout| PageLayout {
        paper: layout.paper.clone(),
        margins: layout.margins.as_ref().map(|margins| PageMargins {
            top: margins.top.clone(),
            bottom: margins.bottom.clone(),
            left: margins.left.clone(),
            right: margins.right.clone(),
        }),
        line_spacing: layout.line_spacing,
    });
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
    engine
        .generate(&model, &build, &EventBus::new())
        .expect("generar");

    // ── Compilar con los flags reales de la app ─────────────────────────────
    let out = Command::new("latexmk")
        .args([
            "-xelatex",
            "-interaction=nonstopmode",
            "-file-line-error",
            "main.tex",
        ])
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
    assert!(
        !log.contains("LaTeX Error"),
        "el log contiene 'LaTeX Error'"
    );
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
    assert!(
        overfull == 0,
        "se esperaban 0 overfull hboxes, hubo {overfull}"
    );

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

/// §4 — Compile-demo de los perfiles bundled con plantilla de portada propia.
/// Compila el documento usando cada `title_page_template` real de los perfiles
/// que envía la app, de modo que un error en una plantilla (variable inexistente,
/// sintaxis MiniJinja o LaTeX roto) se detecte en CI. Habría cazado el bug del
/// subtítulo. Se omite sin toolchain.
#[test]
fn bundled_profile_title_pages_compile() {
    if !latex_available() {
        eprintln!("omitido: sin latexmk+xelatex en PATH");
        return;
    }
    // profiles/ vive en la raíz del workspace (padre de texis-core).
    let profiles_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root")
        .join("profiles");
    if !profiles_root.is_dir() {
        eprintln!("omitido: no se encontró profiles/ en {profiles_root:?}");
        return;
    }

    // Perfiles con title_page_template propio (los de mayor riesgo de plantilla).
    let candidates = ["generic.thesis", "mx.ipn.esfm", "mx.unam.posgrado"];
    let mut checked = 0;
    for id in candidates {
        let yaml = profiles_root.join(id).join("profile.yaml");
        if !yaml.exists() {
            continue;
        }
        let profile = ProfileLoader.load_from_file(&yaml).expect("cargar perfil");
        let Some(tpl) = profile
            .title_page_template
            .as_ref()
            .map(|t| t.template.clone())
        else {
            continue;
        };

        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        let bib = root.join("content").join("bibliography");
        std::fs::create_dir_all(&bib).unwrap();
        std::fs::write(bib.join("references.bib"), fixtures::qa_delivery_bib()).unwrap();

        let mut model = fixtures::qa_delivery_model();
        apply_profile_to_model(&mut model, &profile);

        let build = root.join("build");
        let mut engine = DocumentEngine::new().expect("engine");
        engine
            .generate_with_profile(&model, &build, None, Some(&tpl), &EventBus::new())
            .expect("generar con plantilla del perfil");

        let compile = LatexmkBackend::new()
            .compile(
                &build,
                &CompilationOptions {
                    latex_engine: Some("xelatex".to_string()),
                    bibliography_backend: Some("biber".to_string()),
                    ..Default::default()
                },
            )
            .expect("compilar con latexmk");
        let log = if compile.log.trim().is_empty() {
            std::fs::read_to_string(build.join("main.log")).unwrap_or_default()
        } else {
            compile.log.clone()
        };
        assert!(
            compile.success && build.join("main.pdf").exists(),
            "perfil '{id}': no compiló con éxito\nuser_errors={:?}\n{}",
            compile.user_errors,
            log_tail(&log)
        );
        assert!(
            !log.contains("LaTeX Error"),
            "perfil '{id}': 'LaTeX Error' en el log"
        );
        checked += 1;
    }
    assert!(checked > 0, "no se compiló ningún perfil bundled (¿rutas?)");
}
