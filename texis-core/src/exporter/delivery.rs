//! Generación del paquete de entrega final (delivery package).
//!
//! Recibe los resultados ya calculados (model, validation, postflight) y
//! produce un ZIP con todos los artefactos de evidencia. El caller es
//! responsable de ejecutar validate, compile y postflight antes de llamar aquí.
//!
//! Esta es la fuente de verdad única. No duplicar en src-tauri ni en texis-cli.

use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::error::{CoreError, CoreResult};
use crate::postflight::PdfPostflightResult;
use crate::profile::model::Profile;
use crate::project::model::ProjectModel;
use crate::validator::report::ValidationReport;

// ── Versión compartida de schema de artefactos ────────────────────────────────

/// Versión de schema compartida por todos los artefactos del paquete.
/// Centralizada aquí para que Tauri y CLI emitan el mismo valor.
pub const ARTIFACT_SCHEMA_VERSION: &str = "1.0.0";

// ── Tipos públicos ────────────────────────────────────────────────────────────

/// Parámetros de la operación de exportación.
pub struct DeliveryOptions<'a> {
    /// Directorio de salida donde se colocará el ZIP.
    pub output_dir: &'a Path,
    /// Modo de exportación: "draft", "review" o "final".
    pub mode: &'a str,
    /// Versión de la aplicación que invoca (ej. env!("CARGO_PKG_VERSION")).
    pub app_version: &'a str,
}

/// Entradas necesarias para generar el paquete.
pub struct DeliveryInput<'a> {
    /// Directorio raíz del proyecto (contiene tesis.project.yaml, build/, content/).
    pub project_dir: &'a Path,
    pub model: &'a ProjectModel,
    /// Perfil institucional cargado. None si no hay perfil disponible.
    pub profile: Option<&'a Profile>,
    pub validation: &'a ValidationReport,
    pub postflight: &'a PdfPostflightResult,
}

/// Resultado de la generación del paquete.
pub struct DeliveryResult {
    pub zip_path: PathBuf,
    pub export_mode: String,
    pub validation_errors: usize,
    pub postflight_passed: bool,
    pub all_fonts_embedded: bool,
}

// ── Función principal ─────────────────────────────────────────────────────────

