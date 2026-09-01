pub mod db;
pub mod ingest;
pub mod library;
pub mod paths;
pub mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The index and the study state live beside the app's own data, never next to the
            // source library.
            let dir = app.path().app_data_dir()?;
            let conn = db::open(&dir.join("index.sqlite3"))?;
            app.manage(db::Db(std::sync::Mutex::new(conn)));

            let state_dir = dir.join("state");
            std::fs::create_dir_all(&state_dir)?;
            app.manage(state::StateDir(state_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ingest::ingest_library,
            library::library_stats,
            library::list_subjects,
            library::list_papers,
            library::list_threshold_docs,
            library::save_thresholds,
            library::get_thresholds,
            library::save_difficulty,
            library::find_subject,
            library::read_document,
            state::state_load,
            state::state_save,
            state::state_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
