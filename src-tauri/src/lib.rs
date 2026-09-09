pub mod catalog;
pub mod community;
pub mod db;
pub mod downloads;
pub mod library;
pub mod migrate;
pub mod notebooks;
pub mod paths;
pub mod pets;
pub mod state;
pub mod workspace;

use tauri::Manager;

#[cfg(debug_assertions)]
static DEV_NAVIGATION_RECOVERED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // The auto-updater and the restart it needs. Both reach the network from RUST, not the
        // webview, so the closed CSP in tauri.conf.json is untouched — same posture as catalog.rs
        // and downloads.rs. The updater reads its pubkey + endpoints from `plugins.updater`.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .on_page_load(|_webview, _payload| {
            #[cfg(debug_assertions)]
            if _payload.event() == tauri::webview::PageLoadEvent::Finished
                && _payload.url().host_str() == Some("localhost")
                && _payload.url().port() == Some(1420)
            {
                // After an abruptly stopped WebView2 dev process, its first request to Vite can
                // occasionally complete as a malformed document. A normal Bell document always
                // owns `#root`, even before React mounts. Recover once, and only in debug builds;
                // bundled release assets never travel through this localhost connection.
                // The malformed document denies access to sessionStorage, so the one-shot guard
                // must live on the native side rather than in the page we are trying to recover.
                if !DEV_NAVIGATION_RECOVERED.swap(true, std::sync::atomic::Ordering::Relaxed) {
                    let _ = _webview.eval(
                        "if (!document.getElementById('root')) location.reload();",
                    );
                }
            }
        })
        .setup(|app| {
            // The index and the study state live beside the app's own data, never next to the
            // source library.
            let dir = app.path().app_data_dir()?;

            // The app was called Foolscap until Sep 2026, and the bundle identifier changed with
            // the name — which moves this whole directory. Carry the old one over before anything
            // reads from here. A failure is logged, not propagated: starting with no history beats
            // not starting.
            match migrate::run(&dir) {
                Ok(Some(report)) => eprintln!(
                    "carried over {} state file(s) from com.foolscap.study (index: {})",
                    report.state_files,
                    if report.index_copied { "yes" } else { "no" }
                ),
                Ok(None) => {}
                Err(e) => eprintln!("state carry-over skipped: {e}"),
            }

            let conn = db::open(&dir.join("index.sqlite3"))?;
            // A `download` row is what authorises a read, so a row whose file has gone is a paper the
            // app insists it has and cannot open. The index lives here in app data and the papers live
            // under Documents, so anything that carries one across without the other leaves every
            // recorded path dangling — see `library::prune_missing_downloads`. Dropping those rows
            // before the first query is what turns "cannot find the path specified" into a paper that
            // simply downloads again when you open it.
            match library::prune_missing_downloads(&conn) {
                Ok(0) => {}
                Ok(n) => eprintln!("[downloads] forgot {n} record(s) whose file has gone"),
                Err(e) => eprintln!("[downloads] could not check the records: {e}"),
            }
            app.manage(db::Db(std::sync::Mutex::new(conn)));

            let state_dir = dir.join("state");
            std::fs::create_dir_all(&state_dir)?;
            app.manage(state::StateDir(state_dir));

            // Notebooks are their own directory rather than more state keys: `state_load` reads every
            // key into memory before the first render, and a notebook holds ink and images.
            let notebook_dir = dir.join("notebooks");
            std::fs::create_dir_all(&notebook_dir)?;
            app.manage(notebooks::NotebookDir(notebook_dir));

            let workspace_dir = dir.join("workspace");
            std::fs::create_dir_all(&workspace_dir)?;
            app.manage(workspace::WorkspaceDir(workspace_dir));

            // Pets are their own directory for the same reason, and a stronger one: a spritesheet is
            // several MB of image, and `state_save` is text-only. Azure ships with Bell and is copied
            // here from compiled resources; the same directory can still support the dormant picker.
            let pet_dir = dir.join("pets");
            std::fs::create_dir_all(&pet_dir)?;
            pets::ensure_bundled_azure(&pet_dir)?;
            app.manage(pets::PetDir(pet_dir));
            app.manage(community::CommunitySession::default());
            app.manage(community::ThumbnailCache::default());

            // A release window stays hidden until the webview has painted the splash (main.tsx),
            // avoiding Windows' opaque white first frame. During `tauri dev`, however, a failed or
            // malformed first Vite navigation would otherwise leave a healthy `bell.exe` running
            // with its real window hidden and no error a developer can see. Reveal debug windows
            // natively as a fail-open diagnostic surface; the frontend's later `show()` is harmless.
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalog::sync_catalog,
            catalog::catalog_status,
            downloads::download_paper,
            downloads::delete_download,
            downloads::repair_downloads,
            downloads::download_root_path,
            library::library_stats,
            library::sitting_totals,
            library::list_subjects,
            library::list_papers,
            library::search_papers,
            library::find_subject,
            library::read_document,
            notebooks::nb_list,
            notebooks::nb_create,
            notebooks::nb_meta_save,
            notebooks::nb_delete,
            notebooks::nb_page_load,
            notebooks::nb_page_save,
            notebooks::nb_page_delete,
            notebooks::nb_history_load,
            notebooks::nb_history_save,
            notebooks::nb_asset_put,
            notebooks::nb_asset_load,
            notebooks::nb_stat,
            notebooks::nb_export,
            pets::pet_list,
            pets::pet_install,
            pets::pet_delete,
            pets::pet_sheet,
            pets::pet_motion,
            pets::pet_asset,
            pets::pet_registry,
            pets::pet_preview,
            community::community_status,
            community::community_list,
            community::community_get,
            community::community_thumbnail,
            community::community_vote,
            community::community_record_open,
            community::community_download,
            community::community_read_document,
            community::community_admin_status,
            community::community_admin_saved_username,
            community::community_admin_sign_in,
            community::community_admin_verify_mfa,
            community::community_admin_sign_out,
            community::community_admin_list,
            community::community_admin_stats,
            community::community_admin_inspection,
            community::community_admin_create,
            community::community_admin_update,
            community::community_admin_set_status,
            community::community_admin_delete,
            community::community_admin_upload,
            community::community_admin_upload_thumbnail,
            community::community_invalidate_thumbnail,
            community::community_admin_read_local_file,
            community::community_admin_save_temp_thumbnail,
            community::community_admin_preview,
            workspace::workspace_list,
            workspace::workspace_import,
            workspace::workspace_record_open,
            workspace::workspace_read_document,
            workspace::workspace_delete,
            state::state_load,
            state::state_save,
            state::state_delete,
            state::state_path,
            state::state_clear,
            state::state_export,
            state::reset_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
