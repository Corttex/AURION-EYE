use rdev::{listen, Event, EventType};
use serde::Serialize;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, Size};

#[derive(Clone, Serialize)]
pub struct CursorVector {
    pub x: f64,
    pub y: f64,
}

/// Captures global mouse coordinates and emits normalized `cursor-vector` [-1.0, 1.0] at ~60Hz.
pub fn start_eye_tracker(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_emit = Instant::now();
        let callback = move |event: Event| {
            if let EventType::MouseMove { x, y } = event.event_type {
                if last_emit.elapsed() < Duration::from_millis(16) {
                    return;
                }
                last_emit = Instant::now();

                if let Some(win) = app_handle.get_webview_window("eye-overlay") {
                    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                        let center_x = pos.x as f64 + (size.width as f64 / 2.0);
                        let center_y = pos.y as f64 + (size.height as f64 / 2.0);
                        let norm_x = ((x - center_x) / 480.0).clamp(-1.0, 1.0);
                        let norm_y = ((y - center_y) / 360.0).clamp(-1.0, 1.0);
                        let _ = app_handle.emit("cursor-vector", CursorVector { x: norm_x, y: norm_y });
                    }
                }
            }
        };

        if let Err(err) = listen(callback) {
            eprintln!("[AURION EYE TRACKER ERROR]: {:?}", err);
        }
    });
}

#[tauri::command]
pub fn set_overlay_mode(app_handle: AppHandle, mode: String) -> Result<(), String> {
    let win = app_handle
        .get_webview_window("eye-overlay")
        .ok_or_else(|| "Janela eye-overlay não encontrada".to_string())?;

    let (w, h) = match mode.as_str() {
        "radial" | "popover" => (960.0, 600.0),
        _ => (190.0, 150.0),
    };
    win.set_size(Size::Logical(LogicalSize { width: w, height: h }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn focus_eye_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("eye-overlay") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}
