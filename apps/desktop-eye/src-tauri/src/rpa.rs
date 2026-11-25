use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use image::codecs::jpeg::JpegEncoder;
use rdev::{listen, Event, EventType, Key as RdevKey};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use xcap::Monitor;

/// Flag global de interrupção imediata (0ms)
pub static PANIC_ABORT: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct ScreenCaptureResponse {
    pub image_base64: String,
    pub width: u32,
    pub height: u32,
    pub aborted: bool,
}

#[derive(Deserialize)]
pub struct InputCommand {
    pub action: String, // CLICK, DOUBLE_CLICK, RIGHT_CLICK, TYPE, HOTKEY, SCROLL
    pub norm_x: f64,    // 0.0 a 1000.0
    pub norm_y: f64,    // 0.0 a 1000.0
    pub text: Option<String>,
}

/// Inicia listener global em background para ESC 2x (<600ms) ou Ctrl+Alt+K
pub fn start_panic_hotkey_listener(app_handle: AppHandle) {
    thread::spawn(move || {
        let last_esc = Mutex::new(Instant::now() - Duration::from_secs(10));
        let ctrl_held = Mutex::new(false);
        let alt_held = Mutex::new(false);

        let callback = move |event: Event| match event.event_type {
            EventType::KeyPress(key) => match key {
                RdevKey::Escape => {
                    let mut guard = last_esc.lock().unwrap();
                    let now = Instant::now();
                    if now.duration_since(*guard) <= Duration::from_millis(600) {
                        trigger_panic_abort(&app_handle, "ESC duplo pressionado");
                    }
                    *guard = now;
                }
                RdevKey::ControlLeft | RdevKey::ControlRight => {
                    *ctrl_held.lock().unwrap() = true;
                }
                RdevKey::Alt | RdevKey::AltGr => {
                    *alt_held.lock().unwrap() = true;
                }
                RdevKey::KeyK => {
                    if *ctrl_held.lock().unwrap() && *alt_held.lock().unwrap() {
                        trigger_panic_abort(&app_handle, "Atalho Ctrl+Alt+K acionado");
                    }
                }
                _ => {}
            },
            EventType::KeyRelease(key) => match key {
                RdevKey::ControlLeft | RdevKey::ControlRight => {
                    *ctrl_held.lock().unwrap() = false;
                }
                RdevKey::Alt | RdevKey::AltGr => {
                    *alt_held.lock().unwrap() = false;
                }
                _ => {}
            },
            _ => {}
        };

        if let Err(err) = listen(callback) {
            eprintln!("[AURION PANIC LISTENER ERROR]: {:?}", err);
        }
    });
}

fn trigger_panic_abort(app_handle: &AppHandle, reason: &str) {
    PANIC_ABORT.store(true, Ordering::SeqCst);
    let _ = app_handle.emit("aurion://rpa-panic", reason);
}

#[tauri::command]
pub fn reset_panic_flag() {
    PANIC_ABORT.store(false, Ordering::SeqCst);
}

/// Captura o monitor primário, redimensiona para max 1280px de largura e codifica em JPEG leve
#[tauri::command]
pub fn capture_screen_normalized() -> Result<ScreenCaptureResponse, String> {
    if PANIC_ABORT.load(Ordering::SeqCst) {
        return Ok(ScreenCaptureResponse {
            image_base64: String::new(),
            width: 0,
            height: 0,
            aborted: true,
        });
    }

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or_else(|| "Nenhum monitor primário encontrado".to_string())?;

    let width = primary.width();
    let height = primary.height();
    let rgba_img = primary.capture_image().map_err(|e| e.to_string())?;

    let dynamic_img = image::DynamicImage::ImageRgba8(rgba_img);
    let resized = if width > 1280 {
        let new_h = (height as f32 * (1280.0 / width as f32)) as u32;
        dynamic_img.resize(1280, new_h, image::imageops::FilterType::Triangle)
    } else {
        dynamic_img
    };

    let rgb_img = resized.to_rgb8();
    let mut buf = Cursor::new(Vec::new());
    let mut encoder = JpegEncoder::new_with_quality(&mut buf, 72);
    encoder.encode_image(&rgb_img).map_err(|e| e.to_string())?;

    Ok(ScreenCaptureResponse {
        image_base64: BASE64.encode(buf.into_inner()),
        width,
        height,
        aborted: false,
    })
}

