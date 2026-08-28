package com.zenoread.androidfs

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import app.tauri.Logger
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class PickFileOptions {
  var mimeTypes: Array<String> = emptyArray()
}

@InvokeArg
class CheckPersistedOptions {
  var uri: String = ""
}

@TauriPlugin
class AndroidFsPlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun showOpenFilePicker(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(PickFileOptions::class.java)
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, args.mimeTypes)
        addFlags(
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION
        )
      }
      startActivityForResult(invoke, intent, "filePickerResult")
    } catch (ex: Exception) {
      Logger.error(ex.message ?: "Failed to open file picker")
      invoke.reject(ex.message ?: "Failed to open file picker")
    }
  }

  @ActivityCallback
  fun filePickerResult(invoke: Invoke, result: ActivityResult) {
    try {
      when (result.resultCode) {
        Activity.RESULT_OK -> {
          val uri = result.data?.data
          if (uri == null) {
            invoke.resolve(JSObject().put("uri", null))
            return
          }
          persistReadPermission(uri)
          invoke.resolve(JSObject().put("uri", uri.toString()).put("name", queryDisplayName(uri)))
        }
        Activity.RESULT_CANCELED -> invoke.resolve(JSObject().put("uri", null))
        else -> invoke.reject("Failed to pick file")
      }
    } catch (ex: Exception) {
      Logger.error(ex.message ?: "Failed to read file pick result")
      invoke.reject(ex.message ?: "Failed to read file pick result")
    }
  }

  @Command
  fun checkPersistedUriPermission(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(CheckPersistedOptions::class.java)
      val uri = Uri.parse(args.uri)
      val persisted = activity.contentResolver.persistedUriPermissions
        .any { it.uri == uri && it.isReadPermission }
      invoke.resolve(JSObject().put("persisted", persisted))
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "Failed to check persisted permission")
    }
  }

  private fun persistReadPermission(uri: Uri) {
    try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
    } catch (e: SecurityException) {
      // Some providers refuse persistable grants; the session grant still works.
      Logger.warn("Provider refused persistable URI permission: ${e.message}")
    }
  }

  private fun queryDisplayName(uri: Uri): String? {
    val cursor = activity.contentResolver
      .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null) ?: return null
    cursor.use {
      if (it.moveToFirst()) {
        val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0) return it.getString(index)
      }
    }
    return null
  }
}