/// Genera el paquete de entrega final y lo escribe en `options.output_dir`.
///
/// Devuelve `DeliveryResult` con metadata del paquete generado.
/// El caller ya debió correr validation, compilation y postflight.
pub fn create_delivery_package(
    input: &DeliveryInput<'_>,
    options: &DeliveryOptions<'_>,
) -> CoreResult<DeliveryResult> {
    use crate::validator::IssueSeverity;

    let mode = options.mode;
    let project_dir = input.project_dir;
    let model = input.model;
    let profile = input.profile;
    let validation = input.validation;
    let postflight = input.postflight;

    let validation_errors: Vec<_> = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, IssueSeverity::Error))
        .collect();

    let warnings_count = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, IssueSeverity::Warning))
        .count();

    // ── Nombre del ZIP ────────────────────────────────────────────────────────
    let slug: String = model
        .metadata
        .title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .take(40)
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    let mode_suffix = if mode == "draft" { "_borrador" } else { "" };
    let zip_name = format!(
        "{}{}_entrega.zip",
        if slug.is_empty() {
            "tesis".to_string()
        } else {
            slug
        },
        mode_suffix,
    );
    let zip_path = options.output_dir.join(&zip_name);

    // ── Crear ZIP ─────────────────────────────────────────────────────────────
    let file = std::fs::File::create(&zip_path).map_err(CoreError::Io)?;
    let writer = BufWriter::new(file);
    let mut zip = ZipWriter::new(writer);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut manifest_entries: Vec<serde_json::Value> = vec![];

    // Cap per-file reads to 200 MB to prevent OOM on unexpectedly large project assets.
    const MAX_FILE_BYTES: u64 = 200 * 1024 * 1024;

    // ── Añadir archivos al ZIP ────────────────────────────────────────────────

    // 1. PDF compilado
    let pdf_path = project_dir.join("build").join("main.pdf");
    if pdf_path.exists() {
        let file_size = std::fs::metadata(&pdf_path).map(|m| m.len()).unwrap_or(0);
        if file_size > MAX_FILE_BYTES {
            return Err(CoreError::Io(std::io::Error::other(format!(
                "El PDF compilado es demasiado grande para incluirlo en el paquete de entrega ({} MB, máx {} MB)",
                file_size / (1024 * 1024),
                MAX_FILE_BYTES / (1024 * 1024),
            ))));
        }
        let bytes = std::fs::read(&pdf_path).map_err(CoreError::Io)?;
        add_file(&mut zip, "thesis.pdf", &bytes, &mut manifest_entries, opts)?;
    }

    // 2. Fuentes LaTeX (sources/)
    let build_dir = project_dir.join("build");
    let exclude_build = [
        "main.pdf",
        "main.aux",
        "main.log",
        "main.bbl",
        "main.bcf",
        "main.blg",
        "main.run.xml",
        "main.toc",
        "main.out",
        "main.fls",
        "main.fdb_latexmk",
        "main.synctex.gz",
    ];
    if build_dir.exists() {
        for entry in walkdir::WalkDir::new(&build_dir)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if exclude_build.contains(&fname) {
                continue;
            }
            if let Ok(rel) = path.strip_prefix(&build_dir) {
                let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                if file_size > MAX_FILE_BYTES {
                    // Skip oversized intermediate build artefacts rather than failing the whole export.
                    eprintln!(
                        "[delivery] omitido archivo fuente demasiado grande: {} ({} MB)",
                        path.display(),
                        file_size / (1024 * 1024),
                    );
                    continue;
                }
                let entry_name = format!("sources/{}", rel.to_string_lossy().replace('\\', "/"));
                let bytes = std::fs::read(path).map_err(CoreError::Io)?;
                add_file(&mut zip, &entry_name, &bytes, &mut manifest_entries, opts)?;
            }
        }
    }

    // 3. Contenido (bibliografía, figuras)
    let content_dir = project_dir.join("content");
    if content_dir.exists() {
        for entry in walkdir::WalkDir::new(&content_dir)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            if let Ok(rel) = path.strip_prefix(&content_dir) {
                let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
                if file_size > MAX_FILE_BYTES {
                    eprintln!(
                        "[delivery] omitido archivo de contenido demasiado grande: {} ({} MB)",
                        path.display(),
                        file_size / (1024 * 1024),
                    );
                    continue;
                }
                let entry_name = format!("content/{}", rel.to_string_lossy().replace('\\', "/"));
                let bytes = std::fs::read(path).map_err(CoreError::Io)?;
                add_file(&mut zip, &entry_name, &bytes, &mut manifest_entries, opts)?;
            }
        }
    }

    // 4. compliance_report.json
    {
        let pf_issues_json: Vec<_> = postflight
            .issues
            .iter()
            .map(|i| {
                serde_json::json!({
                    "severity": format!("{:?}", i.severity).to_lowercase(),
                    "code": i.code,
                    "message": i.message,
                    "suggestion": i.suggestion,
                })
            })
            .collect();

        let validation_issues_json: Vec<_> = validation
            .issues
            .iter()
            .map(|i| {
                serde_json::json!({
                    "severity": format!("{:?}", i.severity).to_lowercase(),
                    "code": i.code,
                    "message": i.message,
                    "suggestion": i.suggestion,
                    "section_id": i.section_id,
                })
            })
            .collect();

        let report = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "generator": "TeXisStudio",
            "export_mode": mode,
            "project": {
                "title": model.metadata.title,
                "author": model.student.full_name,
                "profile_id": model.profile_id,
                "year": model.metadata.year,
            },
            "preflight": {
                "passed": validation_errors.is_empty(),
                "total_issues": validation.issues.len(),
                "errors": validation_errors.len(),
                "issues": validation_issues_json,
            },
            "postflight_pdf": {
                "passed": postflight.passed,
                "pdf_exists": postflight.pdf_exists,
                "all_fonts_embedded": postflight.all_fonts_embedded,
                "non_embedded_fonts": postflight.non_embedded_fonts,
                "metadata": postflight.metadata,
                "tools_available": postflight.tools_available,
                "tools_missing": postflight.tools_missing,
                "issues": pf_issues_json,
            },
            "disclaimer": "Este reporte cubre las validaciones automáticas disponibles. Algunos requisitos institucionales requieren confirmación manual con el programa, departamento o escuela de posgrado."
        });

        let bytes = serde_json::to_string_pretty(&report)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "compliance_report.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 5. submission_checklist.md
    {
        let checklist = format!(
            "# Lista de verificación de entrega\n\n\
             Generado por TeXisStudio el {date}\n\n\
             ## Proyecto\n\
             - **Título:** {title}\n\
             - **Autor:** {author}\n\
             - **Perfil institucional:** {profile_id}\n\n\
             ## Verificaciones automáticas\n\
             - [{v_mark}] Validación de estructura: {v_state}\n\
             - [{pf_mark}] Postflight PDF: {pf_state}\n\
             - [{f_mark}] Fuentes incrustadas: {f_state}\n\n\
             ## Verificaciones manuales requeridas\n\
             - [ ] Confirmar requisitos específicos del programa o departamento\n\
             - [ ] Confirmar nombre exacto del grado y título según el programa\n\
             - [ ] Confirmar nombre del director/comité según formato institucional\n\
             - [ ] Confirmar copyright, licencia y restricciones de embargo\n\
             - [ ] Confirmar material de terceros con permisos documentados\n\
             - [ ] Confirmar sistema de entrega institucional (portal, email, físico)\n\
             - [ ] Confirmar plazo de entrega y procedimiento de registro\n\n\
             ---\n\
             _Este paquete fue generado por TeXisStudio. Las validaciones automáticas\n\
             no reemplazan la revisión del programa, departamento o escuela de posgrado._\n",
            date = chrono::Utc::now().format("%Y-%m-%d"),
            title = model.metadata.title,
            author = model.student.full_name,
            profile_id = model.profile_id,
            v_mark = if validation_errors.is_empty() {
                "x"
            } else {
                " "
            },
            v_state = if validation_errors.is_empty() {
                "✓ sin errores".to_string()
            } else {
                format!("✗ {} error(es)", validation_errors.len())
            },
            pf_mark = if postflight.passed { "x" } else { " " },
            pf_state = if postflight.passed {
                "✓ pasó"
            } else {
                "✗ falló"
            },
            f_mark = if postflight.all_fonts_embedded {
                "x"
            } else {
                " "
            },
            f_state = if postflight.all_fonts_embedded {
                "✓".to_string()
            } else {
                format!("✗ {}", postflight.non_embedded_fonts.join(", "))
            },
        );
        add_file(
            &mut zip,
            "submission_checklist.md",
            checklist.as_bytes(),
            &mut manifest_entries,
            opts,
        )?;
    }

    // 6. postflight_report.json
    {
        let pf_issues: Vec<_> = postflight
            .issues
            .iter()
            .map(|i| {
                serde_json::json!({
                    "severity": format!("{:?}", i.severity).to_lowercase(),
                    "code": i.code,
                    "message": i.message,
                    "suggestion": i.suggestion,
                })
            })
            .collect();
        let fonts: Vec<_> = postflight
            .fonts
            .iter()
            .map(|f| {
                serde_json::json!({
                    "name": f.name,
                    "font_type": f.font_type,
                    "embedded": f.embedded,
                    "subset": f.subset,
                })
            })
            .collect();
        let report = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "pdf_exists": postflight.pdf_exists,
            "passed": postflight.passed,
            "all_fonts_embedded": postflight.all_fonts_embedded,
            "non_embedded_fonts": postflight.non_embedded_fonts,
            "tools_available": postflight.tools_available,
            "tools_missing": postflight.tools_missing,
            "fonts": fonts,
            "issues": pf_issues,
            "metadata": postflight.metadata,
        });
        let bytes = serde_json::to_string_pretty(&report)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "postflight_report.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 7. compilation_reproducibility.json
    {
        let latex_info = crate::compiler::detector::LatexInstallation::detect();
        let report = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "compilation_reproducibility": "not_guaranteed",
            "note": "La compilación LaTeX puede producir PDFs binariamente distintos entre entornos aunque el fuente sea idéntico.",
            "profile_id": model.profile_id,
            "compiler": if latex_info.has_xelatex { "xelatex" } else if latex_info.has_latexmk { "latexmk" } else { "unknown" },
            "compiler_version": latex_info.latexmk_version,
            "texlive_year": latex_info.texlive_year,
        });
        let bytes = serde_json::to_string_pretty(&report)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "compilation_reproducibility.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 8. policy_report.json (solo si hay perfil)
    if let Some(p) = profile {
        use crate::profile::ProfilePolicyValidator;
        let policy = ProfilePolicyValidator::validate(p);
        let issues: Vec<_> = policy
            .issues
            .iter()
            .map(|i| {
                serde_json::json!({
                    "severity": format!("{:?}", i.severity).to_lowercase(),
                    "code": i.code,
                    "message": i.message,
                    "field": i.field,
                })
            })
            .collect();
        let report = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "profile_id": policy.profile_id,
            "profile_status": format!("{:?}", policy.profile_status).to_lowercase(),
            "has_errors": policy.has_errors(),
            "has_warnings": policy.has_warnings(),
            "issues": issues,
        });
        let bytes = serde_json::to_string_pretty(&report)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "policy_report.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 9. profile.lock.yaml
    {
        use crate::profile::lock::{check_lock_status, LockStatus};
        if check_lock_status(project_dir) == LockStatus::Locked {
            let lock_path = project_dir.join("profile.lock.yaml");
            let bytes = std::fs::read(&lock_path).map_err(CoreError::Io)?;
            add_file(
                &mut zip,
                "profile.lock.yaml",
                &bytes,
                &mut manifest_entries,
                opts,
            )?;
        }
    }

    // 10. profile.lock.sha256.json
    {
        use crate::profile::lock::{check_lock_status, LockStatus};
        if check_lock_status(project_dir) == LockStatus::Locked {
            let lock_path = project_dir.join("profile.lock.yaml");
            if let Ok(lock_bytes) = std::fs::read(&lock_path) {
                let hash = Sha256::digest(&lock_bytes);
                let hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
                let info = serde_json::json!({
                    "schema_version": ARTIFACT_SCHEMA_VERSION,
                    "file": "profile.lock.yaml",
                    "sha256": hex,
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                });
                let bytes = serde_json::to_string_pretty(&info)
                    .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
                    .into_bytes();
                add_file(
                    &mut zip,
                    "profile.lock.sha256.json",
                    &bytes,
                    &mut manifest_entries,
                    opts,
                )?;
            }
        }
    }

    // 11. compiler.info.json
    {
        let latex_info = crate::compiler::detector::LatexInstallation::detect();
        let info = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "engine": if latex_info.has_xelatex { "xelatex" } else { "unknown" },
            "backend": if latex_info.has_latexmk { "latexmk" } else { "direct" },
            "latexmk_version": latex_info.latexmk_version,
            "texlive_year": latex_info.texlive_year,
            "has_xelatex": latex_info.has_xelatex,
            "has_latexmk": latex_info.has_latexmk,
            "has_biber": latex_info.has_biber,
            "has_tectonic": latex_info.has_tectonic,
            "tectonic_version": latex_info.tectonic_version,
        });
        let bytes = serde_json::to_string_pretty(&info)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "compiler.info.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 12. latex_packages_report.json
    {
        let log_path = project_dir.join("build").join("main.log");
        let packages = if log_path.exists() {
            extract_latex_packages_from_log(&std::fs::read_to_string(&log_path).unwrap_or_default())
        } else {
            vec![]
        };
        let report = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "log_available": log_path.exists(),
            "package_count": packages.len(),
            "packages": packages,
        });
        let bytes = serde_json::to_string_pretty(&report)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "latex_packages_report.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 13. texis.version.json
    {
        let info = serde_json::json!({
            "texis_app_version": options.app_version,
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "generated_at": chrono::Utc::now().to_rfc3339(),
        });
        let bytes = serde_json::to_string_pretty(&info)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?
            .into_bytes();
        add_file(
            &mut zip,
            "texis.version.json",
            &bytes,
            &mut manifest_entries,
            opts,
        )?;
    }

    // 14. build.log
    {
        let log_path = project_dir.join("build").join("main.log");
        if log_path.exists() {
            let bytes = std::fs::read(&log_path).map_err(CoreError::Io)?;
            add_file(&mut zip, "build.log", &bytes, &mut manifest_entries, opts)?;
        }
    }

    // 15. README.txt
    {
        let readme = format!(
            "TeXisStudio — Paquete de entrega\n{sep}\n\n\
             Título:     {title}\n\
             Autor:      {author}\n\
             Perfil:     {profile_id}\n\
             Modo:       {mode_str}\n\
             Generado:   {date}\n\n\
             Estado:\n\
               Validación preflight: {v_state} ({errs} errores, {warns} avisos)\n\
               Postflight PDF:       {pf_state}\n\
               Fuentes incrustadas:  {f_state}\n\n\
             Contenido del ZIP:\n\
               thesis.pdf                         → PDF compilado\n\
               sources/                           → Archivos fuente LaTeX\n\
               content/                           → Bibliografía e imágenes\n\
               compliance_report.json             → Reporte de cumplimiento\n\
               postflight_report.json             → Verificación del PDF\n\
               policy_report.json                 → Política del perfil institucional\n\
               compilation_reproducibility.json   → Declaración de reproducibilidad\n\
               compiler.info.json                 → Información del compilador LaTeX\n\
               latex_packages_report.json         → Paquetes LaTeX detectados\n\
               profile.lock.sha256.json           → Hash SHA-256 del perfil congelado\n\
               texis.version.json                 → Versión del generador\n\
               profile.lock.yaml                  → Perfil congelado (si existe)\n\
               build.log                          → Log de compilación (si existe)\n\
               submission_checklist.md            → Lista de verificación\n\
               manifest.sha256.json               → Hashes SHA-256 de todos los archivos\n\n\
             AVISO: Este paquete incluye validaciones automáticas. Algunos requisitos\n\
             institucionales requieren confirmación manual con tu programa o escuela.\n",
            sep = "=".repeat(60),
            title = model.metadata.title,
            author = model.student.full_name,
            profile_id = model.profile_id,
            mode_str = mode.to_uppercase(),
            date = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC"),
            v_state = if validation_errors.is_empty() {
                "OK"
            } else {
                "ERRORES"
            },
            errs = validation_errors.len(),
            warns = warnings_count,
            pf_state = if postflight.passed { "OK" } else { "PROBLEMAS" },
            f_state = if postflight.all_fonts_embedded {
                "OK"
            } else {
                "NO INCRUSTADAS"
            },
        );
        add_file(
            &mut zip,
            "README.txt",
            readme.as_bytes(),
            &mut manifest_entries,
            opts,
        )?;
    }

    // 16. manifest.sha256.json (siempre al final — lista todos los anteriores)
    {
        let manifest = serde_json::json!({
            "schema_version": ARTIFACT_SCHEMA_VERSION,
            "created_at": chrono::Utc::now().to_rfc3339(),
            "generator": "TeXisStudio",
            "export_mode": mode,
            "files": manifest_entries,
        });
        let bytes = serde_json::to_string_pretty(&manifest)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
        zip.start_file("manifest.sha256.json", opts)
            .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
        zip.write_all(bytes.as_bytes()).map_err(CoreError::Io)?;
    }

    zip.finish()
        .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;

    Ok(DeliveryResult {
        zip_path,
        export_mode: mode.to_string(),
        validation_errors: validation_errors.len(),
        postflight_passed: postflight.passed,
        all_fonts_embedded: postflight.all_fonts_embedded,
    })
}

