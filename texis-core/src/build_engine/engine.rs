use super::plan::{BuildMode, BuildPlan, BuildPlanBuilder, BuildStep, BuildStepKind};
use super::result::{BuildFailureKind, BuildResult, BuildStepResult};
use super::toolchain::{detect_toolchain, Toolchain};
use crate::diagnostics::engine::DiagnosticsEngine;
use crate::texis_project::model::TexisProject;
use std::path::PathBuf;
use std::time::Instant;
use uuid::Uuid;

pub struct BuildEngine {
    pub toolchain: Toolchain,
}

impl BuildEngine {
    pub fn new() -> Self {
        Self { toolchain: detect_toolchain() }
    }

    /// Compila el proyecto en modo Full.
    pub fn build_full(&self, project: &TexisProject) -> BuildResult {
        let id = Uuid::new_v4();

        // Validar toolchain
        let missing = self.toolchain.validate_for_config(&project.build_config);
        if !missing.is_empty() {
            return BuildResult::failed(
                id,
                BuildMode::Full,
                BuildFailureKind::ToolNotFound { tool: missing[0].clone() },
            );
        }

        // Verificar que el archivo raíz existe
        if !project.root_file_abs().exists() {
            return BuildResult::failed(
                id,
                BuildMode::Full,
                BuildFailureKind::InvalidRootFile,
            );
        }

        // Determinar si hay glosarios e índice
        let needs_glossary = project.build_config.glossary_tool.is_some();
        let needs_index = project.build_config.index_tool.is_some();

        let plan = BuildPlanBuilder::build_full(
            &project.build_config,
            &project.root_file,
            &project.root_path,
            needs_glossary,
            needs_index,
        );

        self.execute_plan(plan, project)
    }

    /// Compilación rápida (una sola pasada LaTeX).
    pub fn build_quick(&self, project: &TexisProject) -> BuildResult {
        let id = Uuid::new_v4();

        let missing = self.toolchain.validate_for_config(&project.build_config);
        if !missing.is_empty() {
            return BuildResult::failed(
                id,
                BuildMode::Quick,
                BuildFailureKind::ToolNotFound { tool: missing[0].clone() },
            );
        }

        let plan = BuildPlanBuilder::build_quick(
            &project.build_config,
            &project.root_file,
            &project.root_path,
        );
        self.execute_plan(plan, project)
    }

    fn execute_plan(&self, plan: BuildPlan, project: &TexisProject) -> BuildResult {
        let build_start = Instant::now();
        let mut step_results: Vec<BuildStepResult> = Vec::new();
        let mut skip_remaining = false;

        // Asegurar que el directorio de output existe
        if let Err(e) = std::fs::create_dir_all(&plan.output_dir) {
            return BuildResult::failed(
                plan.id,
                plan.mode,
                BuildFailureKind::Unknown { message: e.to_string() },
            );
        }

        for step in &plan.steps {
            if skip_remaining && step.kind != BuildStepKind::PostflightCheck {
                continue;
            }

            let step_result = if step.kind == BuildStepKind::PostflightCheck {
                self.run_postflight(&plan.output_dir, &plan.root_file)
            } else {
                self.run_step(step)
            };

            // Si hay emergency stop → no continuar con más pasos LaTeX
            if step_result.has_emergency_stop() {
                skip_remaining = true;
            }

            // Detectar si ya no se necesita una tercera pasada (no hubo cambio de labels)
            if matches!(step.kind, BuildStepKind::LatexCompile { pass: 2 }) {
                if !step_result.needs_rerun() {
                    // Marcar la tercera pasada como innecesaria
                    // (la ejecutamos igual por simplicidad, latexmk lo haría igual)
                }
            }

            step_results.push(step_result);
        }

        let total_duration_ms = build_start.elapsed().as_millis() as u64;

        // Calcular éxito: el último paso LaTeX debe haber tenido exit_code 0 o el PDF existe
        let pdf_path = self.find_pdf(&plan.output_dir, &plan.root_file);
        let latex_success = step_results
            .iter()
            .filter(|s| matches!(s.kind, BuildStepKind::LatexCompile { .. }))
            .last()
            .map(|s| s.success || pdf_path.is_some())
            .unwrap_or(false);

        // Diagnostics: parsear logs de todos los pasos
        let mut all_logs = String::new();
        for sr in &step_results {
            all_logs.push_str(&sr.stdout);
            all_logs.push('\n');
        }
        let diagnostics = DiagnosticsEngine::parse_latex_log(&all_logs, &project.root_path);

        let rerun_needed = step_results
            .last()
            .map(|s| s.needs_rerun())
            .unwrap_or(false);

        BuildResult {
            id: plan.id,
            mode: plan.mode,
            success: latex_success,
            steps: step_results,
            pdf_path,
            total_duration_ms,
            diagnostics,
            rerun_needed,
            failure: if !latex_success {
                Some(BuildFailureKind::CompileError)
            } else {
                None
            },
            finished_at: chrono::Utc::now(),
        }
    }

    fn run_step(&self, step: &BuildStep) -> BuildStepResult {
        let step_start = Instant::now();

        // Verificar que la herramienta está en la allowlist
        let command_name = PathBuf::from(&step.command)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&step.command)
            .to_string();

        if !super::toolchain::ALLOWED_TOOLS.contains(&command_name.as_str()) {
            return BuildStepResult {
                kind: step.kind.clone(),
                exit_code: None,
                stdout: String::new(),
                stderr: format!("Herramienta '{}' no está en la lista de herramientas permitidas.", command_name),
                duration_ms: 0,
                success: false,
            };
        }

        let output = std::process::Command::new(&step.command)
            .args(&step.args)
            .current_dir(&step.working_dir)
            .output();

        let duration_ms = step_start.elapsed().as_millis() as u64;

        match output {
            Ok(out) => BuildStepResult {
                kind: step.kind.clone(),
                exit_code: out.status.code(),
                stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                duration_ms,
                success: out.status.success(),
            },
            Err(e) => BuildStepResult {
                kind: step.kind.clone(),
                exit_code: None,
                stdout: String::new(),
                stderr: e.to_string(),
                duration_ms,
                success: false,
            },
        }
    }

    fn run_postflight(&self, output_dir: &PathBuf, root_file: &PathBuf) -> BuildStepResult {
        let stem = root_file
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("main");
        let pdf_path = output_dir.join(format!("{}.pdf", stem));

        let success = pdf_path.exists() && pdf_path.metadata().map(|m| m.len() > 0).unwrap_or(false);

        BuildStepResult {
            kind: BuildStepKind::PostflightCheck,
            exit_code: if success { Some(0) } else { Some(1) },
            stdout: if success {
                format!("PDF generado: {}", pdf_path.display())
            } else {
                format!("PDF no encontrado o vacío: {}", pdf_path.display())
            },
            stderr: String::new(),
            duration_ms: 0,
            success,
        }
    }

    fn find_pdf(&self, output_dir: &PathBuf, root_file: &PathBuf) -> Option<PathBuf> {
        let stem = root_file.file_stem().and_then(|s| s.to_str()).unwrap_or("main");
        let pdf = output_dir.join(format!("{}.pdf", stem));
        if pdf.exists() { Some(pdf) } else { None }
    }
}

impl Default for BuildEngine {
    fn default() -> Self {
        Self::new()
    }
}
