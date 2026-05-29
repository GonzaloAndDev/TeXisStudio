use crate::texis_project::model::{BibliographyTool, BuildConfig, GlossaryTool, IndexTool, LatexEngine};
use std::path::PathBuf;
use uuid::Uuid;

pub type BuildId = Uuid;

/// Modo de compilación.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuildMode {
    /// Ciclo completo: compile → bib → glossary → compile × 2-3
    Full,
    /// Solo LaTeX, una pasada — para edición rápida
    Quick,
    /// Con draft=true — sin imágenes grandes
    Draft,
    /// Eliminar archivos auxiliares
    Clean,
}

/// Un paso individual del plan de compilación.
#[derive(Debug, Clone)]
pub struct BuildStep {
    pub kind: BuildStepKind,
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: PathBuf,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuildStepKind {
    LatexCompile { pass: u8 },
    Biber,
    BibTeX,
    MakeGlossaries,
    Bib2Gls,
    MakeIndex,
    Xindy,
    PostflightCheck,
    CleanAux,
}

impl std::fmt::Display for BuildStepKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BuildStepKind::LatexCompile { pass } => write!(f, "latex-pass-{}", pass),
            BuildStepKind::Biber => write!(f, "biber"),
            BuildStepKind::BibTeX => write!(f, "bibtex"),
            BuildStepKind::MakeGlossaries => write!(f, "makeglossaries"),
            BuildStepKind::Bib2Gls => write!(f, "bib2gls"),
            BuildStepKind::MakeIndex => write!(f, "makeindex"),
            BuildStepKind::Xindy => write!(f, "xindy"),
            BuildStepKind::PostflightCheck => write!(f, "postflight"),
            BuildStepKind::CleanAux => write!(f, "clean"),
        }
    }
}

/// Plan completo de compilación.
#[derive(Debug)]
pub struct BuildPlan {
    pub id: BuildId,
    pub mode: BuildMode,
    pub steps: Vec<BuildStep>,
    pub root_file: PathBuf,
    pub output_dir: PathBuf,
}

/// Constructor de planes de compilación.
pub struct BuildPlanBuilder;

impl BuildPlanBuilder {
    /// Construye un plan de compilación Full para el proyecto dado.
    pub fn build_full(
        config: &BuildConfig,
        root_file: &PathBuf,
        project_root: &PathBuf,
        needs_glossary: bool,
        needs_index: bool,
    ) -> BuildPlan {
        let mut steps = Vec::new();
        let output_dir = project_root.join(&config.output_dir);
        let stem = root_file
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("main");

        // Primera pasada LaTeX
        steps.push(BuildStep {
            kind: BuildStepKind::LatexCompile { pass: 1 },
            command: config.engine.to_string(),
            args: latex_args(config, root_file, &output_dir, false),
            working_dir: project_root.clone(),
            timeout_secs: 120,
        });

        // Bibliografía
        match &config.bibliography_tool {
            BibliographyTool::Biber => {
                steps.push(BuildStep {
                    kind: BuildStepKind::Biber,
                    command: "biber".to_string(),
                    args: vec![
                        format!("--output-directory={}", output_dir.display()),
                        stem.to_string(),
                    ],
                    working_dir: project_root.clone(),
                    timeout_secs: 60,
                });
            }
            BibliographyTool::BibTeX => {
                steps.push(BuildStep {
                    kind: BuildStepKind::BibTeX,
                    command: "bibtex".to_string(),
                    args: vec![format!("{}/{}", output_dir.display(), stem)],
                    working_dir: project_root.clone(),
                    timeout_secs: 60,
                });
            }
            BibliographyTool::None => {}
        }

        // Glosarios
        if needs_glossary {
            match &config.glossary_tool {
                Some(GlossaryTool::MakeGlossaries) => {
                    steps.push(BuildStep {
                        kind: BuildStepKind::MakeGlossaries,
                        command: "makeglossaries".to_string(),
                        args: vec![
                            "-d".to_string(),
                            output_dir.display().to_string(),
                            stem.to_string(),
                        ],
                        working_dir: project_root.clone(),
                        timeout_secs: 30,
                    });
                }
                Some(GlossaryTool::Bib2Gls) => {
                    steps.push(BuildStep {
                        kind: BuildStepKind::Bib2Gls,
                        command: "bib2gls".to_string(),
                        args: vec![
                            format!("--dir={}", output_dir.display()),
                            stem.to_string(),
                        ],
                        working_dir: project_root.clone(),
                        timeout_secs: 30,
                    });
                }
                None => {}
            }
        }

        // Índice analítico
        if needs_index {
            match &config.index_tool {
                Some(IndexTool::MakeIndex) => {
                    steps.push(BuildStep {
                        kind: BuildStepKind::MakeIndex,
                        command: "makeindex".to_string(),
                        args: vec![format!("{}/{}.idx", output_dir.display(), stem)],
                        working_dir: project_root.clone(),
                        timeout_secs: 30,
                    });
                }
                Some(IndexTool::Xindy) => {
                    steps.push(BuildStep {
                        kind: BuildStepKind::Xindy,
                        command: "xindy".to_string(),
                        args: vec![format!("{}/{}.idx", output_dir.display(), stem)],
                        working_dir: project_root.clone(),
                        timeout_secs: 30,
                    });
                }
                None => {}
            }
        }

        // Segunda pasada LaTeX
        steps.push(BuildStep {
            kind: BuildStepKind::LatexCompile { pass: 2 },
            command: config.engine.to_string(),
            args: latex_args(config, root_file, &output_dir, false),
            working_dir: project_root.clone(),
            timeout_secs: 120,
        });

        // Tercera pasada (para referencias que necesitan otra pasada)
        steps.push(BuildStep {
            kind: BuildStepKind::LatexCompile { pass: 3 },
            command: config.engine.to_string(),
            args: latex_args(config, root_file, &output_dir, false),
            working_dir: project_root.clone(),
            timeout_secs: 120,
        });

        // Postflight
        steps.push(BuildStep {
            kind: BuildStepKind::PostflightCheck,
            command: "".to_string(),
            args: vec![],
            working_dir: project_root.clone(),
            timeout_secs: 10,
        });

        BuildPlan {
            id: Uuid::new_v4(),
            mode: BuildMode::Full,
            steps,
            root_file: root_file.clone(),
            output_dir,
        }
    }

