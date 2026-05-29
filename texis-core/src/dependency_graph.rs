use regex::Regex;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub type ProjectNodeId = Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectNodeKind {
    TexFile { is_root: bool },
    BibFile,
    AssetFile,
    GlossaryFile,
    PackageRequirement { name: String },
    GeneratedAuxFile { extension: String },
    PdfOutput,
}

#[derive(Debug, Clone)]
pub struct ProjectNode {
    pub id: ProjectNodeId,
    pub kind: ProjectNodeKind,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DependencyKind {
    Input,
    Include,
    IncludeGraphics,
    BibResource,
    GlossaryInput,
    ExternalDocument,
    GeneratesAux,
    RequiresPackage,
}

#[derive(Debug, Clone)]
pub struct ProjectDependencyEdge {
    pub from: ProjectNodeId,
    pub to: ProjectNodeId,
    pub kind: DependencyKind,
}

/// Grafo de dependencias del proyecto LaTeX.
/// Se usa para compilación incremental y para saber qué recompilar cuando algo cambia.
#[derive(Debug, Default)]
pub struct ProjectDependencyGraph {
    pub nodes: HashMap<ProjectNodeId, ProjectNode>,
    pub edges: Vec<ProjectDependencyEdge>,
    /// SHA-256 de cada archivo en el último build exitoso
    pub checksums: HashMap<PathBuf, String>,
    by_path: HashMap<PathBuf, ProjectNodeId>,
}

impl ProjectDependencyGraph {
    pub fn new() -> Self { Self::default() }

    /// Escanea un archivo .tex y registra sus dependencias en el grafo.
    pub fn scan_file(&mut self, path: &Path, root: &Path) {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return,
        };

        let from_id = self.get_or_create_node(path, ProjectNodeKind::TexFile { is_root: path.ends_with("main.tex") });

        // Patrones a detectar
        let patterns: &[(&str, fn(&str, &Path, &Path) -> (PathBuf, DependencyKind))] = &[
            (r"\\input\{([^}]+)\}", |cap, dir, root| {
                let p = resolve_tex_path(cap, dir, root, ".tex");
                (p, DependencyKind::Input)
            }),
            (r"\\include\{([^}]+)\}", |cap, dir, root| {
                let p = resolve_tex_path(cap, dir, root, ".tex");
                (p, DependencyKind::Include)
            }),
            (r"\\includegraphics\s*(?:\[[^\]]*\])?\{([^}]+)\}", |cap, dir, _root| {
                (dir.join(cap), DependencyKind::IncludeGraphics)
            }),
            (r"\\addbibresource\{([^}]+)\}", |cap, dir, _root| {
                (dir.join(cap), DependencyKind::BibResource)
            }),
            (r"\\bibliography\{([^}]+)\}", |cap, dir, _root| {
                let p = dir.join(format!("{}.bib", cap.trim_end_matches(".bib")));
                (p, DependencyKind::BibResource)
            }),
            (r"\\loadglsentries\{([^}]+)\}", |cap, dir, _root| {
                (dir.join(cap), DependencyKind::GlossaryInput)
            }),
            (r"\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}", |cap, _, _| {
                (PathBuf::from(cap), DependencyKind::RequiresPackage)
            }),
        ];

        let parent_dir = path.parent().unwrap_or(root);

        for (pattern, resolver) in patterns {
            let re = Regex::new(pattern).unwrap();
            for cap in re.captures_iter(&content) {
                let matched = cap[1].trim();
                // \usepackage puede tener múltiples paquetes: {pkg1,pkg2}
                let items: Vec<&str> = if matched.contains(',') {
                    matched.split(',').map(str::trim).collect()
                } else {
                    vec![matched]
                };

                for item in items {
                    let (dep_path, dep_kind) = resolver(item, parent_dir, root);

                    let node_kind = match &dep_kind {
                        DependencyKind::BibResource => ProjectNodeKind::BibFile,
                        DependencyKind::IncludeGraphics => ProjectNodeKind::AssetFile,
                        DependencyKind::GlossaryInput => ProjectNodeKind::GlossaryFile,
                        DependencyKind::RequiresPackage => ProjectNodeKind::PackageRequirement {
                            name: item.to_string(),
                        },
                        _ => ProjectNodeKind::TexFile { is_root: false },
                    };

                    let to_id = self.get_or_create_node(&dep_path, node_kind);
                    self.edges.push(ProjectDependencyEdge {
                        from: from_id,
                        to: to_id,
                        kind: dep_kind,
                    });
                }
            }
        }
    }

    /// Actualiza los checksums de todos los archivos fuente conocidos.
    pub fn update_checksums(&mut self) {
        let paths: Vec<PathBuf> = self.by_path.keys().cloned().collect();
        for path in paths {
            if let Ok(content) = std::fs::read(&path) {
                let checksum = format!("{:x}", Sha256::digest(&content));
                self.checksums.insert(path, checksum);
            }
        }
    }

    /// Retorna los nodos cuyo checksum cambió desde la última actualización.
    pub fn changed_since_last_build(&self) -> Vec<&ProjectNode> {
        self.nodes
            .values()
            .filter(|node| {
                if let Ok(content) = std::fs::read(&node.path) {
                    let current = format!("{:x}", Sha256::digest(&content));
                    self.checksums
                        .get(&node.path)
                        .map(|prev| prev != &current)
                        .unwrap_or(true) // nunca visto → considerar cambiado
                } else {
                    false
                }
            })
            .collect()
    }

    /// ¿Se necesita recompilación completa dado el conjunto de nodos cambiados?
    pub fn needs_full_recompile(&self, changed: &[&ProjectNode]) -> bool {
        changed.iter().any(|n| {
            matches!(n.kind, ProjectNodeKind::TexFile { is_root: true })
                || n.path.file_name().and_then(|f| f.to_str()) == Some("preamble.tex")
                || n.path.extension().and_then(|e| e.to_str()) == Some("sty")
        })
    }

