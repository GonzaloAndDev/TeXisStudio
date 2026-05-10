mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_project,
            commands::project::list_recent_projects,
            commands::project::save_section,
            commands::project::save_project,
            commands::project::validate_project,
            commands::compiler::compile_project,
            commands::system::get_profiles,
            commands::system::detect_latex,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar TeXisStudio");
}
