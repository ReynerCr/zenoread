use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};
#[cfg(target_os = "android")]
use tauri::{plugin::PluginHandle, Manager};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.zenoread.androidfs";

/// Handle to the Kotlin side of the plugin.
#[cfg(target_os = "android")]
#[derive(Clone)]
pub(crate) struct AndroidFs<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PickFilePayload<'a> {
    mime_types: &'a [String],
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickFileResponse {
    uri: Option<String>,
    name: Option<String>,
    mime: Option<String>,
    persist_error: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckPersistedPayload<'a> {
    uri: &'a str,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize, Serialize)]
struct CheckPersistedResponse {
    persisted: bool,
}

/// Opens the Android SAF file picker and returns the selected content URI with
/// its display name. The read grant is persisted across restarts when the
/// provider allows it. Returns null fields when the user cancels.
#[tauri::command]
async fn pick_file<R: Runtime>(
    app: tauri::AppHandle<R>,
    mime_types: Vec<String>,
) -> Result<PickFileResponse, String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        // The picker waits on the user; run the blocking JNI call off the
        // async runtime so it does not starve other commands.
        let (tx, rx) = std::sync::mpsc::sync_channel(0);
        let handle = fs.0.clone();
        std::thread::spawn(move || {
            let res = handle.run_mobile_plugin(
                "showOpenFilePicker",
                PickFilePayload {
                    mime_types: &mime_types,
                },
            );
            let _ = tx.send(res);
        });
        rx.recv().map_err(|e| e.to_string())?.map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, mime_types);
        Err("zenoread-android-fs is only available on Android".into())
    }
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UriPayload<'a> {
    uri: &'a str,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize, Serialize)]
struct PersistResponse {
    persisted: bool,
}

/// Whether the app holds a persisted read grant for the given content URI.
#[tauri::command]
async fn check_persisted<R: Runtime>(app: tauri::AppHandle<R>, uri: String) -> Result<bool, String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        let res = fs
            .0
            .run_mobile_plugin::<CheckPersistedResponse>(
                "checkPersistedUriPermission",
                CheckPersistedPayload { uri: &uri },
            )
            .map_err(|e| e.to_string())?;
        Ok(res.persisted)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, uri);
        Err("zenoread-android-fs is only available on Android".into())
    }
}

/// Persists the read grant for a content URI. Used to retry after evicting
/// older grants when the OS cap is hit.
#[tauri::command]
async fn persist<R: Runtime>(app: tauri::AppHandle<R>, uri: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        let _ = fs
            .0
            .run_mobile_plugin::<PersistResponse>("persistUriPermission", UriPayload { uri: &uri })
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, uri);
        Err("zenoread-android-fs is only available on Android".into())
    }
}

/// Releases the persisted read grant for a content URI (dead grant cleanup).
#[tauri::command]
async fn release<R: Runtime>(app: tauri::AppHandle<R>, uri: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        let _ = fs
            .0
            .run_mobile_plugin::<serde_json::Value>(
                "releaseUriPermission",
                UriPayload { uri: &uri },
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, uri);
        Err("zenoread-android-fs is only available on Android".into())
    }
}

/// Releases every persisted read grant the app holds (app data reset).
#[tauri::command]
async fn release_all<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        let _ = fs
            .0
            .run_mobile_plugin::<serde_json::Value>("releaseAllUriPermissions", ())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("zenoread-android-fs is only available on Android".into())
    }
}

/// Wipes the app's private data dir via `ActivityManager.clearApplicationUserData`
/// and triggers a process exit. Parity with the desktop `wipe_app_data` command.
#[tauri::command]
async fn clear_app_data<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let fs = app.state::<AndroidFs<R>>();
        let _ = fs
            .0
            .run_mobile_plugin::<serde_json::Value>("clearAppData", ())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("zenoread-android-fs is only available on Android".into())
    }
}

/// Wipes the app's private data dir from a host-side Tauri command.
/// Android-only.
#[cfg(target_os = "android")]
pub fn wipe_app_data<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let fs = app.state::<AndroidFs<R>>();
    fs.0
        .run_mobile_plugin::<serde_json::Value>("clearAppData", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("zenoread-android-fs")
        .invoke_handler(tauri::generate_handler![
            pick_file,
            check_persisted,
            persist,
            release,
            release_all,
            clear_app_data
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidFsPlugin")?;
                app.manage(AndroidFs(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}
