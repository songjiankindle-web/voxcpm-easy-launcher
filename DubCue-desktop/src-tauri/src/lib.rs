mod project;
mod runtime;

use runtime::DesktopState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(DesktopState::default()))
        .invoke_handler(tauri::generate_handler![
            runtime::runtime_status,
            runtime::install_runtime,
            runtime::pause_install,
            runtime::resume_install,
            runtime::start_backend,
            runtime::stop_backend,
            runtime::repair_runtime,
            runtime::uninstall_model,
            runtime::open_logs,
            runtime::provider_install_status,
            runtime::install_model_provider,
            project::save_project,
            project::open_project,
            project::autosave_project,
            project::load_autosave,
            project::recent_projects,
            project::save_audio,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DubCue");

    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
            if let Some(state) = handle.try_state::<Arc<DesktopState>>() {
                runtime::stop_backend_process(&state);
            }
        }
    });
}
