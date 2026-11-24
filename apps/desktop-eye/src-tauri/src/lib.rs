mod eye_tracker;
mod rpa;
mod voice;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            eye_tracker::start_eye_tracker(handle.clone());
            rpa::start_panic_hotkey_listener(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            eye_tracker::set_overlay_mode,
            eye_tracker::focus_eye_window,
            rpa::reset_panic_flag,
            rpa::capture_screen_normalized,
            rpa::execute_rpa_input,
            voice::set_voice_listening,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar Aurion Eye Tauri runtime");
}
