package com.zenoread.androidfs

import android.app.Activity
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Plugin

@TauriPlugin
class AndroidFsPlugin(private val activity: Activity) : Plugin(activity)
