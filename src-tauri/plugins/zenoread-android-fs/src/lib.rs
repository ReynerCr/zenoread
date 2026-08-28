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

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("zenoread-android-fs")
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
