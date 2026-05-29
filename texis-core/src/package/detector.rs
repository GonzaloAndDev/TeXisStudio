use super::model::{
    ConflictResolution, PackageAnalysis, PackageConflict, PackagePriority, PackageRequirement,
    RequirementReason,
};
use std::collections::HashSet;

// ── Reglas de detección ───────────────────────────────────────────────────────

struct DetectionRule {
    pattern: &'static str,
    package: &'static str,
    reason: RequirementReason,
    priority: PackagePriority,
}

const DETECTION_RULES: &[DetectionRule] = &[
    // Gráficos
    DetectionRule {
        pattern: r"\includegraphics",
        package: "graphicx",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{subfigure}",
        package: "subcaption",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{figure}",
        package: "graphicx",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Recommended,
    },
    // Tablas
    DetectionRule {
        pattern: r"\toprule",
        package: "booktabs",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\midrule",
        package: "booktabs",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\bottomrule",
        package: "booktabs",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{tabularx}",
        package: "tabularx",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{longtable}",
        package: "longtable",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{tblr}",
        package: "tabularray",
        reason: RequirementReason::Table,
        priority: PackagePriority::Required,
    },
    // Referencias cruzadas
    DetectionRule {
        pattern: r"\cref",
        package: "cleveref",
        reason: RequirementReason::CrossReference,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\Cref",
        package: "cleveref",
        reason: RequirementReason::CrossReference,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\autoref",
        package: "hyperref",
        reason: RequirementReason::CrossReference,
        priority: PackagePriority::Recommended,
    },
    // Glosarios
    DetectionRule {
        pattern: r"\gls{",
        package: "glossaries",
        reason: RequirementReason::Glossary,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\newacronym",
        package: "glossaries",
        reason: RequirementReason::Glossary,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\printglossary",
        package: "glossaries",
        reason: RequirementReason::Glossary,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\makeglossaries",
        package: "glossaries",
        reason: RequirementReason::Glossary,
        priority: PackagePriority::Required,
    },
    // Bibliografía
    DetectionRule {
        pattern: r"\addbibresource",
        package: "biblatex",
        reason: RequirementReason::Bibliography,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\printbibliography",
        package: "biblatex",
        reason: RequirementReason::Bibliography,
        priority: PackagePriority::Required,
    },
    // Código
    DetectionRule {
        pattern: r"\begin{lstlisting}",
        package: "listings",
        reason: RequirementReason::Code,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{minted}",
        package: "minted",
        reason: RequirementReason::Code,
        priority: PackagePriority::Required,
    },
    // Algoritmos
    DetectionRule {
        pattern: r"\begin{algorithm}",
        package: "algorithm2e",
        reason: RequirementReason::Algorithm,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{algorithmic}",
        package: "algorithmicx",
        reason: RequirementReason::Algorithm,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Física y Matemáticas ───────────────────────────
    // siunitx: unidades físicas \SI{}, \si{}, \num{}
    DetectionRule {
        pattern: r"\SI{",
        package: "siunitx",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\si{",
        package: "siunitx",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\num{",
        package: "siunitx",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // physics: operadores como \abs{}, \norm{}, \dv{}, \pdv{}
    DetectionRule {
        pattern: r"\dv{",
        package: "physics",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\pdv{",
        package: "physics",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\abs{",
        package: "physics",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\norm{",
        package: "physics",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // mathtools: extensiones de amsmath (\coloneqq, \prescript, etc.)
    DetectionRule {
        pattern: r"\coloneqq",
        package: "mathtools",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\prescript",
        package: "mathtools",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // cancel: flechas de cancelación \cancel{}, \bcancel{}
    DetectionRule {
        pattern: r"\cancel{",
        package: "cancel",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // bm: negritas en modo math \bm{}
    DetectionRule {
        pattern: r"\bm{",
        package: "bm",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // xfrac: fracciones con estilo \sfrac{}{}
    DetectionRule {
        pattern: r"\sfrac{",
        package: "xfrac",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Química ────────────────────────────────────────
    // mhchem: reacciones químicas \ce{}
    DetectionRule {
        pattern: r"\ce{",
        package: "mhchem",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // chemfig: estructuras moleculares \chemfig{}
    DetectionRule {
        pattern: r"\chemfig{",
        package: "chemfig",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{reaction}",
        package: "chemmacros",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Ingeniería eléctrica / electrónica ─────────────
    // circuitikz: diagramas de circuitos
    DetectionRule {
        pattern: r"\begin{circuitikz}",
        package: "circuitikz",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{tikzpicture}",
        package: "tikz",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // pgfplots: gráficos de funciones y datos
    DetectionRule {
        pattern: r"\begin{axis}",
        package: "pgfplots",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{tikzcd}",
        package: "tikz-cd",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Física cuántica / partículas ───────────────────
    // feynmf/feynmp: diagramas de Feynman
    DetectionRule {
        pattern: r"\begin{fmfgraph}",
        package: "feynmf",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{feynman}",
        package: "tikz-feynman",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Lógica / Matemáticas discretas ─────────────────
    // proof trees
    DetectionRule {
        pattern: r"\begin{prooftree}",
        package: "bussproofs",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{nd}",
        package: "logicproof",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Lingüística ────────────────────────────────────
    // gb4e / expex: ejemplos numerados
    DetectionRule {
        pattern: r"\begin{exe}",
        package: "gb4e",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\ex ",
        package: "expex",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Optional,
    },
    // IPA: phonetic transcription
    DetectionRule {
        pattern: r"\textipa{",
        package: "tipa",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // Trees / syntax trees
    DetectionRule {
        pattern: r"\begin{forest}",
        package: "forest",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\Tree[",
        package: "qtree",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // ── Notación disciplinar — Economía / estadística ─────────────────────────
    // econometric notation
    DetectionRule {
        pattern: r"\begin{equation*}",
        package: "amsmath",
        reason: RequirementReason::Discipline,
        priority: PackagePriority::Required,
    },
    // dataplot
    DetectionRule {
        pattern: r"\begin{tabular}{",
        package: "array",
        reason: RequirementReason::Table,
        priority: PackagePriority::Recommended,
    },
    // ── Assets especializados — integración externa ────────────────────────────
    // PDF pages: incluir páginas de PDF como figuras
    DetectionRule {
        pattern: r"\includepdf",
        package: "pdfpages",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    // SVG
    DetectionRule {
        pattern: r"\includesvg",
        package: "svg",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    // Rotación de páginas/figuras
    DetectionRule {
        pattern: r"\begin{landscape}",
        package: "pdflscape",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{sideways}",
        package: "rotating",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    // Multicolumna
    DetectionRule {
        pattern: r"\begin{multicols}",
        package: "multicol",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    // Cajas de color / advertencias
    DetectionRule {
        pattern: r"\begin{tcolorbox}",
        package: "tcolorbox",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
    DetectionRule {
        pattern: r"\begin{mdframed}",
        package: "mdframed",
        reason: RequirementReason::Asset,
        priority: PackagePriority::Required,
    },
];

// ── Conflictos conocidos ──────────────────────────────────────────────────────

fn known_conflicts() -> Vec<PackageConflict> {
    vec![
        PackageConflict {
            package_a: "natbib".into(),
            package_b: "biblatex".into(),
            description: "natbib y biblatex son incompatibles. Usa solo biblatex con biber.".into(),
            resolution: ConflictResolution::RemoveA,
            is_blocking: true,
        },
        PackageConflict {
            package_a: "subfigure".into(),
            package_b: "subcaption".into(),
            description: "subfigure es obsoleto. subcaption es la alternativa moderna.".into(),
            resolution: ConflictResolution::RemoveA,
            is_blocking: false,
        },
        PackageConflict {
            package_a: "glossary".into(),
            package_b: "glossaries".into(),
            description: "glossary es obsoleto. Usa glossaries.".into(),
            resolution: ConflictResolution::RemoveA,
            is_blocking: false,
        },
        PackageConflict {
            package_a: "tabularray".into(),
            package_b: "booktabs".into(),
            description:
                "tabularray incluye la funcionalidad de booktabs. Considera usar solo tabularray."
                    .into(),
            resolution: ConflictResolution::Informational,
            is_blocking: false,
        },
    ]
}

/// Verifica si cleveref está cargado antes de hyperref (debe ser después).
fn check_cleveref_order(preamble: &str) -> Option<PackageConflict> {
    let cleveref_pos = preamble
        .find(r"\usepackage{cleveref}")
        .or_else(|| preamble.find(r"\usepackage[capitalise]{cleveref}"))
        .or_else(|| preamble.find(r"\usepackage[noabbrev]{cleveref}"));
    let hyperref_pos = preamble
        .find(r"\usepackage{hyperref}")
        .or_else(|| preamble.find(r"\usepackage[hidelinks]{hyperref}"))
        .or_else(|| preamble.find(r"\usepackage[colorlinks]{hyperref}"));

    match (cleveref_pos, hyperref_pos) {
        (Some(c), Some(h)) if c < h => Some(PackageConflict {
            package_a: "cleveref".into(),
            package_b: "hyperref".into(),
            description: "cleveref debe cargarse DESPUÉS de hyperref.".into(),
            resolution: ConflictResolution::LoadOrderFix,
            is_blocking: false,
        }),
        _ => None,
    }
}

// ── PackageDetector ───────────────────────────────────────────────────────────

pub struct PackageDetector;

impl PackageDetector {
    pub fn new() -> Self {
        Self
    }

    /// Analiza el contenido del proyecto y retorna el análisis de paquetes.
    ///
    /// `tex_sources`: contenido de todos los archivos .tex del proyecto.
    /// `preamble`: contenido del preamble.tex.
    pub fn analyze(&self, tex_sources: &[&str], preamble: &str) -> PackageAnalysis {
        let declared = self.extract_declared_packages(preamble);
        let required = self.detect_required_packages(tex_sources, &declared);
        let mut conflicts = self.detect_conflicts(&declared);
        let requires_shell_escape = tex_sources.iter().any(|s| s.contains(r"\begin{minted}"));

        if let Some(order_conflict) = check_cleveref_order(preamble) {
            conflicts.push(order_conflict);
        }

        PackageAnalysis {
            missing: required
                .into_iter()
                .filter(|r| !r.already_declared)
                .collect(),
            declared: declared.into_iter().collect(),
            conflicts,
            requires_shell_escape,
        }
    }

    fn extract_declared_packages(&self, preamble: &str) -> HashSet<String> {
        let mut packages = HashSet::new();
        for line in preamble.lines() {
            let line = line.trim();
            if line.starts_with('%') {
                continue;
            }
            // Matchea \usepackage[opts]{pkg} y \usepackage{pkg}
            if let Some(start) = line.find(r"\usepackage") {
                let after = &line[start + 11..];
                // Saltar opciones opcionales [...]
                let pkg_start = if after.starts_with('[') {
                    after.find(']').map(|i| i + 1).unwrap_or(0)
                } else {
                    0
                };
                let after_opts = &after[pkg_start..];
                if after_opts.starts_with('{') {
                    if let Some(end) = after_opts.find('}') {
                        let pkg_list = &after_opts[1..end];
                        for pkg in pkg_list.split(',') {
                            let name = pkg.trim().to_string();
                            if !name.is_empty() {
                                packages.insert(name);
                            }
                        }
                    }
                }
            }
        }
        packages
    }

    fn detect_required_packages(
        &self,
        tex_sources: &[&str],
        declared: &HashSet<String>,
    ) -> Vec<PackageRequirement> {
        let combined = tex_sources.join("\n");
        let mut seen = HashSet::new();
        let mut requirements = Vec::new();

        for rule in DETECTION_RULES {
            if combined.contains(rule.pattern) && !seen.contains(rule.package) {
                seen.insert(rule.package);
                requirements.push(PackageRequirement {
                    package_name: rule.package.to_string(),
                    options: vec![],
                    reason: rule.reason.clone(),
                    priority: rule.priority.clone(),
                    already_declared: declared.contains(rule.package),
                });
            }
        }
        requirements
    }

    fn detect_conflicts(&self, declared: &HashSet<String>) -> Vec<PackageConflict> {
        known_conflicts()
            .into_iter()
            .filter(|c| declared.contains(&c.package_a) && declared.contains(&c.package_b))
            .collect()
    }
}

impl Default for PackageDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_booktabs_from_toprule() {
        let detector = PackageDetector::new();
        let tex = r"\begin{tabular}{ll}\toprule Header \\ \midrule Row \\ \bottomrule\end{tabular}";
        let result = detector.analyze(&[tex], "");
        assert!(result.missing.iter().any(|r| r.package_name == "booktabs"));
    }

    #[test]
    fn no_missing_when_already_declared() {
        let detector = PackageDetector::new();
        let tex = r"\toprule";
        let preamble = r"\usepackage{booktabs}";
        let result = detector.analyze(&[tex], preamble);
        assert!(!result.missing.iter().any(|r| r.package_name == "booktabs"));
    }

    #[test]
    fn detects_natbib_biblatex_conflict() {
        let detector = PackageDetector::new();
        let preamble = "\\usepackage{natbib}\n\\usepackage{biblatex}";
        let result = detector.analyze(&[], preamble);
        assert!(result.conflicts.iter().any(|c| c.package_a == "natbib"));
        assert!(result.has_blocking_issues());
    }

    #[test]
    fn detects_cleveref_before_hyperref() {
        let detector = PackageDetector::new();
        let preamble = "\\usepackage{cleveref}\n\\usepackage{hyperref}";
        let result = detector.analyze(&[], preamble);
        assert!(result
            .conflicts
            .iter()
            .any(|c| c.resolution == ConflictResolution::LoadOrderFix));
    }

    #[test]
    fn detects_minted_shell_escape() {
        let detector = PackageDetector::new();
        let tex = r"\begin{minted}{python}print('hello')\end{minted}";
        let result = detector.analyze(&[tex], "");
        assert!(result.requires_shell_escape);
    }
}
