use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use texis_core::{
    build_engine::preflight::{EnvContext, Platform, PreflightChecker},
    compiler::error_translator,
    document::DocumentEngine,
    events::EventBus,
    profile::loader::ProfileLoader,
    project::{loader::ProjectLoader, model::BibliographyBackend},
};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ── Estado global de compilación ──────────────────────────────────

/// Compartido a través de Tauri managed state para cancelación.
pub struct CompileState {
    pub cancel_flag: Arc<AtomicBool>,
}

impl CompileState {
    pub fn new() -> Self {
        Self {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for CompileState {
    fn default() -> Self {
        Self::new()
    }
}

// ── Comandos Tauri ────────────────────────────────────────────────

/// Compila el proyecto con streaming de log vía eventos Tauri.
///
/// Emite:
///   - `compile://log`  { line: String }  — una línea de log cada vez
///   - `compile://done` { success, pdf_path, user_errors, warnings, log_preview, backend_used }
///
/// La función también devuelve el resultado final para que el frontend
/// pueda consumirlo directamente via `invoke` si lo prefiere.
///
/// `backend_name`: "latexmk" | "tectonic" | "auto"
#[tauri::command]
pub async fn compile_project(
    app: tauri::AppHandle,
    state: tauri::State<'_, CompileState>,
    project_path: String,
    backend_name: String,
    draft: bool,
    lang_config: Option<Value>,
) -> Result<Value, String> {
    // Reiniciar bandera de cancelación
    let cancel = state.cancel_flag.clone();
    cancel.store(false, Ordering::SeqCst);

    let path = PathBuf::from(&project_path);
    let yaml_path = path.join("tesis.project.yaml");
    let build_dir = path.join("build");

    // ── Paso 1: generar LaTeX (síncrono, rápido) ──────────────────
    let _ = app.emit("compile://log", "→ Generando archivos LaTeX…");
    let loader = ProjectLoader;
    let mut model = loader.load_from_file(&yaml_path).map_err(err)?;

    use texis_core::project::model::LatexEngine;
    let engine_flag = match model.latex_config.engine {
        LatexEngine::Pdflatex => "-pdf",
        LatexEngine::Lualatex => "-lualatex",
        LatexEngine::Xelatex => "-xelatex",
    };

    // Cargar el template de portada del perfil activo (si existe)
    let title_page_template: Option<String> = {
        let profiles_root = {
            if let Ok(res) = app.path().resource_dir() {
                let p = res.join("profiles");
                if p.exists() {
                    p
                } else {
                    dev_profiles_dir()
                }
            } else {
                dev_profiles_dir()
            }
        };
        let profile_yaml = profiles_root.join(&model.profile_id).join("profile.yaml");
        if profile_yaml.exists() {
            ProfileLoader
                .load_from_file(&profile_yaml)
                .ok()
                .and_then(|p| p.title_page_template)
                .map(|t| t.template)
        } else {
            None
        }
    };

    // ── Reconciliar el backend de bibliografía con el compilador activo ──
    // biber con suite (latexmk); bibtex con Tectonic salvo estilos que exijan
    // biber. Así el `\usepackage[backend=…]{biblatex}` que se genera casa con
    // lo que de verdad se ejecutará (evita el desajuste biber/biblatex bajo
    // Tectonic). Se hace ANTES del sync para que main.tex salga consistente.
    {
        use texis_core::bibliography::backend_policy;
        let compiler_kind = compiler_kind_for(&backend_name);
        let style = model.latex_config.bibliography_style.clone();
        model.latex_config.bibliography_backend = backend_policy::resolve_backend(
            &style,
            model.latex_config.bibliography_backend.clone(),
            compiler_kind.clone(),
        );
        if backend_policy::needs_full_suite(&style, compiler_kind) {
            let _ = app.emit(
                "compile://log",
                format!("⚠ El estilo «{style}» usa biber; con Tectonic la versión de biber puede no coincidir. Para máxima estabilidad, usa una suite completa (TeX Live/MiKTeX)."),
            );
        }
    }

    let mut document_engine = DocumentEngine::load(&path).map_err(err)?;
    document_engine
        .sync_preserving_external_edits(
            &model,
            &build_dir,
            lang_config.as_ref(),
            title_page_template.as_deref(),
            &EventBus::new(),
        )
        .map_err(err)?;
    document_engine.save_checksums(&path).map_err(err)?;

    // ── Paso 2: preflight — verificar entorno antes de compilar ──
    use texis_core::project::model::ContentBlock;
    let needs_biber = matches!(
        model.latex_config.bibliography_backend,
        BibliographyBackend::Biber
    );
    let needs_glossary = model.sections.iter().any(|s| {
        s.blocks.iter().any(|b| {
            matches!(
                b,
                ContentBlock::GlossaryEntry(_) | ContentBlock::AcronymEntry(_)
            )
        })
    });
    let preflight_ctx = EnvContext {
        backend: backend_name.clone(),
        needs_biber,
        needs_makeglossaries: needs_glossary,
        platform: Platform::current(),
    };
    let preflight_report = PreflightChecker::check(&preflight_ctx);
    let preflight_issues_json: Vec<Value> = preflight_report
        .issues
        .iter()
        .map(|issue| {
            serde_json::json!({
                "id": issue.id,
                "severity": match issue.severity {
                    texis_core::build_engine::preflight::IssueSeverity::Critical => "critical",
                    texis_core::build_engine::preflight::IssueSeverity::Warning  => "warning",
                    texis_core::build_engine::preflight::IssueSeverity::Info     => "info",
                },
                "why_it_matters": issue.why_it_matters,
                "recommended_action": issue.recommended_action,
                "instructions": {
                    "macos":   issue.instructions.macos,
                    "linux":   issue.instructions.linux,
                    "windows": issue.instructions.windows,
                },
                "can_retry": issue.can_retry,
                "simple_alternative": issue.simple_alternative,
            })
        })
        .collect();

    // Si hay issues críticos, emitirlos y abortar la compilación
    if preflight_report.has_critical {
        let payload = serde_json::json!({
            "success": false,
            "pdf_path": null,
            "user_errors": [],
            "warnings": [],
            "log_preview": "",
            "backend_used": &backend_name,
            "dependency_issues": preflight_issues_json,
            "preflight_failed": true,
        });
        let _ = app.emit("compile://done", &payload);
        return Ok(payload);
    }

    // Emitir warnings de preflight aunque no sean críticos
    if !preflight_report.issues.is_empty() {
        let _ = app.emit(
            "compile://preflight",
            serde_json::json!({
                "issues": &preflight_issues_json
            }),
        );
    }

    // ── Paso 3: seleccionar backend ───────────────────────────────
    let resolved_backend = resolve_backend(&backend_name)?;
    let _ = app.emit("compile://log", format!("→ Iniciando {resolved_backend}…"));

    // ── Paso 3: compilar con streaming ───────────────────────────
    // El timeout y la cancelación se manejan DENTRO de spawn_blocking
    // mediante un watchdog thread que mata el proceso hijo.
    let app2 = app.clone();
    let build_dir2 = build_dir.clone();
    let backend2 = resolved_backend.to_string();
    let engine_flag2 = engine_flag.to_string();

    let task = tokio::task::spawn_blocking(move || {
        run_compiler_streaming(&app2, &build_dir2, &backend2, &engine_flag2, draft, cancel)
    });

    let result = task.await.map_err(|e| format!("Error interno: {e}"))?;

    // Inyectar dependency_issues de preflight al payload final
    result.map(|mut payload| {
        if let Some(map) = payload.as_object_mut() {
            map.insert(
                "dependency_issues".to_string(),
                serde_json::to_value(&preflight_issues_json).unwrap_or(serde_json::json!([])),
            );
            map.insert("preflight_failed".to_string(), serde_json::json!(false));
        }
        payload
    })
}

/// Cancela la compilación en curso.
#[tauri::command]
pub fn cancel_compile(state: tauri::State<'_, CompileState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

// ── Lógica interna ────────────────────────────────────────────────

/// Determina, de forma TOLERANTE (sin error), qué compilador se usará — solo
/// para la política de bibliografía. No falla si no hay compilador: en ese
/// caso el preflight más adelante dará la guía de instalación. "auto" prefiere
/// latexmk (suite) si está disponible, igual que `resolve_backend`.
fn compiler_kind_for(name: &str) -> texis_core::project::model::CompilerKind {
    use std::process::Command;
    use texis_core::compiler::detector::resolve_latex_command;
    use texis_core::project::model::CompilerKind;
    match name {
        "tectonic" => CompilerKind::Tectonic,
        "latexmk" => CompilerKind::Latexmk,
        _ => {
            let latexmk_cmd = resolve_latex_command("latexmk");
            let latexmk_ok = Command::new(&latexmk_cmd).arg("--version").output().is_ok();
            if latexmk_ok {
                CompilerKind::Latexmk
            } else {
                CompilerKind::Tectonic
            }
        }
    }
}

/// Elige el backend disponible: devuelve el nombre del binario a usar.
fn resolve_backend(name: &str) -> Result<&'static str, String> {
    use std::process::Command;
    use texis_core::compiler::detector::resolve_latex_command;
    let latexmk_cmd = resolve_latex_command("latexmk");
    let latexmk_ok = Command::new(&latexmk_cmd).arg("--version").output().is_ok();
    let tectonic_ok = Command::new("tectonic").arg("--version").output().is_ok();

    match name {
        "latexmk" => {
            if latexmk_ok {
                Ok("latexmk")
            } else {
                Err(
                    "latexmk no está instalado. Instala TeX Live, MiKTeX, o usa Tectonic."
                        .to_string(),
                )
            }
        }
        "tectonic" => {
            if tectonic_ok {
                Ok("tectonic")
            } else {
                Err(
                    "Tectonic no está instalado. Visita https://tectonic-typesetting.github.io"
                        .to_string(),
                )
            }
        }
        "auto" => {
            if latexmk_ok {
                Ok("latexmk")
            } else if tectonic_ok {
                Ok("tectonic")
            } else {
                Err("No se encontró ningún compilador LaTeX. Instala latexmk (TeX Live/MiKTeX) o Tectonic.".to_string())
            }
        }
        other => Err(format!(
            "Backend '{other}' no reconocido. Usa: latexmk, tectonic o auto."
        )),
    }
}

/// Ejecuta el compilador en modo streaming.
/// Se llama desde `spawn_blocking`; emite eventos Tauri en cada línea.
///
/// Maneja timeout de 5 minutos y cancelación de usuario mediante un watchdog
/// thread independiente que mata el proceso hijo. Esto garantiza que el proceso
/// LaTeX siempre termina aunque se cuelgue sin emitir output.
fn run_compiler_streaming(
    app: &tauri::AppHandle,
    build_dir: &Path,
    backend: &str,
    engine_flag: &str,
    draft: bool,
    cancel: Arc<AtomicBool>,
) -> Result<Value, String> {
    let compile_start = std::time::Instant::now();

    // Construir el comando — resolver ruta completa para MacTeX/TeX Live fuera del PATH
    use texis_core::compiler::detector::resolve_latex_command;
    let backend_resolved = resolve_latex_command(backend);
    let mut cmd = std::process::Command::new(&backend_resolved);
    cmd.current_dir(build_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match backend {
        "latexmk" => {
            cmd.arg(engine_flag)
                .arg("-interaction=nonstopmode")
                .arg("-file-line-error");
            if draft {
                cmd.arg("-draftmode");
            }
            cmd.arg("main.tex");
        }
        "tectonic" => {
            if draft {
                cmd.arg("--only-cached");
            }
            cmd.arg("main.tex");
        }
        _ => return Err(format!("Backend '{backend}' no soportado.")),
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("No se pudo iniciar '{backend}': {e}"))?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    // Compartir child para que el watchdog pueda matarlo
    let child_shared: Arc<Mutex<Option<std::process::Child>>> = Arc::new(Mutex::new(Some(child)));
    let timed_out = Arc::new(AtomicBool::new(false));
    // Señal para que el watchdog salga cuando el compile termina con éxito.
    // Sin esto, una compilacion exitosa de 2 segundos dejaba un hilo polleando
    // cada 500 ms durante 5 minutos hasta que el deadline expiraba. Múltiples
    // compilaciones encadenadas acumulaban watchdogs zombies — leak pequeño
    // pero acumulativo a lo largo de una sesión de trabajo.
    let done = Arc::new(AtomicBool::new(false));

    // ── Watchdog thread ─────────────────────────────────────────────
    // Monitorea cada 500 ms. Si se supera el timeout o se solicita cancelación,
    // mata el proceso hijo directamente. Esto funciona incluso si LaTeX se
    // cuelga sin emitir ninguna línea de output. Sale inmediatamente cuando
    // `done` se activa (compile normal completado).
    {
        let child_w = child_shared.clone();
        let cancel_w = cancel.clone();
        let timeout_w = timed_out.clone();
        let done_w = done.clone();
        std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(300);
            loop {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if done_w.load(Ordering::Relaxed) {
                    return; // compile finalizó normalmente; nada que matar.
                }
                let elapsed = std::time::Instant::now() >= deadline;
                let cancelled = cancel_w.load(Ordering::Relaxed);
                if elapsed || cancelled {
                    if elapsed {
                        timeout_w.store(true, Ordering::SeqCst);
                    }
                    if let Ok(mut guard) = child_w.lock() {
                        if let Some(ref mut c) = *guard {
                            let _ = c.kill();
                        }
                    }
                    return;
                }
            }
        });
    }

    // ── Hilo de stderr ──────────────────────────────────────────────
    let app_err = app.clone();
    let cancel_err = cancel.clone();
    let stderr_thread = std::thread::spawn(move || {
        let mut lines = Vec::new();
        for line in BufReader::new(stderr).lines() {
            if cancel_err.load(Ordering::Relaxed) {
                break;
            }
            if let Ok(l) = line {
                let _ = app_err.emit("compile://log", &l);
                lines.push(l);
            }
        }
        lines.join("\n")
    });

    // ── Leer stdout ─────────────────────────────────────────────────
    // El loop termina naturalmente cuando el proceso es matado por el watchdog
    // (el pipe se cierra). Los checks explícitos aquí son el camino rápido para
    // cuando hay output activo; el watchdog maneja el caso de proceso colgado.
    let mut log = String::new();
    for line in BufReader::new(stdout).lines() {
        if cancel.load(Ordering::Relaxed) || timed_out.load(Ordering::Relaxed) {
            break; // El watchdog ya está matando el proceso
        }
        if let Ok(l) = line {
            let _ = app.emit("compile://log", &l);
            log.push_str(&l);
            log.push('\n');
        }
    }

    // Recoger stderr
    let stderr_output = stderr_thread.join().unwrap_or_default();
    if !stderr_output.is_empty() {
        log.push_str(&stderr_output);
    }

    // Esperar al proceso hijo
    let status_result = {
        let mut guard = child_shared
            .lock()
            .map_err(|_| "Error interno: lock del proceso contaminado.".to_string())?;
        guard
            .as_mut()
            .ok_or_else(|| "Proceso ya terminado.".to_string())?
            .wait()
            .map_err(err)
    };

    // Señalar al watchdog que ya no es necesario. Sin esto el hilo seguiria
    // polleando hasta el deadline de 5 minutos aunque la compilacion ya termino.
    done.store(true, Ordering::SeqCst);

    // Reportar timeout y cancelación antes de revisar el exit status
    if timed_out.load(Ordering::Relaxed) {
        return Err(
            "Compilación interrumpida: el tiempo límite de 5 minutos fue superado. \
             El proceso LaTeX fue terminado."
                .to_string(),
        );
    }
    if cancel.load(Ordering::Relaxed) {
        return Err("Compilación cancelada por el usuario.".to_string());
    }

    let status = status_result?;
    let success = status.success();

    let user_errors = error_translator::translate_log(&log);

    let pdf_path: Option<String> = if success {
        let pdf = build_dir.join("main.pdf");
        if pdf.exists() {
            Some(pdf.to_string_lossy().to_string())
        } else {
            None
        }
    } else {
        None
    };

    let user_errors_json: Vec<Value> = user_errors
        .iter()
        .map(|e| {
            serde_json::json!({
                "message": e.message,
                "suggestion": e.suggestion,
                "raw_log_line": e.raw_log_line,
            })
        })
        .collect();

    let payload = serde_json::json!({
        "success": success,
        "pdf_path": pdf_path,
        "duration_ms": compile_start.elapsed().as_millis() as u64,
        "user_errors": user_errors_json,
        "warnings": Vec::<String>::new(),
        "log_preview": &log[..log.len().min(8000)],
        "backend_used": backend,
        "dependency_issues": Vec::<Value>::new(),
        "preflight_failed": false,
    });

    // Imprimir resumen de compilación en terminal
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        let elapsed = compile_start.elapsed();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        // Formato simple sin dependencias externas: HH:MM:SS en UTC
        let h = (now / 3600) % 24;
        let m = (now / 60) % 60;
        let s = now % 60;
        let secs = elapsed.as_secs();
        let ms = elapsed.subsec_millis();
        let result_str = if success { "OK" } else { "FALLÓ" };
        println!(
            "[TeXisStudio] Compilación {result_str} — Fin: {:02}:{:02}:{:02} UTC — Duración: {}m {}s {}ms",
            h, m, s, secs / 60, secs % 60, ms
        );
    }

    // Emitir evento de finalización para listeners no-await
    let _ = app.emit("compile://done", &payload);

    Ok(payload)
}

fn dev_profiles_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|root| root.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"))
}