fn move_mouse_smooth(enigo: &mut Enigo, target_x: i32, target_y: i32) -> Result<bool, String> {
    let (start_x, start_y) = enigo.location().map_err(|e| e.to_string())?;
    let steps = 28;

    for i in 1..=steps {
        if PANIC_ABORT.load(Ordering::SeqCst) {
            return Ok(false);
        }
        let t = i as f64 / steps as f64;
        let ease = 1.0 - (1.0 - t).powi(3);
        let cur_x = start_x as f64 + (target_x - start_x) as f64 * ease;
        let cur_y = start_y as f64 + (target_y - start_y) as f64 * ease;

        enigo
            .move_mouse(cur_x.round() as i32, cur_y.round() as i32, Coordinate::Abs)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(8));
    }
    Ok(true)
}

#[tauri::command]
pub fn execute_rpa_input(cmd: InputCommand, screen_w: u32, screen_h: u32) -> Result<bool, String> {
    if PANIC_ABORT.load(Ordering::SeqCst) {
        return Ok(false);
    }

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let abs_x = ((cmd.norm_x / 1000.0) * screen_w as f64).round() as i32;
    let abs_y = ((cmd.norm_y / 1000.0) * screen_h as f64).round() as i32;

    match cmd.action.as_str() {
        "CLICK" => {
            if !move_mouse_smooth(&mut enigo, abs_x, abs_y)? {
                return Ok(false);
            }
            enigo.button(Button::Left, Direction::Click).map_err(|e| e.to_string())?;
        }
        "DOUBLE_CLICK" => {
            if !move_mouse_smooth(&mut enigo, abs_x, abs_y)? {
                return Ok(false);
            }
            enigo.button(Button::Left, Direction::Click).map_err(|e| e.to_string())?;
            thread::sleep(Duration::from_millis(45));
            enigo.button(Button::Left, Direction::Click).map_err(|e| e.to_string())?;
        }
        "RIGHT_CLICK" => {
            if !move_mouse_smooth(&mut enigo, abs_x, abs_y)? {
                return Ok(false);
            }
            enigo.button(Button::Right, Direction::Click).map_err(|e| e.to_string())?;
        }
        "TYPE" => {
            if let Some(txt) = cmd.text {
                for ch in txt.chars() {
                    if PANIC_ABORT.load(Ordering::SeqCst) {
                        return Ok(false);
                    }
                    enigo.text(&ch.to_string()).map_err(|e| e.to_string())?;
                    thread::sleep(Duration::from_millis(12));
                }
            }
        }
        "HOTKEY" => {
            if let Some(combo) = cmd.text {
                let parts: Vec<&str> = combo.split('+').map(|s| s.trim()).collect();
                let mut modifiers = Vec::new();
                for part in &parts[..parts.len().saturating_sub(1)] {
                    let m = match part.to_lowercase().as_str() {
                        "ctrl" | "control" => Key::Control,
                        "alt" => Key::Alt,
                        "shift" => Key::Shift,
                        "meta" | "win" | "cmd" => Key::Meta,
                        _ => continue,
                    };
                    enigo.key(m, Direction::Press).map_err(|e| e.to_string())?;
                    modifiers.push(m);
                }
                if let Some(last) = parts.last() {
                    if let Some(c) = last.chars().next() {
                        enigo.key(Key::Unicode(c), Direction::Click).map_err(|e| e.to_string())?;
                    }
                }
                for m in modifiers.into_iter().rev() {
                    enigo.key(m, Direction::Release).map_err(|e| e.to_string())?;
                }
            }
        }
        "SCROLL" => {
            enigo.scroll(-3, enigo::Axis::Vertical).map_err(|e| e.to_string())?;
        }
        _ => {}
    }

    Ok(!PANIC_ABORT.load(Ordering::SeqCst))
}
