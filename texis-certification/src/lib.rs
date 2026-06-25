//! # texis-certification
//!
//! Certificación del núcleo documental (paso 16 / Etapa J). Ejecuta una matriz
//! de fixtures por el pipeline completo y comprueba los **gates estructurales**
//! que NO requieren un toolchain LaTeX:
//!
//! - importación a `DocumentIR` sin diagnósticos bloqueantes (en fixtures que
//!   deben pasar);
//! - validación de dominio (todos los módulos);
//! - construcción de plan + ensamblado + manifiesto;
//! - build determinista (mismas entradas → mismos artefactos/manifiesto);
//! - `main.tex` presente con fases en orden canónico.
//!
//! Los **gates de compilación** (compilar a PDF en XeLaTeX/LuaLaTeX/PdfLaTeX,
//! corpus de tesis reales 50/100/250 pág., regresión visual, PDF/A, fuentes
//! incrustadas) requieren la máquina del usuario y se ejecutan aparte; este crate
//! deja el contrato listo (`CompilationGate`) pero no los corre.

pub mod compile_gate;

use texis_document_application::{AssembleDocumentUseCase, BuildMode};
use texis_document_domain::ir::DocumentIR;
use texis_document_domain::phase::DocumentPhase;
use texis_document_domain::validation::validate_document;
use texis_document_infra::fixtures;
use texis_document_infra::{JsonIrSerializer, LatexRenderBackend, Sha256Hasher};

/// Resultado de un gate individual.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateResult {
    pub gate: String,
    pub passed: bool,
    pub detail: String,
}

impl GateResult {
    fn pass(gate: &str) -> Self {
        Self {
            gate: gate.to_string(),
            passed: true,
            detail: String::new(),
        }
    }
    fn fail(gate: &str, detail: impl Into<String>) -> Self {
        Self {
            gate: gate.to_string(),
            passed: false,
            detail: detail.into(),
        }
    }
}

/// Resultado de un caso de la matriz.
#[derive(Debug, Clone)]
pub struct CaseResult {
    pub name: String,
    pub gates: Vec<GateResult>,
}

impl CaseResult {
    pub fn passed(&self) -> bool {
        self.gates.iter().all(|g| g.passed)
    }
}

/// Informe de certificación estructural.
#[derive(Debug, Clone)]
pub struct CertificationReport {
    pub cases: Vec<CaseResult>,
}

impl CertificationReport {
    pub fn passed(&self) -> bool {
        self.cases.iter().all(|c| c.passed())
    }

    /// Resumen legible para CLI/CI.
    pub fn summary(&self) -> String {
        let mut out = String::new();
        for c in &self.cases {
            out.push_str(&format!(
                "{} {}\n",
                if c.passed() { "PASS" } else { "FAIL" },
                c.name
            ));
            for g in &c.gates {
                if !g.passed {
                    out.push_str(&format!("    ✗ {}: {}\n", g.gate, g.detail));
                }
            }
        }
        let total = self.cases.len();
        let ok = self.cases.iter().filter(|c| c.passed()).count();
        out.push_str(&format!("\n{ok}/{total} casos aprobados\n"));
        out
    }
}

/// Un caso de la matriz: nombre + constructor del IR (con bibliografía real).
struct MatrixCase {
    name: String,
    build: Box<dyn Fn() -> DocumentIR>,
}

impl MatrixCase {
    fn new(name: impl Into<String>, build: impl Fn() -> DocumentIR + 'static) -> Self {
        Self {
            name: name.into(),
            build: Box::new(build),
        }
    }
}

fn matrix() -> Vec<MatrixCase> {
    let mut cases = vec![
        MatrixCase::new("sample_thesis", fixtures::sample_thesis_ir),
        MatrixCase::new("stress_cover", fixtures::stress_cover_ir),
        // Migración fiel: portada/ToC no degradadas, back matter preservado.
        MatrixCase::new("migration_fixture", || {
            texis_document_infra::import_project(&fixtures::migration_fixture())
                .value
                .expect("IR de migración")
        }),
    ];

    // Los siete estilos bibliográficos objetivo (§7.5).
    for style in fixtures::TARGET_BIB_STYLES {
        cases.push(MatrixCase::new(
            format!("style_{style}"),
            move || fixtures::styled_thesis_ir(style),
        ));
    }

    // Tamaños sintéticos (aprox. 50/100/250 páginas).
    for chapters in [50usize, 100, 250] {
        cases.push(MatrixCase::new(
            format!("large_{chapters}ch"),
            move || fixtures::large_thesis_ir(chapters),
        ));
    }

    cases
}

