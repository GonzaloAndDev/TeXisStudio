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

use texis_document_application::AssembleDocumentUseCase;
use texis_document_domain::phase::DocumentPhase;
use texis_document_domain::validation::validate_document;
use texis_document_infra::fixtures;
use texis_document_infra::{
    import_project, JsonIrSerializer, LatexRenderBackend, Sha256Hasher,
};
use texis_core::project::model::ProjectModel;

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

/// Un caso de la matriz: nombre + constructor del proyecto.
struct MatrixCase {
    name: &'static str,
    build: fn() -> ProjectModel,
}

fn matrix() -> Vec<MatrixCase> {
    vec![
        MatrixCase {
            name: "sample_thesis",
            build: fixtures::sample_thesis,
        },
        MatrixCase {
            name: "stress_cover",
            build: fixtures::stress_cover_thesis,
        },
    ]
}

/// Ejecuta la certificación estructural sobre toda la matriz.
pub fn run_structural_certification() -> CertificationReport {
    let cases = matrix().into_iter().map(run_case).collect();
    CertificationReport { cases }
}

fn run_case(case: MatrixCase) -> CaseResult {
    let mut gates = Vec::new();
    let model = (case.build)();

    // Gate 1: importación produce IR.
    let resolution = import_project(&model);
    let ir = match resolution.value {
        Some(ir) => {
            gates.push(GateResult::pass("import"));
            ir
        }
        None => {
            gates.push(GateResult::fail("import", "no se produjo DocumentIR"));
            return CaseResult {
                name: case.name.to_string(),
                gates,
            };
        }
    };

    // Gate 2: validación de dominio sin errores bloqueantes.
    let diags = validate_document(&ir);
    if diags.has_blocking() {
        let codes: Vec<&str> = diags
            .errors()
            .map(|d| d.code.as_str())
            .collect();
        gates.push(GateResult::fail("validation", format!("bloqueantes: {codes:?}")));
    } else {
        gates.push(GateResult::pass("validation"));
    }

    // Gate 3: ensamblado produce main.tex con fases canónicas.
    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );
    let assembled = use_case.execute(&ir);
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
        gates.push(GateResult::fail("phase_order_canonical", format!("{phases:?}")));
    }

    // Gate 4: build determinista.
    let again = use_case.execute(&ir);
    if again.manifest == assembled.manifest && again.rendered.files == assembled.rendered.files {
        gates.push(GateResult::pass("deterministic_build"));
    } else {
        gates.push(GateResult::fail("deterministic_build", "manifiesto/artefactos divergen"));
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
        assert!(report.passed(), "certificación estructural falló:\n{}", report.summary());
        assert_eq!(report.cases.len(), 2);
    }
}
