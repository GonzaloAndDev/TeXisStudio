mod ai;
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
            commands::project::append_bib_entry,
            commands::project::create_snapshot,
            commands::project::list_snapshots,
            commands::project::restore_snapshot,
            commands::project::delete_snapshot,
            commands::project::update_section_meta,
            commands::project::update_typography,
            commands::project::export_delivery,
            commands::project::check_pdf_postflight,
            commands::project::generate_review_report,
            commands::project::get_section_progress,
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
            commands::system::run_system_doctor,
            commands::system::check_profile_lock,
            commands::system::create_profile_lock,
            commands::remote::fetch_remote_profile,
            commands::doi::import_doi,
            commands::doi::import_dois_batch,
            commands::doi::preview_bib_entry,
            commands::zotero::check_zotero_status,
            commands::zotero::search_zotero,
            commands::zotero::import_zotero_items,
            commands::ai::ai_send_message,
            commands::ai::ai_get_action_modes,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar TeXisStudio");
}
