use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

pub static VOICE_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
pub struct VoiceStatus {
    pub active: bool,
    pub wake_word: String,
}

/// Configures local wake-word / VAD monitoring state (audio only leaves device when active).
#[tauri::command]
pub fn set_voice_listening(app_handle: AppHandle, active: bool, wake_word: Option<String>) -> VoiceStatus {
    VOICE_ACTIVE.store(active, Ordering::SeqCst);
    let status = VoiceStatus {
        active,
        wake_word: wake_word.unwrap_or_else(|| "Aurion".to_string()),
    };
    let _ = app_handle.emit("aurion://voice-status", status.clone());
    status
}
