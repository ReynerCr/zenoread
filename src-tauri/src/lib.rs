use tauri_plugin_log::{Target, TargetKind, RotationStrategy};
use log::LevelFilter;

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
