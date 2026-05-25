use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use texis_core::{
    compiler::error_translator,
    project::loader::ProjectLoader,
    LaTeXGenerator,
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
    let model = loader.load_from_file(&yaml_path).map_err(err)?;

    use texis_core::project::model::LatexEngine;
    let engine_flag = match model.latex_config.engine {
        LatexEngine::Pdflatex => "-pdf",
        LatexEngine::Lualatex => "-lualatex",
        LatexEngine::Xelatex  => "-xelatex",
    };

    let latex_gen = LaTeXGenerator::new().map_err(err)?;
    latex_gen.generate_with_lang(&model, &build_dir, lang_config.as_ref()).map_err(err)?;

    // ── Paso 2: seleccionar backend ───────────────────────────────
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

    task.await.map_err(|e| format!("Error interno: {e}"))?
}

/// Cancela la compilación en curso.
#[tauri::command]
pub fn cancel_compile(state: tauri::State<'_, CompileState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

// ── Lógica interna ────────────────────────────────────────────────

/// Elige el backend disponible: devuelve el nombre del binario a usar.
fn resolve_backend(name: &str) -> Result<&'static str, String> {
    use std::process::Command;
    let latexmk_ok  = Command::new("latexmk").arg("--version").output().is_ok();
    let tectonic_ok = Command::new("tectonic").arg("--version").output().is_ok();

    match name {
        "latexmk" => {
            if latexmk_ok { Ok("latexmk") }
            else { Err("latexmk no está instalado. Instala TeX Live, MiKTeX, o usa Tectonic.".to_string()) }
        }
        "tectonic" => {
            if tectonic_ok { Ok("tectonic") }
            else { Err("Tectonic no está instalado. Visita https://tectonic-typesetting.github.io".to_string()) }
        }
        "auto" => {
            if latexmk_ok  { Ok("latexmk")  }
            else if tectonic_ok { Ok("tectonic") }
            else { Err("No se encontró ningún compilador LaTeX. Instala latexmk (TeX Live/MiKTeX) o Tectonic.".to_string()) }
        }
        other => Err(format!("Backend '{other}' no reconocido. Usa: latexmk, tectonic o auto.")),
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
    // Construir el comando
    let mut cmd = std::process::Command::new(backend);
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
    let child_shared: Arc<Mutex<Option<std::process::Child>>> =
        Arc::new(Mutex::new(Some(child)));
    let timed_out = Arc::new(AtomicBool::new(false));

    // ── Watchdog thread ─────────────────────────────────────────────
    // Monitorea cada 500 ms. Si se supera el timeout o se solicita cancelación,
    // mata el proceso hijo directamente. Esto funciona incluso si LaTeX se
    // cuelga sin emitir ninguna línea de output.
    {
        let child_w = child_shared.clone();
        let cancel_w = cancel.clone();
        let timeout_w = timed_out.clone();
        std::thread::spawn(move || {
            let deadline =
                std::time::Instant::now() + std::time::Duration::from_secs(300);
            loop {
                std::thread::sleep(std::time::Duration::from_millis(500));
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
                    break;
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
        "user_errors": user_errors_json,
        "warnings": Vec::<String>::new(),
        "log_preview": &log[..log.len().min(8000)],
        "backend_used": backend,
    });

    // Emitir evento de finalización para listeners no-await
    let _ = app.emit("compile://done", &payload);

    Ok(payload)
}
