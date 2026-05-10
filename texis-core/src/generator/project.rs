// Crea la estructura de directorios de build/ y los archivos de proyecto:
// .gitignore y README-compilacion.txt en la raíz del proyecto.

use crate::error::{CoreError, CoreResult};
use std::path::Path;

const GITIGNORE_CONTENT: &str = "\
# TeXisStudio — archivos generados automáticamente
# Solo versionar: tesis.project.yaml + content/

build/
delivery/

# Temporales de LaTeX
*.aux
*.log
*.toc
*.out
*.bbl
*.bcf
*.blg
*.run.xml
*.fls
*.fdb_latexmk
*.synctex.gz
";

const README_COMPILACION: &str = "\
TeXisStudio — Compilación manual
=================================

Generado con TeXisStudio
https://github.com/GonzaloAndDev/TeXisStudio
Autor original: Gonzalo Andrade Estrella

Para compilar el PDF manualmente sin la app:

  cd build
  latexmk -xelatex main.tex

O desde el directorio raíz del proyecto:

  latexmk -xelatex -cd build/main.tex

Requisitos:
  - TeX Live completo o MiKTeX
  - latexmk
  - xelatex
  - biber (para bibliografía)

Fuente de verdad del proyecto:
  tesis.project.yaml
  content/

El directorio build/ es generado automáticamente.
No es necesario versionarlo.
";

/// Crea los subdirectorios de build/ y los archivos de proyecto en la raíz.
/// build_dir debe ser el directorio build/ del proyecto.
pub fn create_structure(build_dir: &Path) -> CoreResult<()> {
    for subdir in &["configuracion", "preliminares", "capitulos", "backmatter", "anexos", "figuras", "pdf"] {
        std::fs::create_dir_all(build_dir.join(subdir)).map_err(CoreError::Io)?;
    }

    // .gitignore y README en la raíz del proyecto (parent de build/)
    let project_root = build_dir.parent().unwrap_or(build_dir);

    let gitignore_path = project_root.join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(&gitignore_path, GITIGNORE_CONTENT).map_err(CoreError::Io)?;
    }

    let readme_path = project_root.join("README-compilacion.txt");
    if !readme_path.exists() {
        std::fs::write(&readme_path, README_COMPILACION).map_err(CoreError::Io)?;
    }

    Ok(())
}
