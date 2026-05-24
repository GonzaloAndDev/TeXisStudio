mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::compiler::CompileState::new())
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::get_project,
            commands::project::list_recent_projects,
            commands::project::save_section,
            commands::project::save_project,
            commands::project::validate_project,
            commands::project::list_references,
            commands::project::create_snapshot,
            commands::project::list_snapshots,
            commands::project::restore_snapshot,
            commands::project::delete_snapshot,
            commands::project::update_section_meta,
            commands::compiler::compile_project,
            commands::compiler::cancel_compile,
            commands::system::create_profile,
            commands::system::get_profiles,
            commands::system::get_profile_detail,
            commands::system::import_profile,
            commands::system::export_profile,
            commands::system::update_profile,
            commands::system::delete_profile,
            commands::system::detect_latex,
            commands::system::get_cloud_folders,
            commands::remote::fetch_remote_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar TeXisStudio");
}
