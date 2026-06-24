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
    name: &'static str,
    build: fn() -> DocumentIR,
}

fn matrix() -> Vec<MatrixCase> {
    vec![
        MatrixCase {
            name: "sample_thesis",
            build: fixtures::sample_thesis_ir,
        },
        MatrixCase {
            name: "stress_cover",
            build: fixtures::stress_cover_ir,
        },
    ]
}

/// Ejecuta la certificación estructural sobre toda la matriz.
pub fn run_structural_certification() -> CertificationReport {
    run_certification(false, false)
}

/// Ejecuta la certificación. Con `include_compile`, añade un caso que compila un
/// fixture mínimo a PDF real (Etapa J) si hay toolchain LaTeX disponible.
pub fn run_certification(include_compile: bool, strict: bool) -> CertificationReport {
    let mut cases: Vec<CaseResult> = matrix().into_iter().map(run_case).collect();
    if include_compile {
        cases.push(run_compile_case(strict));
    }
    CertificationReport { cases }
}

fn run_compile_case(strict: bool) -> CaseResult {
    let mut gates = Vec::new();
    let ir = fixtures::compilable_thesis_ir();
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
        name: "compilable_thesis (PDF)".to_string(),
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
        assert_eq!(report.cases.len(), 2);
    }
}
