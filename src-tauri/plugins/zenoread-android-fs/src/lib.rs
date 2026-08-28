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
struct PickFileResponse {
    uri: Option<String>,
    name: Option<String>,
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

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("zenoread-android-fs")
        .invoke_handler(tauri::generate_handler![pick_file, check_persisted])
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
