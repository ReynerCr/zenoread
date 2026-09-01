use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{Target, TargetKind, RotationStrategy};
use log::LevelFilter;

/// Removes every entry under the app's data directory except `logs/`, used
/// by the recovery dialog when IndexedDB is unreadable. Desktop-only;
/// Android returns an error (PathResolver unavailable there).
#[cfg(not(target_os = "android"))]
#[tauri::command]
fn wipe_app_data(app: AppHandle) -> Result<(), String> {
    let dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;

    let entries = fs::read_dir(&dir).map_err(|e| format!("read_dir failed: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("entry error: {e}"))?;
        let path = entry.path();
        if path.file_name().map(|n| n == "logs").unwrap_or(false) {
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| format!("remove_dir_all failed: {e}"))?;
        } else {
            fs::remove_file(&path).map_err(|e| format!("remove_file failed: {e}"))?;
        }
    }
    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn wipe_app_data() -> Result<(), String> {
    Err("wipe_app_data is not yet implemented on Android".into())
}

/// Terminates the Tauri process. Called from the recovery flow after a wipe
/// so the next launch picks up the empty directory.
#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(zenoread_android_fs::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .rotation_strategy(RotationStrategy::KeepSome(3))
                .max_file_size(1024 * 1024)
                // Default level is Trace; on Android the jni crate logs every
                // JNI call at trace, flooding the logger and amplifying itself
                // through the Webview target (delivery is itself a JNI call).
                .level(LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![wipe_app_data, exit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
