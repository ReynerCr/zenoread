package com.zenoread.androidfs

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
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

/** Documented OS cap on persisted URI grants per app: 128 before Android 11, 512 from 11 on. */
private val persistedGrantCap = if (Build.VERSION.SDK_INT >= 30) 512 else 128

@InvokeArg
class UriOptions {
  var uri: String = ""
}

@InvokeArg
class PickFileOptions {
  var mimeTypes: Array<String> = emptyArray()
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
          val persistError = persistReadPermission(uri)
          invoke.resolve(
            JSObject()
              .put("uri", uri.toString())
              .put("name", queryDisplayName(uri))
              .put("mime", activity.contentResolver.getType(uri))
              .put("persistError", persistError)
          )
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
      val args = invoke.parseArgs(UriOptions::class.java)
      val uri = Uri.parse(args.uri)
      val persisted = activity.contentResolver.persistedUriPermissions
        .any { it.uri == uri && it.isReadPermission }
      invoke.resolve(JSObject().put("persisted", persisted))
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "Failed to check persisted permission")
    }
  }

  @Command
  fun persistUriPermission(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(UriOptions::class.java)
      activity.contentResolver.takePersistableUriPermission(
        Uri.parse(args.uri),
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      invoke.resolve(JSObject().put("persisted", true))
    } catch (ex: Exception) {
      // Post-eviction retry. Keep the failure visible in logcat
      // even though the app keeps the session grant.
      Logger.error("Failed to persist URI permission: ${ex.message}")
      invoke.reject(ex.message ?: "Failed to persist URI permission")
    }
  }

  @Command
  fun releaseUriPermission(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(UriOptions::class.java)
      activity.contentResolver.releasePersistableUriPermission(
        Uri.parse(args.uri),
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      invoke.resolve(JSObject().put("released", true))
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "Failed to release URI permission")
    }
  }

  @Command
  fun releaseAllUriPermissions(invoke: Invoke) {
    try {
      var released = 0
      for (permission in activity.contentResolver.getPersistedUriPermissions()) {
        if (permission.isReadPermission) {
          activity.contentResolver.releasePersistableUriPermission(
            permission.uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
          released++
        }
      }
      invoke.resolve(JSObject().put("released", released))
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "Failed to release URI permissions")
    }
  }

  /**
   * Takes the persisted read grant; returns "limit" when the OS cap on
   * persisted grants is hit, "refused" when the provider does not support
   * persistence, or null on success.
   */
  private fun persistReadPermission(uri: Uri): String? {
    return try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      null
    } catch (e: SecurityException) {
      // Classify by the documented limit rather than the message, which
      // could drift.
      val atCap = activity.contentResolver.persistedUriPermissions.size >= persistedGrantCap
      if (atCap) {
        Logger.warn("Persisted URI grant cap reached: ${e.message}")
        "limit"
      } else {
        Logger.warn("Provider refused persistable URI permission: ${e.message}")
        "refused"
      }
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