    /// ¿Se necesita correr Biber dado los nodos cambiados?
    pub fn needs_biber_rerun(&self, changed: &[&ProjectNode]) -> bool {
        changed.iter().any(|n| matches!(n.kind, ProjectNodeKind::BibFile))
            || !self.aux_exists("bcf")
    }

    /// ¿Se necesita correr makeglossaries dado los nodos cambiados?
    pub fn needs_glossary_rerun(&self, changed: &[&ProjectNode]) -> bool {
        changed.iter().any(|n| matches!(n.kind, ProjectNodeKind::GlossaryFile))
            || !self.aux_exists("glo")
    }

    /// Detecta ciclos en las dependencias \input (previene loops infinitos).
    pub fn detect_input_cycles(&self) -> Vec<Vec<PathBuf>> {
        let mut cycles = Vec::new();
        let mut visited = HashSet::new();
        let mut stack = Vec::new();

        for id in self.nodes.keys() {
            if !visited.contains(id) {
                self.dfs_cycles(*id, &mut visited, &mut stack, &mut cycles);
            }
        }

        cycles
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn get_or_create_node(&mut self, path: &Path, kind: ProjectNodeKind) -> ProjectNodeId {
        if let Some(&id) = self.by_path.get(path) {
            return id;
        }
        let id = Uuid::new_v4();
        let node = ProjectNode { id, kind, path: path.to_path_buf() };
        self.nodes.insert(id, node);
        self.by_path.insert(path.to_path_buf(), id);
        id
    }

    fn aux_exists(&self, ext: &str) -> bool {
        self.nodes.values().any(|n| {
            n.path.extension().and_then(|e| e.to_str()) == Some(ext)
                && n.path.exists()
        })
    }

    fn dfs_cycles(
        &self,
        node_id: ProjectNodeId,
        visited: &mut HashSet<ProjectNodeId>,
        stack: &mut Vec<ProjectNodeId>,
        cycles: &mut Vec<Vec<PathBuf>>,
    ) {
        visited.insert(node_id);
        stack.push(node_id);

        for edge in &self.edges {
            if edge.from != node_id
                || !matches!(edge.kind, DependencyKind::Input | DependencyKind::Include)
            {
                continue;
            }
            if stack.contains(&edge.to) {
                // Ciclo detectado
                let cycle_start = stack.iter().position(|&id| id == edge.to).unwrap();
                let cycle: Vec<PathBuf> = stack[cycle_start..]
                    .iter()
                    .filter_map(|id| self.nodes.get(id).map(|n| n.path.clone()))
                    .collect();
                cycles.push(cycle);
            } else if !visited.contains(&edge.to) {
                self.dfs_cycles(edge.to, visited, stack, cycles);
            }
        }

        stack.pop();
    }
}

fn resolve_tex_path(name: &str, parent_dir: &Path, _root: &Path, ext: &str) -> PathBuf {
    let name = name.trim();
    let base = if name.ends_with(ext) {
        parent_dir.join(name)
    } else {
        parent_dir.join(format!("{}{}", name, ext))
    };
    base
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_tex(dir: &TempDir, name: &str, content: &str) -> PathBuf {
        let p = dir.path().join(name);
        std::fs::write(&p, content).unwrap();
        p
    }

    #[test]
    fn scan_detects_input_dependency() {
        let dir = tempfile::tempdir().unwrap();
        write_tex(&dir, "chapter.tex", "Hello");
        write_tex(&dir, "main.tex", r"\input{chapter}");

        let mut graph = ProjectDependencyGraph::new();
        graph.scan_file(&dir.path().join("main.tex"), dir.path());

        let edges_input: Vec<_> = graph
            .edges
            .iter()
            .filter(|e| e.kind == DependencyKind::Input)
            .collect();
        assert!(!edges_input.is_empty());
    }

    #[test]
    fn scan_detects_bib_resource() {
        let dir = tempfile::tempdir().unwrap();
        write_tex(&dir, "main.tex", r"\addbibresource{references.bib}");

        let mut graph = ProjectDependencyGraph::new();
        graph.scan_file(&dir.path().join("main.tex"), dir.path());

        assert!(graph.nodes.values().any(|n| matches!(n.kind, ProjectNodeKind::BibFile)));
    }

    #[test]
    fn scan_detects_usepackage() {
        let dir = tempfile::tempdir().unwrap();
        write_tex(&dir, "main.tex", r"\usepackage{booktabs,tabularx}");

        let mut graph = ProjectDependencyGraph::new();
        graph.scan_file(&dir.path().join("main.tex"), dir.path());

        let packages: Vec<_> = graph
            .nodes
            .values()
            .filter(|n| matches!(n.kind, ProjectNodeKind::PackageRequirement { .. }))
            .collect();
        assert!(packages.len() >= 2);
    }

    #[test]
    fn changed_since_build_detects_new_files() {
        let dir = tempfile::tempdir().unwrap();
        write_tex(&dir, "main.tex", "original");
        let main = dir.path().join("main.tex");

        let mut graph = ProjectDependencyGraph::new();
        graph.scan_file(&main, dir.path());
        graph.update_checksums(); // guardar estado actual

        // Modificar el archivo
        std::fs::write(&main, "modified").unwrap();
        let changed = graph.changed_since_last_build();
        assert!(!changed.is_empty());
    }

    #[test]
    fn needs_biber_when_no_bcf() {
        let graph = ProjectDependencyGraph::new();
        // Sin .bcf en el grafo, siempre necesita biber
        assert!(graph.needs_biber_rerun(&[]));
    }
}