/// Ejecuta la certificación estructural sobre toda la matriz.
pub fn run_structural_certification() -> CertificationReport {
    run_certification(false, false, false)
}

/// Ejecuta la certificación. Con `include_compile`, añade un caso que compila un
/// fixture mínimo a PDF real (Etapa J) si hay toolchain LaTeX disponible. Con
/// `compile_matrix`, además compila los 7 estilos (XeLaTeX+Biber) y los 3 motores
/// (XeLaTeX/LuaLaTeX/PdfLaTeX) a PDF real.
pub fn run_certification(
    include_compile: bool,
    strict: bool,
    compile_matrix: bool,
) -> CertificationReport {
    let mut cases: Vec<CaseResult> = matrix().into_iter().map(run_case).collect();
    if include_compile {
        cases.push(run_compile_case(strict));
    }
    if compile_matrix {
        cases.extend(run_compile_matrix(strict));
    }
    CertificationReport { cases }
}

/// Especificaciones de la matriz de compilación: nombre + IR a compilar.
/// Construir el IR es barato (no compila); separar esto permite probar el cableado
/// sin invocar el toolchain.
fn compile_matrix_specs() -> Vec<(String, DocumentIR)> {
    let mut specs = Vec::new();
    for style in fixtures::TARGET_BIB_STYLES {
        specs.push((
            format!("compile_style_{style}"),
            fixtures::compilable_styled_ir(style),
        ));
    }
    for engine in ["xelatex", "lualatex", "pdflatex"] {
        specs.push((
            format!("compile_engine_{engine}"),
            fixtures::compilable_with_engine_ir(engine),
        ));
    }
    specs
}

/// Matriz de compilación real: 7 estilos bibliográficos + 3 motores (§13.1).
fn run_compile_matrix(strict: bool) -> Vec<CaseResult> {
    compile_matrix_specs()
        .into_iter()
        .map(|(name, ir)| compile_case(&name, ir, strict))
        .collect()
}

fn run_compile_case(strict: bool) -> CaseResult {
    compile_case("compilable_thesis (PDF)", fixtures::compilable_thesis_ir(), strict)
}

fn compile_case(
    name: &str,
    ir: texis_document_domain::ir::DocumentIR,
    strict: bool,
) -> CaseResult {
    let mut gates = Vec::new();
    match compile_gate::compile(&ir) {
        Ok(o) if !o.attempted => {
            gates.push(GateResult::fail(
                "compile_pdf",
                "omitido: toolchain LaTeX no disponible (ejecutar en máquina con LaTeX)",
            ));
        }
        Ok(o) if o.produced_pdf && o.compiler_success => {
            gates.push(GateResult::pass("compile_pdf"));
            match o.postflight {
                Some(postflight) => {
                    if postflight.passed {
                        gates.push(GateResult::pass("postflight"));
                    } else {
                        let codes = postflight
                            .issues
                            .iter()
                            .filter(|issue| {
                                issue.severity == texis_core::postflight::PdfIssueSeverity::Error
                            })
                            .map(|issue| issue.code.as_str())
                            .collect::<Vec<_>>();
                        gates.push(GateResult::fail(
                            "postflight",
                            format!("errores: {codes:?}"),
                        ));
                    }
                    if postflight.all_fonts_embedded {
                        gates.push(GateResult::pass("fonts_embedded"));
                    } else {
                        gates.push(GateResult::fail(
                            "fonts_embedded",
                            format!("{:?}", postflight.non_embedded_fonts),
                        ));
                    }
                    if strict {
                        let essential = ["pdfinfo", "pdffonts", "pdftotext"];
                        let missing = essential
                            .iter()
                            .filter(|tool| {
                                postflight
                                    .tools_missing
                                    .iter()
                                    .any(|missing| missing == **tool)
                            })
                            .copied()
                            .collect::<Vec<_>>();
                        if missing.is_empty() {
                            gates.push(GateResult::pass("postflight_tools"));
                        } else {
                            gates.push(GateResult::fail(
                                "postflight_tools",
                                format!("faltan: {missing:?}"),
                            ));
                        }
                        if ir.profile.policy.delivery.require_pdfa {
                            match postflight.pdfa {
                                Some(check) if check.compliant => {
                                    gates.push(GateResult::pass("pdfa"))
                                }
                                Some(check) => gates.push(GateResult::fail("pdfa", check.summary)),
                                None => {
                                    gates.push(GateResult::fail("pdfa", "veraPDF no disponible"))
                                }
                            }
                        }
                    }
                }
                None => gates.push(GateResult::fail(
                    "postflight",
                    "no se produjo resultado de postflight",
                )),
            }
        }
        Ok(o) => gates.push(GateResult::fail("compile_pdf", o.log_tail)),
        Err(e) => gates.push(GateResult::fail("compile_pdf", e.to_string())),
    }
    CaseResult {
        name: name.to_string(),
        gates,
    }
}

