use serde::Serialize;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, Size};

#[derive(Clone, Serialize)]
pub struct CursorVector {
    pub x: f64,
    pub y: f64,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCursorPos(lpPoint: *mut Point) -> i32;
}

/// Polls cursor coordinates at ~60Hz without installing any global Windows hook
/// (prevents dead-key accent duplication and Alt+Tab/Win interference).
pub fn start_eye_tracker(app_handle: AppHandle) {
    thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            let mut last_x = i32::MIN;
            let mut last_y = i32::MIN;
            loop {
                thread::sleep(Duration::from_millis(16));
                let mut pt = Point { x: 0, y: 0 };
                let ok = unsafe { GetCursorPos(&mut pt as *mut Point) };
                if ok == 0 || (pt.x == last_x && pt.y == last_y) {
                    continue;
                }
                last_x = pt.x;
                last_y = pt.y;

                if let Some(win) = app_handle.get_webview_window("eye-overlay") {
                    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                        let center_x = pos.x as f64 + (size.width as f64 / 2.0);
                        let center_y = pos.y as f64 + (size.height as f64 / 2.0);
                        let norm_x = ((pt.x as f64 - center_x) / 480.0).clamp(-1.0, 1.0);
                        let norm_y = ((pt.y as f64 - center_y) / 360.0).clamp(-1.0, 1.0);
                        let _ = app_handle.emit("cursor-vector", CursorVector { x: norm_x, y: norm_y });
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            use rdev::{listen, Event, EventType};
            use std::time::Instant;
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
