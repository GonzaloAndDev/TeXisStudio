mod ai;
mod commands;
mod error_format;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Warn)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("texisstudio".into()),
                    }),
                ])
                .max_file_size(10_485_760)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::compiler::CompileState::new())
        .manage(commands::ai::AiState::new())
        .setup(|app| {
            // The window is created hidden so the frontend can apply the chosen
            // window mode (maximized / remembered size) before it appears,
            // avoiding a visible snap-back to the configured size. This is a
            // safety net: if the frontend never reveals it (e.g. a load error),
            // show it anyway so the app can't get stuck invisible.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::document_core::document_build,
            commands::recovery::recovery_scan,
            commands::recovery::recovery_list_snapshots,
            commands::recovery::recovery_restore_snapshot,
            commands::recovery::verify_integrity,
            commands::project::create_project,
            commands::project::import_tex_project,
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
            commands::project::update_preamble_config,
            commands::project::export_delivery,
            commands::project::delivery_quality_report,
            commands::export_platform::export_for_target,
            commands::import_project::import_from_source,
            commands::project::check_pdf_postflight,
            commands::project::generate_review_report,
            commands::project::get_section_progress,
            commands::project::list_project_assets,
            commands::project::detect_build_conflicts,
            commands::project::force_regenerate_build,
            commands::project::save_external_copy_and_regenerate,
            commands::compiler::compile_project,
            commands::compiler::cancel_compile,
            commands::system::create_profile,
            commands::system::get_profiles,
            commands::system::get_profile_detail,
            commands::system::import_profile,
            commands::system::export_profile,
            commands::system::update_profile,
            commands::system::delete_profile,
            commands::system::get_platform,
            commands::system::get_log_dir,
            commands::system::open_in_system,
            commands::system::detect_latex,
            commands::system::check_toolchain,
            commands::system::get_cloud_folders,
            commands::system::run_system_doctor,
            commands::system::check_profile_lock,
            commands::system::create_profile_lock,
            commands::remote::fetch_profile_catalog,
            commands::remote::fetch_remote_profile,
            commands::doi::import_doi,
            commands::doi::import_dois_batch,
            commands::doi::preview_bib_entry,
            commands::zotero::check_zotero_status,
            commands::zotero::search_zotero,
            commands::zotero::import_zotero_items,
            // Bibliography unified (DOI resolution + multi-provider + exporters)
            commands::doi::import_doi_as_record,
            commands::doi::search_crossref,
            commands::bibliography_unified::import_doi_unified,
            commands::bibliography_unified::import_dois_unified,
            commands::bibliography_unified::search_bibliography,
            commands::bibliography_unified::export_record_to_bibtex,
            commands::bibliography_unified::export_record_to_csl_json,
            commands::bibliography_unified::export_record_to_ris,
            // Additional providers
            commands::datacite::import_doi_datacite,
            commands::openalex::search_openalex,
            commands::openalex::enrich_from_openalex,
            commands::semantic_scholar::search_semantic_scholar,
            // Package analysis
            commands::glossary::analyze_glossary,
            commands::package::analyze_packages,
            // Build engine
            commands::build::detect_latex_toolchain,
            commands::build::build_project_full,
            commands::build::build_project_quick,
            // Template engine
            commands::template::list_templates,
            commands::template::create_project_from_template,
            // AI assistant
            commands::ai::ai_send_message,
            commands::ai::cancel_ai_message,
            commands::ai::ai_get_action_modes,
            // Plugin figures
            commands::figure_plugin::save_plugin_figure,
            commands::figure_plugin::load_figure_source,
            commands::figure_plugin::delete_plugin_figure,
            commands::figure_plugin::list_plugin_figures,
            // Snippet preview
            commands::snippet_preview::compile_snippet_preview,
            commands::snippet_preview::validate_figure_snippet,
            // Workspace state
            commands::workspace::save_workspace_state,
            commands::workspace::load_workspace_state,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start TeXisStudio");
}