fn run_case(case: MatrixCase) -> CaseResult {
    let mut gates = Vec::new();

    // Gate 1: IR construido (importado + bibliografía real adjunta).
    let ir = (case.build)();
    gates.push(GateResult::pass("import"));

    // Gate 2: validación de dominio sin errores bloqueantes.
    let diags = validate_document(&ir);
    if diags.has_blocking() {
        let codes: Vec<&str> = diags.errors().map(|d| d.code.as_str()).collect();
        gates.push(GateResult::fail(
            "validation",
            format!("bloqueantes: {codes:?}"),
        ));
    } else {
        gates.push(GateResult::pass("validation"));
    }

    // Gate 3: el pipeline bloqueante en modo Final produce el documento.
    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );
    let assembled = match use_case.execute(&ir, BuildMode::Final) {
        Ok(a) => {
            gates.push(GateResult::pass("pipeline_final"));
            a
        }
        Err(e) => {
            let codes: Vec<&str> = e.diagnostics.errors().map(|d| d.code.as_str()).collect();
            gates.push(GateResult::fail(
                "pipeline_final",
                format!("bloqueado: {codes:?}"),
            ));
            return CaseResult {
                name: case.name.to_string(),
                gates,
            };
        }
    };

    match assembled.rendered.main_tex() {
        Some(_) => gates.push(GateResult::pass("assemble_main_tex")),
        None => gates.push(GateResult::fail("assemble_main_tex", "sin main.tex")),
    }
    let phases: Vec<DocumentPhase> = assembled.plan.phases.iter().map(|p| p.phase).collect();
    let canonical: Vec<DocumentPhase> = DocumentPhase::ORDER
        .iter()
        .copied()
        .filter(|p| phases.contains(p))
        .collect();
    if phases == canonical {
        gates.push(GateResult::pass("phase_order_canonical"));
    } else {
        gates.push(GateResult::fail(
            "phase_order_canonical",
            format!("{phases:?}"),
        ));
    }

    // Gate 4: build determinista.
    if let Ok(again) = use_case.execute(&ir, BuildMode::Final) {
        if again.manifest == assembled.manifest && again.rendered.files == assembled.rendered.files
        {
            gates.push(GateResult::pass("deterministic_build"));
        } else {
            gates.push(GateResult::fail(
                "deterministic_build",
                "manifiesto/artefactos divergen",
            ));
        }
    } else {
        gates.push(GateResult::fail(
            "deterministic_build",
            "segundo build falló",
        ));
    }

    CaseResult {
        name: case.name.to_string(),
        gates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn structural_certification_passes() {
        let report = run_structural_certification();
        assert!(
            report.passed(),
            "certificación estructural falló:\n{}",
            report.summary()
        );
        // Base (2) + migración (1) + 7 estilos + 3 tamaños = 13 casos.
        assert_eq!(report.cases.len(), 13);
        assert!(report.cases.iter().any(|c| c.name == "style_gbt7714"));
        assert!(report.cases.iter().any(|c| c.name == "large_250ch"));
    }

    #[test]
    fn compile_matrix_wiring_cubre_estilos_y_motores() {
        // Estructura de la matriz de compilación SIN invocar el toolchain.
        let names: Vec<String> = compile_matrix_specs()
            .into_iter()
            .map(|(name, _)| name)
            .collect();
        assert_eq!(names.len(), 10); // 7 estilos + 3 motores
        for style in fixtures::TARGET_BIB_STYLES {
            assert!(names.contains(&format!("compile_style_{style}")));
        }
        for engine in ["xelatex", "lualatex", "pdflatex"] {
            assert!(names.contains(&format!("compile_engine_{engine}")));
        }
    }
}