    /// Plan Quick: solo una pasada LaTeX.
    pub fn build_quick(
        config: &BuildConfig,
        root_file: &PathBuf,
        project_root: &PathBuf,
    ) -> BuildPlan {
        let output_dir = project_root.join(&config.output_dir);
        BuildPlan {
            id: Uuid::new_v4(),
            mode: BuildMode::Quick,
            steps: vec![
                BuildStep {
                    kind: BuildStepKind::LatexCompile { pass: 1 },
                    command: config.engine.to_string(),
                    args: latex_args(config, root_file, &output_dir, false),
                    working_dir: project_root.clone(),
                    timeout_secs: 120,
                },
                BuildStep {
                    kind: BuildStepKind::PostflightCheck,
                    command: "".to_string(),
                    args: vec![],
                    working_dir: project_root.clone(),
                    timeout_secs: 10,
                },
            ],
            root_file: root_file.clone(),
            output_dir,
        }
    }

    /// Plan Draft: una pasada con draft=true.
    pub fn build_draft(
        config: &BuildConfig,
        root_file: &PathBuf,
        project_root: &PathBuf,
    ) -> BuildPlan {
        let output_dir = project_root.join(&config.output_dir);
        BuildPlan {
            id: Uuid::new_v4(),
            mode: BuildMode::Draft,
            steps: vec![BuildStep {
                kind: BuildStepKind::LatexCompile { pass: 1 },
                command: config.engine.to_string(),
                args: latex_args(config, root_file, &output_dir, true),
                working_dir: project_root.clone(),
                timeout_secs: 60,
            }],
            root_file: root_file.clone(),
            output_dir,
        }
    }
}

fn latex_args(
    config: &BuildConfig,
    root_file: &PathBuf,
    output_dir: &PathBuf,
    draft: bool,
) -> Vec<String> {
    let mut args = vec![
        "-interaction=nonstopmode".to_string(),
        "-file-line-error".to_string(),
        format!("-output-directory={}", output_dir.display()),
    ];
    if config.synctex {
        args.push("-synctex=1".to_string());
    }
    if draft {
        args.push("-draftmode".to_string());
    }
    // NUNCA añadir -shell-escape aquí. Solo si config.shell_escape == true
    // y esa flag solo se activa con confirmación explícita del usuario.
    if config.shell_escape {
        args.push("-shell-escape".to_string());
    }
    args.push(root_file.display().to_string());
    args
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::texis_project::model::BuildConfig;

    fn default_config() -> BuildConfig {
        BuildConfig::default()
    }

    #[test]
    fn full_plan_has_three_latex_passes() {
        let cfg = default_config();
        let root = PathBuf::from("main.tex");
        let project = PathBuf::from("/tmp/project");
        let plan = BuildPlanBuilder::build_full(&cfg, &root, &project, false, false);
        let latex_passes: Vec<_> = plan
            .steps
            .iter()
            .filter(|s| matches!(s.kind, BuildStepKind::LatexCompile { .. }))
            .collect();
        assert_eq!(latex_passes.len(), 3);
    }

    #[test]
    fn full_plan_includes_biber_when_configured() {
        let cfg = default_config(); // Biber por defecto
        let plan = BuildPlanBuilder::build_full(
            &cfg,
            &PathBuf::from("main.tex"),
            &PathBuf::from("/tmp"),
            false,
            false,
        );
        assert!(plan.steps.iter().any(|s| s.kind == BuildStepKind::Biber));
    }

    #[test]
    fn full_plan_includes_makeglossaries_when_needed() {
        let mut cfg = default_config();
        cfg.glossary_tool = Some(GlossaryTool::MakeGlossaries);
        let plan = BuildPlanBuilder::build_full(
            &cfg,
            &PathBuf::from("main.tex"),
            &PathBuf::from("/tmp"),
            true, // needs_glossary
            false,
        );
        assert!(plan.steps.iter().any(|s| s.kind == BuildStepKind::MakeGlossaries));
    }

    #[test]
    fn quick_plan_has_one_latex_pass() {
        let cfg = default_config();
        let plan = BuildPlanBuilder::build_quick(
            &cfg,
            &PathBuf::from("main.tex"),
            &PathBuf::from("/tmp"),
        );
        let latex_passes: Vec<_> = plan
            .steps
            .iter()
            .filter(|s| matches!(s.kind, BuildStepKind::LatexCompile { .. }))
            .collect();
        assert_eq!(latex_passes.len(), 1);
    }

    #[test]
    fn shell_escape_off_by_default_in_args() {
        let cfg = default_config();
        let args = latex_args(&cfg, &PathBuf::from("main.tex"), &PathBuf::from("/tmp/build"), false);
        assert!(!args.iter().any(|a| a == "-shell-escape"),
            "shell-escape NO debe estar en los args por defecto");
    }

    #[test]
    fn shell_escape_only_when_explicitly_enabled() {
        let mut cfg = default_config();
        cfg.shell_escape = true;
        let args = latex_args(&cfg, &PathBuf::from("main.tex"), &PathBuf::from("/tmp/build"), false);
        assert!(args.iter().any(|a| a == "-shell-escape"));
    }
}