// ── Helpers privados ──────────────────────────────────────────────────────────

fn add_file(
    zip: &mut ZipWriter<BufWriter<std::fs::File>>,
    entry_name: &str,
    bytes: &[u8],
    manifest: &mut Vec<serde_json::Value>,
    opts: SimpleFileOptions,
) -> CoreResult<()> {
    let hash: String = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect();
    zip.start_file(entry_name, opts)
        .map_err(|e| CoreError::Io(std::io::Error::other(e)))?;
    zip.write_all(bytes).map_err(CoreError::Io)?;
    manifest.push(serde_json::json!({
        "path": entry_name,
        "sha256": hash,
        "bytes": bytes.len(),
    }));
    Ok(())
}

/// Extrae nombres de paquetes LaTeX del log de compilación.
///
/// Busca líneas del tipo `(path/to/package.sty` y extrae el nombre
/// del archivo sin extensión. Elimina duplicados y ordena.
pub fn extract_latex_packages_from_log(log: &str) -> Vec<String> {
    use std::collections::BTreeSet;
    let mut pkgs: BTreeSet<String> = BTreeSet::new();
    for line in log.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('(') {
            let inner = trimmed.trim_start_matches('(').trim();
            let filepath = inner
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim_end_matches(')');
            if filepath.ends_with(".sty")
                || filepath.ends_with(".cls")
                || filepath.ends_with(".def")
            {
                let fname = std::path::Path::new(filepath)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
                if fname.len() > 1 {
                    pkgs.insert(fname);
                }
            }
        }
    }
    pkgs.into_iter().collect()
}
